import { standingWitnessActionProvider, StandingWitnessActionProvider } from "./standingWitnessActionProvider";

describe("StandingWitnessActionProvider", () => {
  const provider = standingWitnessActionProvider();

  it("supports network", () => {
    expect(provider.supportsNetwork({} as any)).toBe(true);
  });

  it("initializes action provider with standing_witness name", () => {
    expect(provider.name).toBe("standing_witness");
  });

  describe("circuitBreakerGate", () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it("trips (BLOCKED) when payment is required (HTTP 402)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 402,
        ok: false,
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Transfer 5000 USDC",
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("Payment required (HTTP 402)");
    });

    it("trips (BLOCKED) on HTTP error (e.g. 500 Internal Error)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 500,
        ok: false,
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Transfer 5000 USDC",
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("HTTP 500");
    });

    it("trips (BLOCKED) when mock structural validation fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          mock: true,
          structurally_complete: false,
          failed: ["provenance.evidence"],
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Transfer 5000 USDC",
          mock: true,
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("Mock structural check failed");
    });

    it("trips (BLOCKED) when unauthenticated mock is returned without mock=true", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          mock: true,
          not_a_determination: true,
          structurally_complete: true,
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Transfer 5000 USDC",
          mock: false,
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("Unauthenticated mock response returned when live determination was required");
    });

    it("passes (DRY_RUN_PASSED) when mock=true and structural check succeeds", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          mock: true,
          structurally_complete: true,
          failed: [],
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Transfer 5000 USDC",
          mock: true,
        }),
      );

      expect(res.gate_status).toBe("DRY_RUN_PASSED");
      expect(res.notice).toContain("does NOT authorize real execution");
    });

    it("clears (CLEARED) when determination outcome is RECOGNIZED WITH BOUNDARIES", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          record: {
            determination: {
              outcome: "RECOGNIZED WITH BOUNDARIES",
            },
          },
          record_hash: "0xabc123",
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Deploy smart contract",
        }),
      );

      expect(res.gate_status).toBe("CLEARED");
      expect(res.outcome).toBe("RECOGNIZED WITH BOUNDARIES");
    });

    it("clears (CLEARED) when determination outcome is ESTABLISHED", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          outcome: "ESTABLISHED",
          record_hash: "0xdef456",
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Audit contract code",
        }),
      );

      expect(res.gate_status).toBe("CLEARED");
      expect(res.outcome).toBe("ESTABLISHED");
    });

    it("trips (BLOCKED) when determination outcome is INSUFFICIENTLY ESTABLISHED", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          outcome: "INSUFFICIENTLY ESTABLISHED",
        }),
      } as any);

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Execute high-risk trade",
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("does not satisfy clearing criteria");
    });

    it("trips (BLOCKED) when fetch throws network error", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

      const res = JSON.parse(
        await provider.circuitBreakerGate({
          proposedAction: "Execute transaction",
        }),
      );

      expect(res.gate_status).toBe("BLOCKED");
      expect(res.reason).toContain("Connection refused");
    });
  });

  describe("standingAudit", () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it("returns payment_required on 402", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 402,
        ok: false,
      } as any);

      const res = JSON.parse(
        await provider.standingAudit({
          subject: "0x123",
          claim: "Test claim",
        }),
      );

      expect(res.status).toBe("payment_required");
    });

    it("returns failed when mock structural check fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          mock: true,
          structurally_complete: false,
          failed: ["provenance.source"],
        }),
      } as any);

      const res = JSON.parse(
        await provider.standingAudit({
          subject: "0x123",
          claim: "Test claim",
          mock: true,
        }),
      );

      expect(res.status).toBe("failed");
      expect(res.missing_fields).toEqual(["provenance.source"]);
    });

    it("returns dry_run_passed when mock audit passes", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          mock: true,
          structurally_complete: true,
          failed: [],
        }),
      } as any);

      const res = JSON.parse(
        await provider.standingAudit({
          subject: "0x123",
          claim: "Test claim",
          mock: true,
        }),
      );

      expect(res.status).toBe("dry_run_passed");
    });

    it("returns success when live audit succeeds", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          determination: {
            outcome: "RECOGNIZED WITH BOUNDARIES",
          },
        }),
      } as any);

      const res = JSON.parse(
        await provider.standingAudit({
          subject: "0x123",
          claim: "Test claim",
        }),
      );

      expect(res.status).toBe("success");
      expect(res.determination.outcome).toBe("RECOGNIZED WITH BOUNDARIES");
    });
  });
});
