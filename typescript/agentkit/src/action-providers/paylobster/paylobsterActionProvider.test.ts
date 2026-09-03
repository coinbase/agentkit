import { encodeFunctionData, parseUnits } from "viem";
import { paylobsterActionProvider } from "./paylobsterActionProvider";
import {
  PAYLOBSTER_CONTRACTS,
  IDENTITY_ABI,
  REPUTATION_ABI,
  CREDIT_ABI,
  ESCROW_ABI,
  USDC_ABI,
} from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";

describe("PayLobster Action Provider", () => {
  const MOCK_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_RECIPIENT = "0x9876543210987654321098765432109876543210";
  const MOCK_TX_HASH = "0xmockhash";

  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = paylobsterActionProvider();

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", chainId: "8453" }),
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      readContract: jest.fn(),
      call: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue(MOCK_TX_HASH as `0x${string}`);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  describe("registerIdentity", () => {
    it("should successfully register an agent identity", async () => {
      const args = {
        name: "TestBot",
        agentURI: "ipfs://Qm...",
        capabilities: "trading,analysis",
      };

      const response = await actionProvider.registerIdentity(mockWallet, args);
      const result = JSON.parse(response);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: PAYLOBSTER_CONTRACTS.IDENTITY,
        data: encodeFunctionData({
          abi: IDENTITY_ABI,
          functionName: "register",
          args: [args.agentURI, args.name, args.capabilities],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(result.success).toBe(true);
      expect(result.agentName).toBe("TestBot");
    });

    it("should handle registration errors", async () => {
      const error = new Error("Registration failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const args = {
        name: "TestBot",
        agentURI: "ipfs://Qm...",
        capabilities: "trading",
      };

      const response = await actionProvider.registerIdentity(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to register identity");
    });
  });

  describe("createEscrow", () => {
    it("should successfully create an escrow", async () => {
      const args = {
        recipient: MOCK_RECIPIENT,
        amount: "100",
        description: "Payment for services",
      };

      const amount = parseUnits(args.amount, 6);

      const response = await actionProvider.createEscrow(mockWallet, args);
      const result = JSON.parse(response);

      // Check approve transaction
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: PAYLOBSTER_CONTRACTS.USDC,
        data: encodeFunctionData({
          abi: USDC_ABI,
          functionName: "approve",
          args: [PAYLOBSTER_CONTRACTS.ESCROW_V3, amount],
        }),
      });

      // Check escrow creation
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: PAYLOBSTER_CONTRACTS.ESCROW_V3,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "createEscrow",
          args: [MOCK_RECIPIENT, amount, PAYLOBSTER_CONTRACTS.USDC, args.description],
        }),
      });

      expect(result.success).toBe(true);
      expect(result.amount).toBe("100");
      expect(result.recipient).toBe(MOCK_RECIPIENT);
    });

    it("should handle escrow creation errors", async () => {
      const error = new Error("Escrow creation failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const args = {
        recipient: MOCK_RECIPIENT,
        amount: "100",
        description: "Payment for services",
      };

      const response = await actionProvider.createEscrow(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create escrow");
    });
  });

  describe("releaseEscrow", () => {
    it("should successfully release an escrow", async () => {
      const args = {
        escrowId: "42",
      };

      const response = await actionProvider.releaseEscrow(mockWallet, args);
      const result = JSON.parse(response);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: PAYLOBSTER_CONTRACTS.ESCROW_V3,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "releaseEscrow",
          args: [BigInt(42)],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(result.success).toBe(true);
      expect(result.escrowId).toBe("42");
    });

    it("should handle release errors", async () => {
      const error = new Error("Release failed");
      mockWallet.sendTransaction.mockRejectedValue(error);

      const args = {
        escrowId: "42",
      };

      const response = await actionProvider.releaseEscrow(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to release escrow");
    });
  });

  describe("checkReputation", () => {
    it("should successfully check reputation", async () => {
      mockWallet.readContract.mockResolvedValue([BigInt(850), BigInt(100)]);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.checkReputation(mockWallet, args);
      const result = JSON.parse(response);

      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: PAYLOBSTER_CONTRACTS.REPUTATION,
        abi: REPUTATION_ABI,
        functionName: "getReputation",
        args: [MOCK_ADDRESS],
      });

      expect(result.success).toBe(true);
      expect(result.score).toBe("850");
      expect(result.trustVector).toBe("100");
    });

    it("should handle reputation check errors", async () => {
      const error = new Error("Query failed");
      mockWallet.readContract.mockRejectedValue(error);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.checkReputation(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to check reputation");
    });
  });

  describe("getCreditScore", () => {
    it("should successfully get credit score and status", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(BigInt(750)) // credit score
        .mockResolvedValueOnce([
          // credit status
          parseUnits("10000", 6), // limit
          parseUnits("7500", 6), // available
          parseUnits("2500", 6), // in use
        ]);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getCreditScore(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(true);
      expect(result.creditScore).toBe("750");
      expect(result.creditLimit).toBe("10000.0 USDC");
      expect(result.availableCredit).toBe("7500.0 USDC");
      expect(result.creditInUse).toBe("2500.0 USDC");
    });

    it("should handle credit score errors", async () => {
      const error = new Error("Query failed");
      mockWallet.readContract.mockRejectedValue(error);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getCreditScore(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get credit score");
    });
  });

  describe("getAgentProfile", () => {
    it("should successfully get a registered agent profile", async () => {
      mockWallet.readContract.mockResolvedValue(["TestAgent", BigInt(42), true]);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getAgentProfile(mockWallet, args);
      const result = JSON.parse(response);

      expect(mockWallet.readContract).toHaveBeenCalledWith({
        address: PAYLOBSTER_CONTRACTS.IDENTITY,
        abi: IDENTITY_ABI,
        functionName: "getAgentInfo",
        args: [MOCK_ADDRESS],
      });

      expect(result.success).toBe(true);
      expect(result.registered).toBe(true);
      expect(result.name).toBe("TestAgent");
      expect(result.agentId).toBe("42");
    });

    it("should handle unregistered agents", async () => {
      mockWallet.readContract.mockResolvedValue(["", BigInt(0), false]);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getAgentProfile(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(true);
      expect(result.registered).toBe(false);
    });

    it("should handle profile query errors", async () => {
      const error = new Error("Query failed");
      mockWallet.readContract.mockRejectedValue(error);

      const args = {
        address: MOCK_ADDRESS,
      };

      const response = await actionProvider.getAgentProfile(mockWallet, args);
      const result = JSON.parse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get agent profile");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for Base Mainnet (chain ID 8453)", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        chainId: "8453",
        networkId: "base-mainnet",
      });
      expect(result).toBe(true);
    });

    it("should return false for other EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "evm",
        chainId: "1",
        networkId: "ethereum-mainnet",
      });
      expect(result).toBe(false);
    });

    it("should return false for non-EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "bitcoin-mainnet",
      });
      expect(result).toBe(false);
    });
  });
});
