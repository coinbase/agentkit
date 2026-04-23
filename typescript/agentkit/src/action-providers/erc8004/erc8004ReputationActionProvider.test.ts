import {
  erc8004ReputationActionProvider,
  ERC8004ReputationActionProvider,
} from "./erc8004ReputationActionProvider";
import {
  GiveFeedbackSchema,
  RevokeFeedbackSchema,
  AppendResponseSchema,
  GetAgentFeedbackSchema,
} from "./reputationSchemas";
import { EvmWalletProvider } from "../../wallet-providers";
import * as utils from "./utils";

// Mock utils to avoid loading the ESM-only agent0-sdk at module load time
jest.mock("./utils", () => ({
  getAgent0SDK: jest.fn(),
}));

const MOCK_AGENT_ID = "123";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_CLIENT_ADDRESS = "0x9876543210987654321098765432109876543210";
const TRANSACTION_HASH = "0xabcdef1234567890";
const MOCK_FEEDBACK_INDEX = "0";

describe("Reputation Schema Validation", () => {
  describe("GiveFeedbackSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        valueDecimals: 0,
        tag1: "quality",
        tag2: "response-time",
      };

      const result = GiveFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with defaults", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
      };

      const result = GiveFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data?.valueDecimals).toBe(0);
    });

    it("should accept large values per ERC-8004 int128 spec", () => {
      // Uptime 99.77% -> value=9977, valueDecimals=2
      const uptimeInput = {
        agentId: MOCK_AGENT_ID,
        value: 9977,
        valueDecimals: 2,
        tag1: "uptime",
      };
      expect(GiveFeedbackSchema.safeParse(uptimeInput).success).toBe(true);

      // Response time 560ms
      const responseTimeInput = {
        agentId: MOCK_AGENT_ID,
        value: 560,
        valueDecimals: 0,
        tag1: "responseTime",
      };
      expect(GiveFeedbackSchema.safeParse(responseTimeInput).success).toBe(true);

      // Revenues $560
      const revenuesInput = {
        agentId: MOCK_AGENT_ID,
        value: 560,
        valueDecimals: 0,
        tag1: "revenues",
      };
      expect(GiveFeedbackSchema.safeParse(revenuesInput).success).toBe(true);
    });

    it("should accept negative values for losses/negative yields", () => {
      // Trading yield -3.2%
      const yieldInput = {
        agentId: MOCK_AGENT_ID,
        value: -32,
        valueDecimals: 1,
        tag1: "tradingYield",
        tag2: "week",
      };
      expect(GiveFeedbackSchema.safeParse(yieldInput).success).toBe(true);
    });

    it("should fail parsing tag1 too long", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        tag1: "a".repeat(51),
      };

      const result = GiveFeedbackSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should reject valueDecimals greater than 18", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        valueDecimals: 19,
      };

      const result = GiveFeedbackSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept optional A2A metadata fields", () => {
      const input = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        a2aTaskId: "task-abc",
        a2aContextId: "ctx-xyz",
        a2aSkills: ["skill-one", "skill-two"],
      };
      const result = GiveFeedbackSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.a2aTaskId).toBe("task-abc");
      expect(result.data?.a2aContextId).toBe("ctx-xyz");
      expect(result.data?.a2aSkills).toEqual(["skill-one", "skill-two"]);
    });

    it("should accept optional on-chain endpoint", () => {
      const input = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        endpoint: "https://agent.example/.well-known/agent-card.json",
      };
      const result = GiveFeedbackSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.endpoint).toBe("https://agent.example/.well-known/agent-card.json");
    });
  });

  describe("RevokeFeedbackSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        feedbackIndex: MOCK_FEEDBACK_INDEX,
      };

      const result = RevokeFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = RevokeFeedbackSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("AppendResponseSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        clientAddress: MOCK_CLIENT_ADDRESS,
        feedbackIndex: MOCK_FEEDBACK_INDEX,
        responseUri: "ipfs://QmResponse123",
      };

      const result = AppendResponseSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should accept optional responseHash for non-IPFS URIs", () => {
      const inputWithHash = {
        agentId: MOCK_AGENT_ID,
        clientAddress: MOCK_CLIENT_ADDRESS,
        feedbackIndex: MOCK_FEEDBACK_INDEX,
        responseUri: "https://example.com/response.json",
        responseHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      };

      const result = AppendResponseSchema.safeParse(inputWithHash);
      expect(result.success).toBe(true);
      expect(result.data?.responseHash).toBe(inputWithHash.responseHash);
    });

    it("should reject invalid responseHash format", () => {
      const invalidHashInput = {
        agentId: MOCK_AGENT_ID,
        clientAddress: MOCK_CLIENT_ADDRESS,
        feedbackIndex: MOCK_FEEDBACK_INDEX,
        responseUri: "ipfs://QmResponse123",
        responseHash: "not-a-valid-hash",
      };

      const result = AppendResponseSchema.safeParse(invalidHashInput);
      expect(result.success).toBe(false);
    });

    it("should fail parsing invalid client address", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        clientAddress: "invalid-address",
        feedbackIndex: MOCK_FEEDBACK_INDEX,
        responseUri: "ipfs://QmResponse123",
      };

      const result = AppendResponseSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = AppendResponseSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("GetAgentFeedbackSchema", () => {
    it("should successfully parse valid input with all filters", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        reviewerAddresses: [MOCK_CLIENT_ADDRESS],
        minValue: 50,
        maxValue: 100,
        tag1: "quality",
        includeRevoked: false,
        pageSize: 20,
      };

      const result = GetAgentFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with only agentId", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
      };

      const result = GetAgentFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should accept agentId with chainId prefix", () => {
      const validInput = {
        agentId: "84532:123",
      };

      const result = GetAgentFeedbackSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject pageSize greater than 50", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        pageSize: 51,
      };

      const result = GetAgentFeedbackSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetAgentFeedbackSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

/**
 * Creates a mock TransactionHandle matching the agent0-sdk shape.
 *
 * @param hash - The transaction hash string.
 * @param result - Optional result object to include in the mined receipt.
 * @returns A mock transaction handle with hash and waitMined method.
 */
function mockTxHandle(hash: string, result: Record<string, unknown> = {}) {
  return {
    hash,
    waitMined: jest.fn().mockResolvedValue({
      receipt: { transactionHash: hash, status: "success", logs: [] },
      result,
    }),
  };
}

describe("Give Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;
  let mockSdk: {
    isAgentOwner: jest.Mock;
    giveFeedback: jest.Mock;
  };
  let getAgent0SDKSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockSdk = {
      isAgentOwner: jest.fn().mockResolvedValue(false),
      giveFeedback: jest.fn().mockResolvedValue(mockTxHandle(TRANSACTION_HASH)),
    };

    getAgent0SDKSpy = jest.spyOn(utils, "getAgent0SDK").mockReturnValue(mockSdk as never);
    actionProvider = erc8004ReputationActionProvider({ pinataJwt: "test-jwt" });
  });

  afterEach(() => {
    getAgent0SDKSpy.mockRestore();
  });

  it("should successfully submit feedback", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "quality",
      tag2: "speed",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.isAgentOwner).toHaveBeenCalledWith("84532:123", MOCK_ADDRESS);
    expect(mockSdk.giveFeedback).toHaveBeenCalledWith(
      "84532:123",
      "85",
      "quality",
      "speed",
      undefined,
      undefined,
    );
    expect(response).toContain("Feedback submitted successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("85");
    expect(response).toContain("quality");
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should successfully submit feedback with minimal input", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.giveFeedback).toHaveBeenCalled();
    expect(response).toContain("Feedback submitted successfully!");
  });

  it("should convert fixed-point value to human-readable string", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 9977,
      valueDecimals: 2,
      tag1: "uptime",
      tag2: "",
    };

    await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.giveFeedback).toHaveBeenCalledWith(
      "84532:123",
      "99.77",
      "uptime",
      "",
      undefined,
      undefined,
    );
  });

  it("should pass comment as feedbackFile", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      comment: "Great agent!",
    };

    await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.giveFeedback).toHaveBeenCalledWith("84532:123", "85", "", "", undefined, {
      comment: "Great agent!",
    });
  });

  it("should pass A2A fields in feedbackFile when Pinata is configured", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      a2aTaskId: "task-1",
      a2aContextId: "ctx-1",
      a2aSkills: ["summarize"],
    };

    await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.giveFeedback).toHaveBeenCalledWith("84532:123", "85", "", "", undefined, {
      a2aTaskId: "task-1",
      a2aContextId: "ctx-1",
      a2aSkills: ["summarize"],
    });
  });

  it("should pass on-chain endpoint to giveFeedback", async () => {
    const endpoint = "https://mcp.example.com/sse";
    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "reachable",
      tag2: "",
      endpoint,
    };

    await actionProvider.giveFeedback(mockWallet, args);

    expect(mockSdk.giveFeedback).toHaveBeenCalledWith(
      "84532:123",
      "85",
      "reachable",
      "",
      endpoint,
      undefined,
    );
  });

  it("should successfully submit feedback without Pinata JWT when no comment", async () => {
    const providerWithoutJwt = erc8004ReputationActionProvider();

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
    };

    const response = await providerWithoutJwt.giveFeedback(mockWallet, args);

    expect(response).toContain("Feedback submitted successfully!");
    expect(mockSdk.giveFeedback).toHaveBeenCalled();
  });

  it("should reject self-feedback", async () => {
    mockSdk.isAgentOwner.mockResolvedValue(true);

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(response).toContain("You cannot give feedback to your own agent");
    expect(mockSdk.giveFeedback).not.toHaveBeenCalled();
  });

  it("should handle error when SDK giveFeedback fails", async () => {
    mockSdk.giveFeedback.mockRejectedValue(new Error("Transaction failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(response).toContain("Error giving feedback");
    expect(response).toContain("Transaction failed");
  });
});

describe("Revoke Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;
  let mockSdk: { revokeFeedback: jest.Mock };
  let getAgent0SDKSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWallet = {
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockSdk = {
      revokeFeedback: jest.fn().mockResolvedValue(mockTxHandle(TRANSACTION_HASH)),
    };

    getAgent0SDKSpy = jest.spyOn(utils, "getAgent0SDK").mockReturnValue(mockSdk as never);
    actionProvider = erc8004ReputationActionProvider();
  });

  afterEach(() => {
    getAgent0SDKSpy.mockRestore();
  });

  it("should successfully revoke feedback", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.revokeFeedback(mockWallet, args);

    expect(mockSdk.revokeFeedback).toHaveBeenCalledWith("84532:123", 0);
    expect(response).toContain("Feedback revoked successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_FEEDBACK_INDEX);
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when revoking feedback fails", async () => {
    mockSdk.revokeFeedback.mockRejectedValue(new Error("Transaction failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.revokeFeedback(mockWallet, args);

    expect(response).toContain("Error revoking feedback");
  });
});

describe("Append Response Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;
  let mockSdk: { appendResponse: jest.Mock };
  let getAgent0SDKSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWallet = {
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockSdk = {
      appendResponse: jest.fn().mockResolvedValue(mockTxHandle(TRANSACTION_HASH)),
    };

    getAgent0SDKSpy = jest.spyOn(utils, "getAgent0SDK").mockReturnValue(mockSdk as never);
    actionProvider = erc8004ReputationActionProvider();
  });

  afterEach(() => {
    getAgent0SDKSpy.mockRestore();
  });

  it("should successfully append response", async () => {
    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
      responseUri: "ipfs://QmResponse",
    };

    const response = await actionProvider.appendResponse(mockWallet, args);

    const zeroHash = "0x" + "00".repeat(32);
    expect(mockSdk.appendResponse).toHaveBeenCalledWith("84532:123", MOCK_CLIENT_ADDRESS, 0, {
      uri: "ipfs://QmResponse",
      hash: zeroHash,
    });
    expect(response).toContain("Response appended successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_CLIENT_ADDRESS);
    expect(response).toContain(MOCK_FEEDBACK_INDEX);
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when appending response fails", async () => {
    mockSdk.appendResponse.mockRejectedValue(new Error("Transaction failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
      responseUri: "ipfs://QmResponse",
    };

    const response = await actionProvider.appendResponse(mockWallet, args);

    expect(response).toContain("Error appending response");
  });
});

describe("Get Agent Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;
  let mockSdk: { searchFeedback: jest.Mock };
  let getAgent0SDKSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWallet = {
      getPublicClient: jest.fn().mockReturnValue({ transport: { url: "https://rpc.example.com" } }),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockSdk = {
      searchFeedback: jest.fn(),
    };

    getAgent0SDKSpy = jest.spyOn(utils, "getAgent0SDK").mockReturnValue(mockSdk as never);
    actionProvider = erc8004ReputationActionProvider();
  });

  afterEach(() => {
    getAgent0SDKSpy.mockRestore();
  });

  it("should successfully get agent feedback", async () => {
    mockSdk.searchFeedback.mockResolvedValue([
      {
        reviewer: MOCK_CLIENT_ADDRESS,
        value: 85,
        tags: ["quality"],
        isRevoked: false,
        createdAt: 1700000000,
      },
    ]);

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getAgentFeedback(mockWallet, args);

    expect(mockSdk.searchFeedback).toHaveBeenCalledWith(
      { agentId: "84532:123", reviewers: undefined, includeRevoked: false },
      { minValue: undefined, maxValue: undefined },
    );
    expect(response).toContain("Feedback for Agent");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("Reviewer:");
    expect(response).toContain("Value: 85");
    expect(response).toContain("Tags: quality");
  });

  it("should include A2A metadata when present on feedback", async () => {
    mockSdk.searchFeedback.mockResolvedValue([
      {
        reviewer: MOCK_CLIENT_ADDRESS,
        value: 85,
        tags: ["quality"],
        isRevoked: false,
        createdAt: 1700000000,
        a2aTaskId: "task-99",
        a2aContextId: "ctx-88",
        a2aSkills: ["fetch", "reply"],
      },
    ]);

    const response = await actionProvider.getAgentFeedback(mockWallet, { agentId: MOCK_AGENT_ID });

    expect(response).toContain("A2A task: task-99");
    expect(response).toContain("A2A context: ctx-88");
    expect(response).toContain("A2A skills: fetch, reply");
  });

  it("should handle multiple feedback entries", async () => {
    mockSdk.searchFeedback.mockResolvedValue([
      { reviewer: MOCK_CLIENT_ADDRESS, value: 85, tags: ["quality"], isRevoked: false },
      {
        reviewer: "0xabcdef1234567890123456789012345678901234",
        value: 90,
        tags: ["speed"],
        isRevoked: false,
      },
    ]);

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getAgentFeedback(mockWallet, args);

    expect(response).toContain("2 entries");
    expect(response).toContain("Value: 85");
    expect(response).toContain("Value: 90");
  });

  it("should apply filters correctly", async () => {
    mockSdk.searchFeedback.mockResolvedValue([]);

    const args = {
      agentId: MOCK_AGENT_ID,
      reviewerAddresses: [MOCK_CLIENT_ADDRESS],
      minValue: 50,
      maxValue: 100,
      includeRevoked: true,
    };

    await actionProvider.getAgentFeedback(mockWallet, args);

    expect(mockSdk.searchFeedback).toHaveBeenCalledWith(
      { agentId: "84532:123", reviewers: [MOCK_CLIENT_ADDRESS], includeRevoked: true },
      { minValue: 50, maxValue: 100 },
    );
  });

  it("should handle agent with no feedback", async () => {
    mockSdk.searchFeedback.mockResolvedValue([]);

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getAgentFeedback(mockWallet, args);

    expect(response).toContain("has no feedback yet");
  });

  it("should respect pageSize limit", async () => {
    const manyFeedback = Array(30).fill({
      reviewer: MOCK_CLIENT_ADDRESS,
      value: 85,
      tags: ["quality"],
      isRevoked: false,
    });
    mockSdk.searchFeedback.mockResolvedValue(manyFeedback);

    const args = {
      agentId: MOCK_AGENT_ID,
      pageSize: 10,
    };

    const response = await actionProvider.getAgentFeedback(mockWallet, args);

    expect(response).toContain("10 entries");
    expect(response).toContain("20 more results available");
  });

  it("should handle error when getting feedback fails", async () => {
    mockSdk.searchFeedback.mockRejectedValue(new Error("SDK error"));

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getAgentFeedback(mockWallet, args);

    expect(response).toContain("Error getting agent feedback");
  });
});

describe("supportsNetwork", () => {
  const actionProvider = erc8004ReputationActionProvider();

  it("should return true for supported EVM networks", () => {
    expect(
      actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    ).toBe(true);
  });

  it("should return false for non-EVM networks", () => {
    expect(
      actionProvider.supportsNetwork({
        protocolFamily: "solana",
      }),
    ).toBe(false);
  });

  it("should return false for unsupported EVM networks", () => {
    expect(
      actionProvider.supportsNetwork({
        protocolFamily: "evm",
        networkId: "arbitrum-mainnet",
      }),
    ).toBe(false);
  });
});
