import { keptvowActionProvider } from "./keptvowActionProvider";

describe("KeptvowActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = keptvowActionProvider();
  const wallet = "0x00000000000000000000000000000000000000aa";

  const answer = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
    fetchMock.mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: jest.fn().mockResolvedValue(body),
    });

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.KEPTVOW_API_KEY;
  });

  describe("checkPayment", () => {
    it("returns the verdict, the reason and a link to the wallet's page", async () => {
      answer({
        verdict: "ok",
        advice: "A strong payment record.",
        pay_to: wallet,
        sanctions_list: null,
        wallet_page: `/wallets/${wallet}`,
        evidence: { ignored: true },
      });

      const result = await provider.checkPayment({ payTo: wallet, amountUsd: null });

      expect(JSON.parse(result)).toEqual({
        verdict: "ok",
        advice: "A strong payment record.",
        payTo: wallet,
        details: `https://keptvow.com/wallets/${wallet}`,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `https://keptvow.com/v1/check?pay_to=${wallet}`,
        expect.objectContaining({ method: "GET", headers: { Accept: "application/json" } }),
      );
    });

    it("sends the amount when one is given", async () => {
      answer({ verdict: "careful", advice: "Pay only what you can afford to lose." });

      await provider.checkPayment({ payTo: wallet, amountUsd: 12.5 });

      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://keptvow.com/v1/check?pay_to=${wallet}&amount_usd=12.5`,
      );
    });

    it("passes on a sanctions-list stop", async () => {
      answer({ verdict: "stop", advice: "On the sanctions list.", sanctions_list: "OFAC SDN" });

      const result = JSON.parse(await provider.checkPayment({ payTo: wallet, amountUsd: null }));

      expect(result.verdict).toBe("stop");
      expect(result.sanctionsList).toBe("OFAC SDN");
    });

    it("sends a Solana address as written", async () => {
      answer({ verdict: "careful", advice: "No record." });
      const solana = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

      await provider.checkPayment({ payTo: ` ${solana} `, amountUsd: null });

      expect(fetchMock.mock.calls[0][0]).toBe(`https://keptvow.com/v1/check?pay_to=${solana}`);
    });

    it("says what Keptvow said when it refuses the request", async () => {
      answer(
        { error: "pay_to must be a 0x wallet address or a Solana address" },
        { ok: false, status: 400 },
      );

      const result = await provider.checkPayment({ payTo: "nope", amountUsd: null });

      expect(result).toBe(
        "Error checking payment: pay_to must be a 0x wallet address or a Solana address",
      );
    });

    it("falls back to the HTTP status when the answer is not JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn().mockRejectedValue(new Error("not json")),
      });

      const result = await provider.checkPayment({ payTo: wallet, amountUsd: null });

      expect(result).toBe("Error checking payment: HTTP 502");
    });

    it("handles network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.checkPayment({ payTo: wallet, amountUsd: null });

      expect(result).toBe("Error checking payment: Network error");
    });
  });

  describe("checkBot", () => {
    it("returns the trust level, score and the first reasons", async () => {
      answer({
        agent_id: "erc8004:8453:1234",
        trust_level: "good",
        score: 82,
        reasons: ["a", "b", "c", "d", "e", "f", "g"],
      });

      const result = JSON.parse(await provider.checkBot({ agentId: "erc8004:8453:1234" }));

      expect(result).toEqual({
        agentId: "erc8004:8453:1234",
        trustLevel: "good",
        score: 82,
        reasons: ["a", "b", "c", "d", "e"],
      });
      expect(fetchMock.mock.calls[0][0]).toBe("https://keptvow.com/v1/trust/erc8004%3A8453%3A1234");
    });

    it("encodes whatever it is given into the one path segment", async () => {
      answer({ agent_id: "x", trust_level: "unknown", score: 100, reasons: [] });

      await provider.checkBot({ agentId: "a/b?c=d" });

      expect(fetchMock.mock.calls[0][0]).toBe("https://keptvow.com/v1/trust/a%2Fb%3Fc%3Dd");
    });

    it("handles errors", async () => {
      answer({ error: "no such bot" }, { ok: false, status: 404 });

      const result = await provider.checkBot({ agentId: "nobody" });

      expect(result).toBe("Error checking bot: no such bot");
    });
  });

  describe("reportDelivery", () => {
    const tx = `0x${"ab".repeat(32)}`;

    it("posts the report and says it was queued", async () => {
      answer(
        { status: "queued", note: "The payment is checked on Base within a minute." },
        { status: 202 },
      );

      const result = JSON.parse(
        await provider.reportDelivery({ tx: ` ${tx} `, delivered: true, payTo: wallet }),
      );

      expect(result).toEqual({
        status: "queued",
        note: "The payment is checked on Base within a minute.",
      });
      expect(fetchMock).toHaveBeenCalledWith("https://keptvow.com/v1/outcomes", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ tx, delivered: true, pay_to: wallet }),
        signal: expect.anything(),
      });
    });

    it("leaves out the seller wallet when none is given, and can say it did not arrive", async () => {
      answer({ status: "queued" }, { status: 202 });

      await provider.reportDelivery({ tx, delivered: false, payTo: null });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tx, delivered: false });
    });

    it("says what Keptvow said when it refuses the report", async () => {
      answer(
        { error: "tx must be a 0x transaction hash of 64 hex characters" },
        { ok: false, status: 400 },
      );

      const result = await provider.reportDelivery({ tx: "0x12", delivered: true, payTo: null });

      expect(result).toBe(
        "Error reporting delivery: tx must be a 0x transaction hash of 64 hex characters",
      );
    });

    it("handles network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.reportDelivery({ tx, delivered: true, payTo: null });

      expect(result).toBe("Error reporting delivery: Network error");
    });
  });

  describe("API key", () => {
    it("is sent when configured", async () => {
      answer({ verdict: "ok", advice: "x" });

      await keptvowActionProvider({ apiKey: "kv_test" }).checkPayment({
        payTo: wallet,
        amountUsd: null,
      });

      expect(fetchMock.mock.calls[0][1].headers).toEqual({
        Accept: "application/json",
        "X-Api-Key": "kv_test",
      });
    });

    it("is read from KEPTVOW_API_KEY", async () => {
      process.env.KEPTVOW_API_KEY = "kv_env";
      answer({ verdict: "ok", advice: "x" });

      await keptvowActionProvider().checkPayment({ payTo: wallet, amountUsd: null });

      expect(fetchMock.mock.calls[0][1].headers["X-Api-Key"]).toBe("kv_env");
    });
  });

  describe("supportsNetwork", () => {
    it("supports every network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
