import { actionRefVerifyActionProvider } from "./actionRefVerifyActionProvider";

describe("ActionRefVerifyActionProvider", () => {
  const provider = actionRefVerifyActionProvider();
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("computeActionRefAction", () => {
    it("derives action_ref matching the action-ref-v1 reference implementation", () => {
      // Cross-checked against argentum-core's reference implementation
      // (plugins/agt_evidence_anchor/action_ref.py) and against the
      // published worked example (giskard09/coinbase-x402-action-ref-anchor).
      const result = provider.computeActionRefAction({
        agentId: "worked-example.coinbase-x402-action-ref-anchor",
        actionType: "agentkit.x402.retry_http_request_with_x402",
        scope: "base:usdc:pay-and-fetch",
        timestamp: "2026-08-20T22:00:00.000Z",
      });
      const parsed = JSON.parse(result);
      expect(parsed.actionRef).toBe(
        "3a8b0736b88af42b32160233fb54d9dc85bef257537d83fd604225e765d2401b",
      );
      expect(parsed.anchorRefBytes32).toBe(
        "0x3a8b0736b88af42b32160233fb54d9dc85bef257537d83fd604225e765d2401b",
      );
    });

    it("is deterministic — same input always yields the same ref", () => {
      const args = {
        agentId: "agent-1",
        actionType: "test.action",
        scope: "test:scope",
        timestamp: "2026-01-01T00:00:00.000Z",
      };
      const first = provider.computeActionRefAction(args);
      const second = provider.computeActionRefAction(args);
      expect(first).toBe(second);
    });
  });

  describe("verifyActionRefAnchor", () => {
    it("returns anchored:true when a matching Anchored event is found", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: [
            {
              transactionHash: "0xabc123",
              blockNumber: "0x2fda6f8",
              topics: [
                "0xfe2289542f7a0110ac112c3a4d712afdcaaf2900a1326f4e6f340b563a0e8734",
                "0x" + "aa".repeat(32),
                "0x000000000000000000000000dcc84e9798e8eb1b1b48a31b8f35e5aa7b83dbf4",
              ],
              data: "0x0000000000000000000000000000000000000000000000000000000068a5f3a3",
            },
          ],
        }),
      });

      const result = await provider.verifyActionRefAnchor({
        actionRef: "aa".repeat(32),
        chain: "base",
      });
      const parsed = JSON.parse(result);
      expect(parsed.anchored).toBe(true);
      expect(parsed.txHash).toBe("0xabc123");
    });

    it("returns anchored:false when no event is found", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ result: [] }),
      });

      const result = await provider.verifyActionRefAnchor({
        actionRef: "bb".repeat(32),
        chain: "base",
      });
      const parsed = JSON.parse(result);
      expect(parsed.anchored).toBe(false);
    });

    it("handles RPC errors gracefully", async () => {
      fetchMock.mockRejectedValue(new Error("RPC unreachable"));

      const result = await provider.verifyActionRefAnchor({
        actionRef: "cc".repeat(32),
        chain: "base",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.details).toContain("RPC unreachable");
    });
  });

  describe("supportsNetwork", () => {
    it("returns true for any network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
