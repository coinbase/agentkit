import {
  erc8004IdentityActionProvider,
  ERC8004IdentityActionProvider,
} from "./erc8004IdentityActionProvider";
import {
  RegisterAgentSchema,
  SetAgentRegistrationSchema,
  GetAgentIdentitySchema,
  SetMetadataSchema,
  GetMetadataSchema,
  RegisterAgentCompleteSchema,
} from "./identitySchemas";
import { EvmWalletProvider } from "../../wallet-providers";

const MOCK_AGENT_ID = "123";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_URI = "ipfs://QmTest123456789";
const TRANSACTION_HASH = "0xabcdef1234567890";

describe("Identity Schema Validation", () => {
  describe("RegisterAgentSchema", () => {
    it("should successfully parse empty input", () => {
      const validInput = {};
      const result = RegisterAgentSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });
  });

  describe("SetAgentRegistrationSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        name: "Test Agent",
        description: "A test agent description",
        image: "https://example.com/image.png",
      };

      const result = SetAgentRegistrationSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input without optional fields", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        name: "Test Agent",
      };

      const result = SetAgentRegistrationSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should fail parsing empty name", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        name: "",
      };

      const result = SetAgentRegistrationSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing name too long", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        name: "a".repeat(101),
      };

      const result = SetAgentRegistrationSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing description too long", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        name: "Test Agent",
        description: "a".repeat(501),
      };

      const result = SetAgentRegistrationSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = SetAgentRegistrationSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("GetAgentIdentitySchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = { agentId: MOCK_AGENT_ID };
      const result = GetAgentIdentitySchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetAgentIdentitySchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("SetMetadataSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        key: "version",
        value: "1.0.0",
      };

      const result = SetMetadataSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty key", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        key: "",
        value: "1.0.0",
      };

      const result = SetMetadataSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing key too long", () => {
      const invalidInput = {
        agentId: MOCK_AGENT_ID,
        key: "a".repeat(101),
        value: "1.0.0",
      };

      const result = SetMetadataSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("GetMetadataSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        agentId: MOCK_AGENT_ID,
        key: "version",
      };

      const result = GetMetadataSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetMetadataSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("RegisterAgentCompleteSchema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        name: "Test Agent",
        description: "A test agent",
        image: "https://example.com/image.png",
      };

      const result = RegisterAgentCompleteSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input without optional fields", () => {
      const validInput = {
        name: "Test Agent",
      };

      const result = RegisterAgentCompleteSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("should fail parsing empty name", () => {
      const invalidInput = {
        name: "",
      };

      const result = RegisterAgentCompleteSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Register Agent Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;

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

    actionProvider = erc8004IdentityActionProvider();
  });

  it("should successfully register an agent", async () => {
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({
      logs: [
        {
          topics: [
            "0x1234",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x000000000000000000000000000000000000000000000000000000000000007b",
          ],
          data: "0x",
        },
      ],
    });

    const response = await actionProvider.registerAgent(mockWallet, {});

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain("Agent registered successfully!");
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when registration fails", async () => {
    mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

    const response = await actionProvider.registerAgent(mockWallet, {});

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(response).toContain("Error registering agent");
  });
});

describe("Set Agent Registration Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let _actionProvider: ERC8004IdentityActionProvider;

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

    _actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });
  });

  it("should fail without Pinata JWT", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const args = {
      agentId: MOCK_AGENT_ID,
      name: "Test Agent",
    };

    const response = await providerWithoutJwt.setAgentRegistration(mockWallet, args);

    expect(response).toContain("Error: PINATA_JWT is required");
  });
});

describe("Get Agent Identity Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;

  beforeEach(() => {
    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004IdentityActionProvider();
  });

  it("should successfully get agent identity", async () => {
    mockWallet.readContract.mockResolvedValueOnce(MOCK_ADDRESS).mockResolvedValueOnce(MOCK_URI);

    const args = { agentId: MOCK_AGENT_ID };

    const response = await actionProvider.getAgentIdentity(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledTimes(2);
    expect(response).toContain("Agent Identity");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain(MOCK_ADDRESS);
    expect(response).toContain(MOCK_URI);
  });

  it("should handle non-existent agent", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("ERC721NonexistentToken"));

    const args = { agentId: MOCK_AGENT_ID };

    const response = await actionProvider.getAgentIdentity(mockWallet, args);

    expect(response).toContain("does not exist");
  });

  it("should handle other errors", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Network error"));

    const args = { agentId: MOCK_AGENT_ID };

    const response = await actionProvider.getAgentIdentity(mockWallet, args);

    expect(response).toContain("Error getting agent identity");
  });
});

describe("Set Metadata Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;

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

    actionProvider = erc8004IdentityActionProvider();
  });

  it("should successfully set metadata", async () => {
    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});

    const args = {
      agentId: MOCK_AGENT_ID,
      key: "version",
      value: "1.0.0",
    };

    const response = await actionProvider.setMetadata(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalled();
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain("Metadata set successfully!");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("version");
    expect(response).toContain("1.0.0");
    expect(response).toContain(TRANSACTION_HASH);
  });

  it("should handle error when setting metadata fails", async () => {
    mockWallet.sendTransaction.mockRejectedValue(new Error("Transaction failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      key: "version",
      value: "1.0.0",
    };

    const response = await actionProvider.setMetadata(mockWallet, args);

    expect(response).toContain("Error setting metadata");
  });
});

describe("Get Metadata Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let actionProvider: ERC8004IdentityActionProvider;

  beforeEach(() => {
    mockWallet = {
      readContract: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-sepolia",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    actionProvider = erc8004IdentityActionProvider();
  });

  it("should successfully get metadata", async () => {
    const valueHex = "0x312e302e30"; // "1.0.0" in hex
    mockWallet.readContract.mockResolvedValue(valueHex);

    const args = {
      agentId: MOCK_AGENT_ID,
      key: "version",
    };

    const response = await actionProvider.getMetadata(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalled();
    expect(response).toContain("Agent Metadata");
    expect(response).toContain(MOCK_AGENT_ID);
    expect(response).toContain("version");
    expect(response).toContain("1.0.0");
  });

  it("should handle empty metadata", async () => {
    mockWallet.readContract.mockResolvedValue("0x");

    const args = {
      agentId: MOCK_AGENT_ID,
      key: "nonexistent",
    };

    const response = await actionProvider.getMetadata(mockWallet, args);

    expect(response).toContain("(empty)");
  });

  it("should handle error when getting metadata fails", async () => {
    mockWallet.readContract.mockRejectedValue(new Error("Read failed"));

    const args = {
      agentId: MOCK_AGENT_ID,
      key: "version",
    };

    const response = await actionProvider.getMetadata(mockWallet, args);

    expect(response).toContain("Error getting metadata");
  });
});

describe("Register Agent Complete Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let _actionProvider: ERC8004IdentityActionProvider;
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

    _actionProvider = erc8004IdentityActionProvider({ pinataJwt: "test-jwt" });
  });

  it("should fail without Pinata JWT", async () => {
    const providerWithoutJwt = erc8004IdentityActionProvider();

    const args = {
      name: "Test Agent",
    };

    const response = await providerWithoutJwt.registerAgentComplete(mockWallet, args);

    expect(response).toContain("Error: PINATA_JWT is required");
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
        networkId: "polygon-mainnet",
      }),
    ).toBe(false);
  });
});
