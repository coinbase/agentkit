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

// Mock agent0-sdk (ESM-only) before loading the identity provider
jest.mock("agent0-sdk", () => ({}));

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
      expect(result.data).toEqual({ limit: 10, offset: 0 });
    });

    it("should successfully parse input with all filters", () => {
      const validInput = {
        keyword: "financial data analysis",
        name: "AI",
        description: "financial",
        require: ["mcp", "active", "x402"],
        minReputation: 70,
        maxReputation: 100,
        reputationTag: "enterprise",
        sort: "averageValue:desc",
        limit: 10,
        offset: 5,
      };

      const result = SearchAgentsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(validInput);
    });

    it("should strip unknown fields like networkId (schema does not validate it)", () => {
      const inputWithUnknownField = {
        networkId: "unsupported-network",
      };

      const result = SearchAgentsSchema.safeParse(inputWithUnknownField);

      expect(result.success).toBe(true);
      // networkId is not in schema stripped; limit and offset use schema defaults
      expect(result.data).toEqual({ limit: 10, offset: 0 });
    });

    it("should successfully parse input with only keyword", () => {
      const validInput = {
        keyword: "agent that can analyze trading data",
      };

      const result = SearchAgentsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
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

    mockGetAgent0SDK.mockReturnValue(mockSdk as never);
  });

  it("should register without Pinata JWT (always on-chain)", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const response = await providerWithoutJwt.registerAgent(mockWallet, {});

    expect(mockSdk.createAgent).toHaveBeenCalled();
    expect(mockAgent.registerOnChain).toHaveBeenCalled();
    expect(response).toContain("Agent registered successfully!");
  });

  it("should handle error when registration fails", async () => {
    mockAgent.registerOnChain.mockRejectedValueOnce(new Error("Transaction failed"));

    const actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });

    const response = await actionProvider.registerAgent(mockWallet, {});

    expect(mockSdk.createAgent).toHaveBeenCalled();
    expect(response).toContain("Error during registration");
  });
});

describe("Update Agent Metadata Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const mockHandle = {
    hash: "0xhash",
    waitMined: jest.fn().mockResolvedValue({
      result: { agentURI: "onchain://data" },
    }),
  };
  const mockAgent = {
    updateInfo: jest.fn(),
    registerOnChain: jest.fn().mockResolvedValue(mockHandle),
  };
  const mockUpdateSdk = {
    loadAgent: jest.fn().mockResolvedValue(mockAgent),
  };

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

    mockGetAgent0SDK.mockReturnValue(mockUpdateSdk as never);
    mockUpdateSdk.loadAgent.mockResolvedValue(mockAgent);
    mockAgent.registerOnChain.mockResolvedValue(mockHandle);
  });

  it("should update metadata without Pinata JWT (always on-chain)", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const args = {
      agentId: MOCK_AGENT_ID,
      description: "New description",
    };

    const response = await providerWithoutJwt.updateAgentMetadata(mockWallet, args);

    expect(mockUpdateSdk.loadAgent).toHaveBeenCalledWith("84532:123");
    expect(mockAgent.registerOnChain).toHaveBeenCalled();
    expect(response).toContain("Agent updated successfully!");
  });

  it("should fail when loadAgent fails", async () => {
    mockUpdateSdk.loadAgent.mockRejectedValueOnce(new Error("Agent not found"));

    const actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });

    const args = {
      agentId: MOCK_AGENT_ID,
      description: "New description",
    };

    const response = await actionProvider.updateAgentMetadata(mockWallet, args);

    expect(response).toContain("Error updating agent metadata");
  });

  it("should handle error when registerOnChain fails", async () => {
    mockAgent.registerOnChain.mockRejectedValueOnce(new Error("Transaction failed"));

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
jest.mock("./utils", () => ({
  getAgent0SDK: jest.fn(),
}));

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
      result: { agentId: "84532:1", agentURI: "onchain://data", name: "Agent" },
    }),
  };
  const mockAgent = {
    registerOnChain: jest.fn().mockResolvedValue(mockHandle),
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

  it("should pass only chains when no filters are set", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      {
        agentId: "123",
        name: "Test Agent",
        description: "A test agent",
        mcpTools: ["code_generation"],
        active: true,
      },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, { limit: 10 });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith({ chains: [84532] }, expect.any(Object));
    expect(response).toContain("Found 1 agent(s)");
    expect(response).toContain("base-sepolia");
    expect(response).toContain("Test Agent");
  });

  it("should return no agents message when none found", async () => {
    mockSdk.searchAgents.mockResolvedValue([]);

    const response = await actionProvider.searchAgents(mockWallet, { limit: 10 });

    expect(response).toContain("No agents found");
  });

  it("should return limited results using action-level pagination", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Agent 1" },
      { agentId: "2", name: "Agent 2" },
      { agentId: "3", name: "Agent 3" },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, { limit: 2 });

    expect(mockSdk.searchAgents).toHaveBeenCalledTimes(1);
    expect(response).toContain("Found 3 agent(s)");
    expect(response).toContain("showing 1-2");
    expect(response).toContain("Agent 1");
    expect(response).toContain("Agent 2");
    expect(response).not.toContain("Agent 3");
    expect(response).toContain("More results available");
    expect(response).toContain("offset: 2");
  });

  it("should pass name filter to SDK and return matching agents", async () => {
    mockSdk.searchAgents.mockResolvedValue([{ agentId: "2", name: "myAwesomeAgent" }]);

    const response = await actionProvider.searchAgents(mockWallet, {
      name: "awesome",
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledTimes(1);
    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({ name: "awesome" }),
      expect.any(Object),
    );
    expect(response).toContain("Found 1 agent(s)");
    expect(response).toContain("myAwesomeAgent");
  });

  it("should pass keyword for semantic search", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Finance Bot", semanticScore: 0.92 },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, {
      keyword: "financial data analysis",
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "financial data analysis" }),
      expect.any(Object),
    );
    expect(response).toContain("Finance Bot");
    expect(response).toContain("Relevance: 0.920");
  });

  it("should pass description filter to SDK", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Data Agent", description: "Handles financial data" },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, {
      description: "financial",
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({ description: "financial" }),
      expect.any(Object),
    );
    expect(response).toContain("Data Agent");
  });

  it("should pass require filters to SDK", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "MCP Agent", mcp: "https://mcp.example.com" },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, {
      require: ["mcp", "active"],
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({ hasMCP: true, active: true }),
      expect.any(Object),
    );
    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.not.objectContaining({ hasA2A: expect.anything(), x402support: expect.anything() }),
      expect.any(Object),
    );
    expect(response).toContain("MCP Agent");
  });

  it("should use wallet network when no filters are set", async () => {
    mockSdk.searchAgents.mockResolvedValue([{ agentId: "1:5", name: "Mainnet Agent" }]);

    const response = await actionProvider.searchAgents(mockWallet, {
      limit: 10,
    });

    // Uses wallet network (base-sepolia = 84532) when no networkId in schema
    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({ chains: [84532] }),
      expect.any(Object),
    );
    expect(response).toContain("base-sepolia");
  });

  it("should pass sort option to SDK", async () => {
    mockSdk.searchAgents.mockResolvedValue([{ agentId: "1", name: "Top Agent" }]);

    await actionProvider.searchAgents(mockWallet, {
      sort: "averageValue:desc",
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ sort: ["averageValue:desc"] }),
    );
  });

  it("should pass reputation tag in feedback filters", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Enterprise Agent", averageValue: 90 },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, {
      minReputation: 80,
      reputationTag: "enterprise",
      limit: 10,
    });

    expect(mockSdk.searchAgents).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: { minValue: 80, maxValue: undefined, tag: "enterprise" },
      }),
      expect.any(Object),
    );
    expect(response).toContain("Reputation: 90");
  });

  it("should include enriched output fields", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      {
        agentId: "1",
        name: "Full Agent",
        averageValue: 85,
        feedbackCount: 12,
        mcp: "https://mcp.example.com/rpc",
        a2a: "https://agent.example/.well-known/agent-card.json",
        x402support: true,
      },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, { limit: 10 });

    expect(response).toContain("Agent ID: 1");
    expect(response).toContain("Name: Full Agent");
    expect(response).toContain("Reputation: 85");
    expect(response).toContain("Feedback count: 12");
    expect(response).toContain("MCP: Yes | A2A: Yes | x402: Yes");
  });

  it("should support offset for pagination", async () => {
    mockSdk.searchAgents.mockResolvedValue([
      { agentId: "1", name: "Agent 1" },
      { agentId: "2", name: "Agent 2" },
      { agentId: "3", name: "Agent 3" },
    ]);

    const response = await actionProvider.searchAgents(mockWallet, { offset: 1, limit: 1 });

    expect(response).toContain("Found 3 agent(s)");
    expect(response).toContain("showing 2-2");
    expect(response).toContain("Agent 2");
    expect(response).not.toContain("Agent 1");
    expect(response).not.toContain("Agent 3");
  });

  it("should handle errors gracefully", async () => {
    mockSdk.searchAgents.mockRejectedValue(new Error("Network error"));

    const response = await actionProvider.searchAgents(mockWallet, { limit: 10 });

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
      mcp: "https://mcp.test-agent.example/sse",
      a2a: "https://test-agent.example/.well-known/agent-card.json",
      mcpTools: ["code_generation", "data_analysis"],
      a2aSkills: ["python"],
      active: true,
      x402support: true,
    });

    const response = await actionProvider.getAgentInfo(mockWallet, { agentId: "123" });

    expect(mockSdk.getAgent).toHaveBeenCalledWith("84532:123");
    expect(response).toContain("Agent 123");
    expect(response).toContain("Test Agent");
    expect(response).toContain("MCP: https://mcp.test-agent.example/sse");
    expect(response).toContain("A2A: https://test-agent.example/.well-known/agent-card.json");
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
