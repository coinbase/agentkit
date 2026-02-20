import { Network } from "../../network";
import { robomoustachioActionProvider } from "./robomoustachioActionProvider";

const fetchMock = jest.fn();
global.fetch = fetchMock;

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
): Response {
  const lowerHeaders = new Map<string, string>(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => lowerHeaders.get(name.toLowerCase()) ?? null,
    },
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe("RobomoustachioActionProvider", () => {
  const provider = robomoustachioActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("supports Base mainnet only", () => {
    const baseMainnet: Network = { protocolFamily: "evm", chainId: "8453", networkId: "base-mainnet" };
    const baseSepolia: Network = { protocolFamily: "evm", chainId: "84532", networkId: "base-sepolia" };
    const ethereumMainnet: Network = { protocolFamily: "evm", chainId: "1", networkId: "ethereum" };

    expect(provider.supportsNetwork(baseMainnet)).toBe(true);
    expect(provider.supportsNetwork(baseSepolia)).toBe(false);
    expect(provider.supportsNetwork(ethereumMainnet)).toBe(false);
  });

  it("returns trust score for successful response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, {
        agentId: "2",
        score: 950,
        confidence: 1,
      }),
    );

    const result = JSON.parse(await provider.getAgentTrustScore({ agentId: "2" }));

    expect(result.success).toBe(true);
    expect(result.mode).toBe("demo");
    expect(result.score).toBe(950);
    expect(result.verdict).toBe("TRUSTED");
  });

  it("returns a structured error when score endpoint returns 404", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(404, {
        error: "Score not found for agent",
      }),
    );

    const result = JSON.parse(await provider.getAgentTrustScore({ agentId: "6" }));

    expect(result.success).toBe(false);
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.status).toBe(404);
  });

  it("surfaces payment requirement details when demo mode is disabled", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(402, {
        error: "X-PAYMENT header is required",
      }),
    );

    const result = JSON.parse(await provider.getAgentTrustScore({ agentId: "1", demo: false }));

    expect(result.success).toBe(false);
    expect(result.status).toBe(402);
    expect(result.error).toContain("Payment required");
  });

  it("returns report fields for successful report response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, {
        agentId: "3",
        score: 400,
        confidence: 0.4,
        totalFeedback: 20,
        positiveFeedback: 8,
        flagged: true,
        riskFactors: ["high_negative_feedback_ratio"],
      }),
    );

    const result = JSON.parse(await provider.getAgentTrustReport({ agentId: "3" }));

    expect(result.success).toBe(true);
    expect(result.flagged).toBe(true);
    expect(result.riskFactors).toEqual(["high_negative_feedback_ratio"]);
    expect(result.verdict).toBe("CAUTION");
  });

  it("evaluateAgentRisk approves when score meets threshold and not flagged", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(200, {
          agentId: "2",
          score: 880,
          confidence: 0.9,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          agentId: "2",
          flagged: false,
          riskFactors: [],
        }),
      );

    const result = JSON.parse(
      await provider.evaluateAgentRisk({
        agentId: "2",
        scoreThreshold: 700,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.verdict).toBe("APPROVED");
    expect(result.flagged).toBe(false);
  });

  it("evaluateAgentRisk rejects when score endpoint is unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(500, {
          error: "Internal error",
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          agentId: "5",
          flagged: true,
        }),
      );

    const result = JSON.parse(await provider.evaluateAgentRisk({ agentId: "5" }));

    expect(result.success).toBe(false);
    expect(result.verdict).toBe("REJECTED");
    expect(result.reason).toContain("Defaulting to REJECTED");
  });

  it("evaluateAgentRisk rejects when flagged even if score is high", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(200, {
          agentId: "7",
          score: 900,
          confidence: 0.95,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          agentId: "7",
          flagged: true,
          riskFactors: ["manual_flag"],
        }),
      );

    const result = JSON.parse(await provider.evaluateAgentRisk({ agentId: "7" }));

    expect(result.success).toBe(true);
    expect(result.verdict).toBe("REJECTED");
    expect(result.reason).toContain("flagged");
  });
});

