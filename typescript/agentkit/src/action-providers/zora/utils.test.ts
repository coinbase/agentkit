import { generateZoraTokenUri } from "./utils";

describe("generateZoraTokenUri", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const buildParams = (image: string) => ({
    name: "Test Coin",
    symbol: "TEST",
    description: "A test coin",
    image,
    pinataConfig: { jwt: "test-jwt" },
  });

  const mockPinataJsonUpload = () =>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        IpfsHash: "metadataHash",
        PinSize: 1,
        Timestamp: "2026-01-01T00:00:00Z",
      }),
    });

  describe("local filesystem paths", () => {
    // Regression: the image is uploaded to Pinata and pinned to public IPFS. Reading
    // caller-supplied paths here would let an agent exfiltrate arbitrary host files.
    const localPaths = [
      "/root/.env",
      "/proc/self/environ",
      "../../etc/passwd",
      "~/.aws/credentials",
      "./logo.png",
      "logo.png",
      "file:///etc/passwd",
      "http://example.com/image.png",
    ];

    it.each(localPaths)("rejects %s", async path => {
      await expect(generateZoraTokenUri(buildParams(path))).rejects.toThrow(
        "Reading images from the local filesystem is not supported",
      );
    });

    it("does not make any network request when given a local path", async () => {
      await expect(generateZoraTokenUri(buildParams("/root/.env"))).rejects.toThrow();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("accepted image sources", () => {
    it("passes through an ipfs:// URI without uploading the image", async () => {
      mockPinataJsonUpload();

      const result = await generateZoraTokenUri(buildParams("ipfs://existingImageCID"));

      expect(result).toEqual({
        uri: "ipfs://metadataHash",
        imageUri: "ipfs://existingImageCID",
      });
      // Only the metadata upload; the image itself is never re-uploaded.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.pinata.cloud/pinning/pinJSONToIPFS");
    });

    it("passes through an https:// URL without uploading the image", async () => {
      mockPinataJsonUpload();

      const result = await generateZoraTokenUri(buildParams("https://example.com/image.png"));

      expect(result.imageUri).toBe("https://example.com/image.png");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("uploads a data URI to Pinata and uses the resulting CID", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            IpfsHash: "imageHash",
            PinSize: 1,
            Timestamp: "2026-01-01T00:00:00Z",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            IpfsHash: "metadataHash",
            PinSize: 1,
            Timestamp: "2026-01-01T00:00:00Z",
          }),
        });

      const result = await generateZoraTokenUri(buildParams("data:image/png;base64,aGVsbG8="));

      expect(result).toEqual({ uri: "ipfs://metadataHash", imageUri: "ipfs://imageHash" });
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    });

    it("rejects a malformed data URI", async () => {
      await expect(generateZoraTokenUri(buildParams("data:image/png,notbase64"))).rejects.toThrow(
        "Invalid data URI",
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
