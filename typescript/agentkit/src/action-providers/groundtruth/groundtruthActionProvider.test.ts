import { groundtruthActionProvider } from "./groundtruthActionProvider";
import { GroundtruthAddressSchema } from "./schemas";
import { Network } from "../../network";

const SOL_CREATOR = "WB6dqX3niseHgaMNMiWBkmqQ5heAMGSKxKkdA2WNak3";
const RH_TOKEN = "0x1111111111111111111111111111111111111111";

describe("GroundtruthActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.GROUNDTRUTH_API_KEY;
  });

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  });

  it("supports every network", () => {
    const provider = groundtruthActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: "svm" } as Network)).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm" } as Network)).toBe(true);
  });

  it("validates the schema", () => {
    expect(GroundtruthAddressSchema.safeParse({ address: SOL_CREATOR }).success).toBe(true);
    expect(GroundtruthAddressSchema.safeParse({ address: RH_TOKEN, chain: "rh" }).success).toBe(
      true,
    );
    expect(GroundtruthAddressSchema.safeParse({ address: "" }).success).toBe(false);
    expect(GroundtruthAddressSchema.safeParse({ address: SOL_CREATOR, chain: "eth" }).success).toBe(
      false,
    );
  });

  it("gets a creator record from /v1/flag, inferring solana", async () => {
    fetchMock.mockResolvedValue(ok({ launches: 12, rugged: 11 }));
    const result = await groundtruthActionProvider().getCreatorRecord({ address: SOL_CREATOR });
    expect(JSON.parse(result)).toEqual({ launches: 12, rugged: 11 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.groundtruths.xyz/v1/flag");
    expect(url.searchParams.get("addr")).toBe(SOL_CREATOR);
    expect(url.searchParams.get("chain")).toBe("solana");
  });

  it("gets a coin record from /v1/record, inferring rh from a 0x address", async () => {
    fetchMock.mockResolvedValue(ok({ outcome: "rugged" }));
    await groundtruthActionProvider().getCoinRecord({ address: RH_TOKEN });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/v1/record");
    expect(url.searchParams.get("ca")).toBe(RH_TOKEN);
    expect(url.searchParams.get("chain")).toBe("rh");
  });

  it("gets the known-bad flag from /api/flag with an explicit chain", async () => {
    fetchMock.mockResolvedValue(ok({ known_bad: true }));
    const result = await groundtruthActionProvider().getKnownBadFlag({
      address: SOL_CREATOR,
      chain: "solana",
    });
    expect(JSON.parse(result)).toEqual({ known_bad: true });
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe("/api/flag");
  });

  it("sends the API key as x-api-key only when configured", async () => {
    fetchMock.mockResolvedValue(ok({}));
    await groundtruthActionProvider({ apiKey: "k" }).getCoinRecord({ address: SOL_CREATOR });
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("k");
    await groundtruthActionProvider().getCoinRecord({ address: SOL_CREATOR });
    expect(fetchMock.mock.calls[1][1].headers["x-api-key"]).toBeUndefined();
  });

  it("explains a 402 instead of failing silently", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 402 });
    const result = await groundtruthActionProvider().getCreatorRecord({ address: SOL_CREATOR });
    expect(result).toContain("free allowance is used up");
  });

  it("returns an error string on HTTP and network errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await groundtruthActionProvider().getCoinRecord({ address: SOL_CREATOR })).toContain(
      "Error fetching GROUNDTRUTH coin record: HTTP error! status: 500",
    );
    fetchMock.mockRejectedValue(new Error("Network error"));
    expect(await groundtruthActionProvider().getKnownBadFlag({ address: SOL_CREATOR })).toContain(
      "Network error",
    );
  });
});
