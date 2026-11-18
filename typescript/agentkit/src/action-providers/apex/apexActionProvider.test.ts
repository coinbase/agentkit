import { apexActionProvider } from "./apexActionProvider";

describe("ApexActionProvider", () => {
  const fetchMock = jest.fn();
  const provider = apexActionProvider();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("returns the unpaid terms and does not sign", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 402,
      text: async () => JSON.stringify({ accepts: [{ amount: "1000" }] }),
    });
    const parsed = JSON.parse(
      await provider.txCheck({ chain: "base", from: "0x" + "11".repeat(20), to: "0x" + "22".repeat(20), data: "0x095ea7b3" }),
    );
    expect(parsed.paid).toBe(false);
    expect(parsed.http).toBe(402);
    expect(parsed.note).toMatch(/Nothing was signed/);
    const called = String(fetchMock.mock.calls[0][0]);
    expect(called.startsWith("https://apexfaucet.xyz/api/x402/tx-check?")).toBe(true);
    expect(called).not.toMatch(/private/i);
  });

  it("refuses a Solana call that has no signer", async () => {
    const parsed = JSON.parse(await provider.txCheck({ chain: "solana", tx: "abc" }));
    expect(parsed.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scores an https URL and does not pay it", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ ok: true, score: 96 }),
    });
    const parsed = JSON.parse(
      await provider.deliveryScore({ url: "https://apexfaucet.xyz/api/x402/page-markdown" }),
    );
    expect(parsed.http).toBe(200);
    expect(parsed.body.score).toBe(96);
    const called = String(fetchMock.mock.calls[0][0]);
    expect(called.startsWith("https://apexfaucet.xyz/api/x402/delivery-score?url=")).toBe(true);
  });
});
