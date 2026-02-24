import {
  erc8004IdentityActionProvider,
  ERC8004IdentityActionProvider,
} from "./erc8004IdentityActionProvider";
import {
  RegisterAgentSchema,
  UpdateAgentMetadataSchema,
  SearchAgentsSchema,
  GetAgentInfoSchema,
} from "./identitySchemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { getAgent0SDK } from "./utils";

// Configurable reject reason for updateAgentMetadata Agent mock (set in tests before calling)
let updateAgentMockRejectReason: string | null = null;

// Mock agent0-sdk (ESM-only) before loading the identity provider
jest.mock("agent0-sdk", () => {
  /** Mock Agent class simulating agent0-sdk Agent behavior for tests. */
  const MockAgent = class {
    updateInfo = jest.fn();
    getRegistrationFile = jest.fn(() => this.regFile);
    registerIPFS = jest.fn().mockImplementation(() => {
      if (updateAgentMockRejectReason) {
        return Promise.reject(new Error(updateAgentMockRejectReason));
      }
      return Promise.resolve({
        hash: "0xhash",
        waitMined: () => Promise.resolve({ result: { agentURI: "ipfs://Qm" } }),
      });
    });
    setAgentURI = jest.fn().mockImplementation(() => {
      if (updateAgentMockRejectReason) {
        return Promise.reject(new Error(updateAgentMockRejectReason));
      }
      return Promise.resolve({
        hash: "0xhash",
        waitMined: () => Promise.resolve({}),
      });
    });

    /**
     * Creates a new MockAgent instance.
     *
     * @param _sdk - The SDK instance (unused).
     * @param regFile - The registration file object.
     */
    constructor(
      _sdk: unknown,
      private regFile: Record<string, unknown>,
    ) {}
  };
  return {
    Agent: MockAgent,
    IDENTITY_REGISTRY_ABI: [],
  };
});

const MOCK_AGENT_ID = "123";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const _MOCK_URI = "ipfs://QmTest123456789";
const _TRANSACTION_HASH = "0xabcdef1234567890";

describe("Identity Schema Validation", () => {
  describe("RegisterAgentSchema", () => {
    it("should successfully parse empty input (all fields optional)", () => {
      const validInput = {};
      const result = RegisterAgentSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it("should successfully parse input with all fields", () => {
      const validInput = {
        name: "Test Agent",
        description: "A test agent",
        image: "https://example.com/image.png",
      };

      const result = RegisterAgentSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with only name", () => {
      const validInput = {
        name: "Test Agent",
      };

      const result = RegisterAgentSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should fail parsing empty name", () => {
      const invalidInput = {
        name: "",
      };

      const result = RegisterAgentSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing name too long", () => {
      const invalidInput = {
        name: "a".repeat(101),
      };

      const result = RegisterAgentSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing description too long", () => {
      const invalidInput = {
        name: "Test Agent",
        description: "a".repeat(501),
      };

      const result = RegisterAgentSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("UpdateAgentMetadataSchema", () => {
    it("should successfully parse valid input with all fields", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        name: "Updated Agent",
        description: "Updated description",
        image: "https://example.com/new-image.png",
      };

      const result = UpdateAgentMetadataSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with only agentId (updates nothing)", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
      };

      const result = UpdateAgentMetadataSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should successfully parse input with partial fields", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        description: "New description only",
      };

      const result = UpdateAgentMetadataSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should fail parsing empty name", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        name: "",
      };

      const result = UpdateAgentMetadataSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing without agentId", () => {
      const invalidInput = {
        name: "Test Agent",
      };

      const result = UpdateAgentMetadataSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("SearchAgentsSchema", () => {
    it("should successfully parse empty input (all fields optional)", () => {
      const validInput = {};
      const result = SearchAgentsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it("should successfully parse input with all filters", () => {
      const validInput = {
        name: "AI",
        mcpTools: ["code_generation", "data_analysis"],
        a2aSkills: ["python"],
        oasfSkills: ["data_engineering/data_transformation_pipeline"],
        oasfDomains: ["finance_and_business/investment_services"],
        active: true,
        x402support: true,
        minReputation: 70,
        maxReputation: 100,
        limit: 10,
        offset: 5,
      };

      const result = SearchAgentsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(validInput);
    });

    it("should successfully parse input with only name filter", () => {
      const validInput = {
        name: "Trading Bot",
      };

      const result = SearchAgentsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should fail parsing limit below minimum", () => {
      const invalidInput = {
        limit: 0,
      };

      const result = SearchAgentsSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing limit above maximum", () => {
      const invalidInput = {
        limit: 100,
      };

      const result = SearchAgentsSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing negative offset", () => {
      const invalidInput = {
        offset: -1,
      };

      const result = SearchAgentsSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("GetAgentInfoSchema", () => {
    it("should successfully parse valid input with simple agentId", () => {
      const validInput = { agentId: MOCK_AGENT_ID };
      const result = GetAgentInfoSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse valid input with chainId:agentId format", () => {
      const validInput = { agentId: "84532:123" };
      const result = GetAgentInfoSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetAgentInfoSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Register Agent Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const { mockAgent, mockSdk } = createRegisterAgentMocks();

  beforeEach(() => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockGetAgent0SDK.mockImplementation((_w, jwt) => {
      if (!jwt) throw new Error("PINATA_JWT is required");
      return mockSdk as never;
    });
  });

  it("should fail without Pinata JWT", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const response = await providerWithoutJwt.registerAgent(mockWallet, {});

    expect(response).toContain("Error: PINATA_JWT is required");
  });

  it("should handle error when registration fails", async () => {
    mockAgent.registerIPFS.mockRejectedValueOnce(new Error("Transaction failed"));

    const actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });

    const response = await actionProvider.registerAgent(mockWallet, {});

    expect(mockSdk.createAgent).toHaveBeenCalled();
    expect(response).toContain("Error during registration");
  });
});

describe("Update Agent Metadata Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const mockUpdateSdk = {
    loadAgent: jest.fn().mockRejectedValue(new Error("loadAgent fails for data URIs")),
    identityRegistryAddress: jest
      .fn()
      .mockReturnValue("0x1234567890123456789012345678901234567890"),
  };

  beforeEach(() => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    updateAgentMockRejectReason = null;
    mockGetAgent0SDK.mockImplementation((_w, jwt) => {
      if (!jwt) throw new Error("PINATA_JWT is required");
      return mockUpdateSdk as never;
    });
  });

  it("should fail without Pinata JWT", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const args = {
      agentId: MOCK_AGENT_ID,
      description: "New description",
    };

    const response = await providerWithoutJwt.updateAgentMetadata(mockWallet, args);

    expect(response).toContain("Error: PINATA_JWT is required");
  });

  it("should fail when agent has no URI set", async () => {
    updateAgentMockRejectReason = "Agent has no registration URI set";
    mockWallet.readContract.mockResolvedValue(null);

    const actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });

    const args = {
      agentId: MOCK_AGENT_ID,
      description: "New description",
    };

    const response = await actionProvider.updateAgentMetadata(mockWallet, args);

    expect(response).toContain("has no registration URI set");
  });

  it("should handle error when updating metadata fails", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Read failed"));

    const actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });

    const args = {
      agentId: MOCK_AGENT_ID,
      description: "New description",
    };

    const response = await actionProvider.updateAgentMetadata(mockWallet, args);

    expect(response).toContain("Error updating agent metadata");
  });
});

// Mock the utils module (avoid loading real utils which imports the ESM-only agent0-sdk)
jest.mock("./utils", () => {
  const { Agent } = jest.requireMock("agent0-sdk");
  return {
    getAgent0SDK: jest.fn(),
    ipfsToHttpUrl: jest.fn((uri: string) => uri),
    loadOrHydrateAgent: jest
      .fn()
      .mockImplementation(
        async (
          sdk: { loadAgent: (id: string) => Promise<unknown> },
          walletProvider: { readContract: (args: unknown) => Promise<unknown> },
          fullAgentId: string,
        ) => {
          try {
            return await sdk.loadAgent(fullAgentId);
          } catch {
            // fall through to readContract path
          }
          await walletProvider.readContract({});
          return new Agent(null, {});
        },
      ),
  };
});

const mockGetAgent0SDK = getAgent0SDK as jest.MockedFunction<typeof getAgent0SDK>;

/**
 * Creates mock agent and SDK objects for use in registerAgent tests.
 *
 * @returns An object containing mockAgent and mockSdk.
 */
function createRegisterAgentMocks() {
  const mockHandle = {
    hash: "0xhash",
    waitMined: jest.fn().mockResolvedValue({
      result: { agentId: "84532:1", agentURI: "ipfs://Qm", name: "Agent" },
    }),
  };
  const mockAgent = {
    registerIPFS: jest.fn().mockResolvedValue(mockHandle),
    registerHTTP: jest.fn().mockResolvedValue(mockHandle),
    setAgentURI: jest.fn().mockResolvedValue(mockHandle),
    getRegistrationFile: jest.fn(() => ({ name: "Agent", description: "" })),
  };
  const mockSdk = {
    createAgent: jest.fn().mockReturnValue(mockAgent),
  };
  return { mockAgent, mockSdk };
}

describe("Search Agents Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;
  let mockSdk: { searchAgents: jest.Mock };

  beforeEach(() => {
    mockSdk = {
      searchAgents: jest.fn(),
    };

    mockWallet = {
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
      getPublicClient: jest.fn().mockReturnValue({
        transport: { url: "https://rpc.example.com" },
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004IdentityActionProvider();
    mockGetAgent0SDK.mockReturnValue(mockSdk as unknown as ReturnType<typeof getAgent0SDK>);
  });

  it("should successfully search agents with no filters", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      {
        agentId: "123",
        name: "Test Agent",
        description: "A test agent",
        mcpTools: ["code_generation"],
        active: true,
      },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, {});

    expect(mockSdk.searchAgents).toHaveBeenCalled();
    expect(response).toContain("Found 1 agent(s) total");
    expect(response).toContain("Test Agent");
  });

  it("should return no agents message when none found", async () => {
    mockSdk.searchAgents.mockResolvedValue([]);

    const response = await actionProvider.searchAgents(mockWallet, {});

    expect(response).toContain("No agents found");
  });

  it("should return limited results using action-level pagination", async () => {
    // SDK now returns all results in a single call (no cursor-based pagination in 1.5.x)
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Agent 1" },
      { agentId: "2", name: "Agent 2" },
      { agentId: "3", name: "Agent 3" },
    ]);

    // Request with limit=2, should show first 2 of 3 total
    const response = await actionProvider.searchAgents(mockWallet, { limit: 2 });

    expect(mockSdk.searchAgents).toHaveBeenCalledTimes(1);
    expect(response).toContain("Found 3 agent(s) total");
    expect(response).toContain("showing 1-2");
    expect(response).toContain("Agent 1");
    expect(response).toContain("Agent 2");
    expect(response).not.toContain("Agent 3");
    expect(response).toContain("More results available");
    expect(response).toContain("offset: 2");
  });

  it("should pass name filter to SDK and return matching agents", async () => {
    // SDK handles name filtering server-side in 1.5.x; single call, returns matching agents
    mockSdk.searchAgents.mockResolvedValue([{ agentId: "2", name: "myAwesomeAgent" }]);

    const response = await actionProvider.searchAgents(mockWallet, { name: "awesome" });

    expect(mockSdk.searchAgents).toHaveBeenCalledTimes(1);
    expect(mockSdk.searchAgents).toHaveBeenCalledWith(expect.objectContaining({ name: "awesome" }));
    expect(response).toContain("Found 1 agent(s) total");
    expect(response).toContain("myAwesomeAgent");
  });

  it("should support offset for pagination", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Agent 1" },
      { agentId: "2", name: "Agent 2" },
      { agentId: "3", name: "Agent 3" },
    ]);

    // Request with offset=1, limit=1
    const response = await actionProvider.searchAgents(mockWallet, { offset: 1, limit: 1 });

    expect(response).toContain("Found 3 agent(s) total");
    expect(response).toContain("showing 2-2");
    expect(response).toContain("Agent 2");
    expect(response).not.toContain("Agent 1");
    expect(response).not.toContain("Agent 3");
  });

  it("should handle errors gracefully", async () => {
    mockSdk.searchAgents.mockRejectedValue(new Error("Network error"));

    const response = await actionProvider.searchAgents(mockWallet, {});

    expect(response).toContain("Error searching agents");
  });
});

describe("Get Agent Info Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;
  let mockSdk: { getAgent: jest.Mock };

  beforeEach(() => {
    mockSdk = {
      getAgent: jest.fn(),
    };

    mockWallet = {
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
      getPublicClient: jest.fn().mockReturnValue({
        transport: { url: "https://rpc.example.com" },
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004IdentityActionProvider();
    mockGetAgent0SDK.mockReturnValue(mockSdk as unknown as ReturnType<typeof getAgent0SDK>);
  });

  it("should successfully get agent info", async () => {
    mockSdk.getAgent.mockResolvedValue({
      agentId: "123",
      name: "Test Agent",
      description: "A comprehensive test agent",
      owners: [MOCK_ADDRESS],
      mcp: true,
      mcpTools: ["code_generation", "data_analysis"],
      a2aSkills: ["python"],
      active: true,
      x402support: true,
    });

    const response = await actionProvider.getAgentInfo(mockWallet, { agentId: "123" });

    expect(mockSdk.getAgent).toHaveBeenCalledWith("84532:123");
    expect(response).toContain("Agent 123");
    expect(response).toContain("Test Agent");
    expect(response).toContain("code_generation");
    expect(response).toContain("Active: true");
  });

  it("should handle chainId:agentId format", async () => {
    mockSdk.getAgent.mockResolvedValue({
      agentId: "11155111:456",
      name: "Chain-specific Agent",
    });

    const response = await actionProvider.getAgentInfo(mockWallet, { agentId: "11155111:456" });

    expect(mockSdk.getAgent).toHaveBeenCalledWith("11155111:456");
    expect(response).toContain("Chain-specific Agent");
  });

  it("should return not found for missing agent", async () => {
    mockSdk.getAgent.mockResolvedValue(null);

    const response = await actionProvider.getAgentInfo(mockWallet, { agentId: "999" });

    expect(response).toContain("not found");
  });

  it("should handle errors gracefully", async () => {
    mockSdk.getAgent.mockRejectedValue(new Error("Network error"));

    const response = await actionProvider.getAgentInfo(mockWallet, { agentId: "123" });

    expect(response).toContain("Error getting agent info");
  });
});

describe("supportsNetwork", () => {
  const actionProvider = erc8004IdentityActionProvider();

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
