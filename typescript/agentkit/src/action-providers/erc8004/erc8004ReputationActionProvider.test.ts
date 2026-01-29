import {
  erc8004ReputationActionProvider,
  ERC8004ReputationActionProvider,
} from "./erc8004ReputationActionProvider";
import {
  GiveFeedbackSchema,
  RevokeFeedbackSchema,
  AppendResponseSchema,
  GetReputationSummarySchema,
  ReadFeedbackSchema,
  GetClientsSchema,
} from "./reputationSchemas";
import { EvmWalletProvider } from "../../wallet-providers";
import * as utilsRep from "./utils_rep";

const MOCK_AGENT_ID = "123";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_CLIENT_ADDRESS = "0x9876543210987654321098765432109876543210";
const TRANSACTION_HASH = "0xabcdef1234567890";
const MOCK_FEEDBACK_INDEX = "0";
const MOCK_IPFS_HASH = "bafkreitest123456789";
const MOCK_FEEDBACK_URI = `ipfs://${MOCK_IPFS_HASH}`;
const MOCK_FEEDBACK_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

describe("Reputation Schema Validation", () => {
  describe("GiveFeedbackSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        valueDecimals: 0,
        tag1: "quality",
        tag2: "response-time",
        endpoint: "/api/v1/chat",
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

    it("should accept optional MCP context", () => {
      const inputWithMcp = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        mcp: { tool: "getWeather" },
      };

      const result = GiveFeedbackSchema.safeParse(inputWithMcp);
      expect(result.success).toBe(true);
      expect(result.data?.mcp?.tool).toBe("getWeather");
    });

    it("should accept optional A2A context", () => {
      const inputWithA2a = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        a2a: { skills: ["skill1", "skill2"], taskId: "task-123" },
      };

      const result = GiveFeedbackSchema.safeParse(inputWithA2a);
      expect(result.success).toBe(true);
      expect(result.data?.a2a?.skills).toHaveLength(2);
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

    it("should fail parsing endpoint too long", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        value: 85,
        endpoint: "a".repeat(201),
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

  describe("GetReputationSummarySchema", () => {
    it("should successfully parse valid input with clientAddresses and tags", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        clientAddresses: [MOCK_CLIENT_ADDRESS],
        tag1: "quality",
        tag2: "speed",
      };

      const result = GetReputationSummarySchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with only required fields", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        clientAddresses: [MOCK_CLIENT_ADDRESS],
      };

      const result = GetReputationSummarySchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should accept multiple client addresses", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        clientAddresses: [
          MOCK_CLIENT_ADDRESS,
          "0xabcdef1234567890123456789012345678901234",
          "0x1111111111111111111111111111111111111111",
        ],
      };

      const result = GetReputationSummarySchema.safeParse(validInput);
      expect(result.success).toBe(true);
      expect(result.data?.clientAddresses).toHaveLength(3);
    });

    it("should fail parsing without clientAddresses (required per ERC-8004 spec)", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        tag1: "quality",
      };

      const result = GetReputationSummarySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should fail parsing with empty clientAddresses array", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        clientAddresses: [],
      };

      const result = GetReputationSummarySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should fail parsing with invalid client address format", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        clientAddresses: ["not-an-address"],
      };

      const result = GetReputationSummarySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetReputationSummarySchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("ReadFeedbackSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        clientAddress: MOCK_CLIENT_ADDRESS,
        feedbackIndex: MOCK_FEEDBACK_INDEX,
      };

      const result = ReadFeedbackSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid client address", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        clientAddress: "not-an-address",
        feedbackIndex: MOCK_FEEDBACK_INDEX,
      };

      const result = ReadFeedbackSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("GetClientsSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = { agentId: MOCK_AGENT_ID };
      const result = GetClientsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetClientsSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Give Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;
  let uploadFeedbackSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    // Create provider with Pinata JWT configured
    actionProvider = erc8004ReputationActionProvider({ pinataJwt: "test-jwt" });

    // Mock the IPFS upload function
    uploadFeedbackSpy = jest.spyOn(utilsRep, "uploadFeedbackToIPFS").mockResolvedValue({
      feedbackUri: MOCK_FEEDBACK_URI,
      feedbackHash: MOCK_FEEDBACK_HASH as `0x${string}`,
      feedbackFile: {
        agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
        agentId: 123,
        clientAddress: `eip155:84532:${MOCK_ADDRESS}`,
        createdAt: new Date().toISOString(),
        value: 85,
        valueDecimals: 0,
      },
    });
  });

  afterEach(() => {
    uploadFeedbackSpy.mockRestore();
  });

  it("should successfully submit feedback", async () => {
    mockWallet.readContract.mockResolvedValue("0xdifferentowner1234567890123456789012345678");
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "quality",
      tag2: "speed",
      endpoint: "/api/v1",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(uploadFeedbackSpy).toHaveBeenCalled();
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain("Feedback submitted successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("85");
    expect(response).toContain("quality");
    expect(response).toContain(MOCK_FEEDBACK_URI);
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should successfully submit feedback with minimal input", async () => {
    mockWallet.readContract.mockResolvedValue("0xdifferentowner1234567890123456789012345678");
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      endpoint: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(uploadFeedbackSpy).toHaveBeenCalled();
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(response).toContain("Feedback submitted successfully!");
  });

  it("should fail without Pinata JWT", async () => {
    const providerWithoutJwt = erc8004ReputationActionProvider();

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      endpoint: "",
    };

    const response = await providerWithoutJwt.giveFeedback(mockWallet, args);

    expect(response).toContain("PINATA_JWT is required");
    expect(mockWallet.sendTransaction).not.toHaveBeenCalled();
  });

  it("should handle error when IPFS upload fails", async () => {
    mockWallet.readContract.mockResolvedValue("0xdifferentowner1234567890123456789012345678");
    uploadFeedbackSpy.mockRejectedValue(new Error("IPFS upload failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      endpoint: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(response).toContain("Error giving feedback");
    expect(response).toContain("IPFS upload failed");
  });

  it("should handle error when transaction fails", async () => {
    mockWallet.readContract.mockResolvedValue("0xdifferentowner1234567890123456789012345678");
    mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      value: 85,
      valueDecimals: 0,
      tag1: "",
      tag2: "",
      endpoint: "",
    };

    const response = await actionProvider.giveFeedback(mockWallet, args);

    expect(response).toContain("Error giving feedback");
    expect(response).toContain("Transaction failed");
  });
});

describe("Revoke Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;

  beforeEach(() => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004ReputationActionProvider();
  });

  it("should successfully revoke feedback", async () => {
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});

    const args = {
      agentId: MOCK_AGENT_ID,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.revokeFeedback(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain("Feedback revoked successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_FEEDBACK_INDEX);
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when revoking feedback fails", async () => {
    mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

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

  beforeEach(() => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004ReputationActionProvider();
  });

  it("should successfully append response", async () => {
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
      responseUri: "ipfs://QmResponse",
    };

    const response = await actionProvider.appendResponse(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain("Response appended successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_CLIENT_ADDRESS);
    expect(response).toContain(MOCK_FEEDBACK_INDEX);
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when appending response fails", async () => {
    mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

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

describe("Get Reputation Summary Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;

  beforeEach(() => {
    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004ReputationActionProvider();
  });

  it("should successfully get reputation summary with clientAddresses", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(10), BigInt(850), 1]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddresses: [MOCK_CLIENT_ADDRESS],
      tag1: "",
      tag2: "",
    };

    const response = await actionProvider.getReputationSummary(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalled();
    expect(response).toContain("Reputation Summary");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("Feedback Count: 10");
    expect(response).toContain("85.0");
    expect(response).toContain("1 trusted address");
  });

  it("should successfully get reputation summary with multiple clients and tag filters", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(5), BigInt(90), 0]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddresses: [MOCK_CLIENT_ADDRESS, "0xabcdef1234567890123456789012345678901234"],
      tag1: "quality",
      tag2: "speed",
    };

    const response = await actionProvider.getReputationSummary(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalled();
    expect(response).toContain("2 trusted address");
    expect(response).toContain("quality");
    expect(response).toContain("speed");
    expect(response).toContain("Feedback Count: 5");
  });

  it("should pass clientAddresses to the contract call", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(5), BigInt(90), 0]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddresses: [MOCK_CLIENT_ADDRESS],
      tag1: "",
      tag2: "",
    };

    await actionProvider.getReputationSummary(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getSummary",
        args: [BigInt(MOCK_AGENT_ID), [MOCK_CLIENT_ADDRESS], "", ""],
      }),
    );
  });

  it("should handle error when getting summary fails", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Read failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddresses: [MOCK_CLIENT_ADDRESS],
      tag1: "",
      tag2: "",
    };

    const response = await actionProvider.getReputationSummary(mockWallet, args);

    expect(response).toContain("Error getting reputation summary");
  });
});

describe("Read Feedback Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;

  beforeEach(() => {
    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004ReputationActionProvider();
  });

  it("should successfully read feedback", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(85), 0, "quality", "speed", false]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.readFeedback(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalled();
    expect(response).toContain("Feedback Entry");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_CLIENT_ADDRESS);
    expect(response).toContain("Value: 85");
    expect(response).toContain("quality");
    expect(response).toContain("speed");
    expect(response).toContain("Revoked: No");
  });

  it("should show revoked status correctly", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(85), 0, "quality", "", true]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.readFeedback(mockWallet, args);

    expect(response).toContain("Revoked: Yes");
  });

  it("should handle feedback with decimals", async () => {
    mockWallet.readContract.mockResolvedValue([BigInt(8550), 2, "quality", "", false]);

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.readFeedback(mockWallet, args);

    expect(response).toContain("85.50");
  });

  it("should handle error when reading feedback fails", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Read failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      clientAddress: MOCK_CLIENT_ADDRESS,
      feedbackIndex: MOCK_FEEDBACK_INDEX,
    };

    const response = await actionProvider.readFeedback(mockWallet, args);

    expect(response).toContain("Error reading feedback");
  });
});

describe("Get Clients Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004ReputationActionProvider;

  beforeEach(() => {
    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004ReputationActionProvider();
  });

  it("should successfully get clients list", async () => {
    const mockClients = [MOCK_CLIENT_ADDRESS, "0xabcdef1234567890123456789012345678901234"];
    mockWallet.readContract.mockResolvedValue(mockClients);

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getClients(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalled();
    expect(response).toContain("Feedback Clients");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("Total: 2 clients");
    expect(response).toContain(MOCK_CLIENT_ADDRESS);
  });

  it("should handle empty clients list", async () => {
    mockWallet.readContract.mockResolvedValue([]);

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getClients(mockWallet, args);

    expect(response).toContain("has not received any feedback yet");
  });

  it("should handle error when getting clients fails", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Read failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
    };

    const response = await actionProvider.getClients(mockWallet, args);

    expect(response).toContain("Error getting clients");
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
        networkId: "polygon-mainnet",
      }),
    ).toBe(false);
  });
});
