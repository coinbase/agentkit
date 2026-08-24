import { generateTokenUri } from "./metadata_utils";

describe("generateTokenUri", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const buildParams = (image: string) => ({
    metadata: {
      image,
      description: "A test token",
    },
  });

  describe("local filesystem paths", () => {
    // Regression: the image is uploaded to a third-party API and pinned to public IPFS.
    // Reading caller-supplied paths here would let an agent exfiltrate arbitrary host files.
    const localPaths = [
      "/root/.env",
      "/proc/self/environ",
      "../../etc/passwd",
      "~/.aws/credentials",
      "./logo.png",
      "logo.png",
      "file:///etc/passwd",
    ];

    it.each(localPaths)("rejects %s", async path => {
      await expect(generateTokenUri("Test", "TEST", buildParams(path))).rejects.toThrow(
        "Reading images from the local filesystem is not supported",
      );
    });

    it("does not make any network request when given a local path", async () => {
      await expect(generateTokenUri("Test", "TEST", buildParams("/root/.env"))).rejects.toThrow();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("accepted image sources", () => {
    it("accepts a data URI and forwards it to the upload API unchanged", async () => {
      const dataUri = "data:image/png;base64,aGVsbG8=";

      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ipfsHash: "imageHash" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ipfsHash: "metadataHash" }),
        });

      const uri = await generateTokenUri("Test", "TEST", buildParams(dataUri));

      expect(uri).toBe("ipfs://metadataHash");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ base64Image: dataUri });
    });

    it("accepts an https URL", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => "image/png" },
          arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ipfsHash: "imageHash" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ipfsHash: "metadataHash" }),
        });

      const uri = await generateTokenUri(
        "Test",
        "TEST",
        buildParams("https://example.com/image.png"),
      );

      expect(uri).toBe("ipfs://metadataHash");
      expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/image.png");
    });
  });
});
