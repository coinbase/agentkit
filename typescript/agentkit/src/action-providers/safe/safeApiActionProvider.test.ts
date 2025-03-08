import { safeApiActionProvider } from "./safeApiActionProvider";
import { SafeInfoSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import SafeApiKit from "@safe-global/api-kit";

// Mock the Safe API Kit
jest.mock("@safe-global/api-kit");

describe("Safe API Action Provider Input Schemas", () => {
  describe("Safe Info Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        safeAddress: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
      };

      const result = SafeInfoSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid address", () => {
      const invalidInput = {
        safeAddress: "invalid-address",
      };
      const result = SafeInfoSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = SafeInfoSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("Safe API Action Provider", () => {
  let actionProvider: ReturnType<typeof safeApiActionProvider>;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockSafeApiKit: jest.Mocked<SafeApiKit>;

  const MOCK_SAFE_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83";
  const MOCK_DELEGATE_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_TOKEN_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  const MOCK_NETWORK = "ethereum-sepolia";
  const MOCK_BALANCE = BigInt(1000000000000000000); // 1 ETH in wei

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock SafeApiKit methods first
    mockSafeApiKit = {
      getSafeInfo: jest.fn(),
      getPendingTransactions: jest.fn(),
    } as unknown as jest.Mocked<SafeApiKit>;

    // Set up the mock implementation before creating actionProvider
    (SafeApiKit as jest.Mock).mockImplementation(() => mockSafeApiKit);

    actionProvider = safeApiActionProvider({ networkId: MOCK_NETWORK });

    // Mock wallet provider
    mockWallet = {
      getPublicClient: jest.fn().mockReturnValue({
        getBalance: jest.fn().mockResolvedValue(MOCK_BALANCE),
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("safeInfo", () => {
    it("should successfully get Safe info", async () => {
      const mockSafeInfo = {
        address: MOCK_SAFE_ADDRESS,
        owners: ["0x123", "0x456"],
        threshold: 2,
        modules: ["0x789"],
        nonce: "1",
        singleton: "0x123",
        fallbackHandler: "0x456",
        guard: "0x789",
        version: "1.0.0",
      };

      const mockPendingTransactions = {
        results: [
          {
            safeTxHash: "0xabc",
            isExecuted: false,
            confirmationsRequired: 2,
            confirmations: [{ owner: "0x123" }, { owner: "0x456" }],
          },
        ],
        count: 1,
      };

      mockSafeApiKit.getSafeInfo.mockResolvedValue(mockSafeInfo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSafeApiKit.getPendingTransactions.mockResolvedValue(mockPendingTransactions as any);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      const response = await actionProvider.safeInfo(mockWallet, args);

      // Verify response contains expected information
      expect(response).toContain(`Safe at address: ${MOCK_SAFE_ADDRESS}`);
      expect(response).toContain("2 owners: 0x123, 0x456");
      expect(response).toContain("Threshold: 2");
      expect(response).toContain("Nonce: 1");
      expect(response).toContain("Modules: 0x789");
      expect(response).toContain("Balance: 1 ETH");
      expect(response).toContain("Pending transactions: 1");
      expect(response).toContain(
        "Transaction 0xabc (2/2 confirmations, confirmed by: 0x123, 0x456)",
      );
    });

    it("should handle errors when getting Safe info", async () => {
      const error = new Error("Failed to get Safe info");
      mockSafeApiKit.getSafeInfo.mockRejectedValue(error);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      const response = await actionProvider.safeInfo(mockWallet, args);
      expect(response).toBe(`Safe info: Error connecting to Safe: ${error.message}`);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = actionProvider.supportsNetwork({ protocolFamily: "evm" } as any);
      expect(result).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = actionProvider.supportsNetwork({ protocolFamily: "solana" } as any);
      expect(result).toBe(false);
    });
  });

  describe("getAllowanceInfo", () => {
    beforeEach(() => {
      // Mock additional wallet methods needed for getAllowanceInfo
      mockWallet.readContract = jest.fn();

      // Mock the getAllowanceModuleDeployment function
      jest.mock("@safe-global/safe-modules-deployments", () => ({
        getAllowanceModuleDeployment: jest.fn().mockReturnValue({
          networkAddresses: { "421614": "0xallowanceModuleAddress" },
          abi: [
            {
              name: "getTokens",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }],
              outputs: [{ type: "address[]" }],
            },
            {
              name: "getTokenAllowance",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }, { type: "address" }],
              outputs: [
                { type: "uint256" }, // amount
                { type: "uint256" }, // spent
                { type: "uint256" }, // resetTimeMin
                { type: "uint256" }, // lastResetMin
                { type: "uint256" }, // nonce
              ],
            },
          ],
        }),
      }));
    });

    it("should successfully get allowance info", async () => {
      // Mock token list response
      (mockWallet.readContract as jest.Mock).mockImplementation(params => {
        if (params.functionName === "getTokens") {
          return [MOCK_TOKEN_ADDRESS];
        } else if (params.functionName === "getTokenAllowance") {
          return [
            BigInt(1000000000000000000), // amount: 1 token
            BigInt(300000000000000000), // spent: 0.3 token
            BigInt(1440), // resetTimeMin: 24 hours
            BigInt(Math.floor(Date.now() / (60 * 1000)) - 720), // lastResetMin: 12 hours ago
            BigInt(1), // nonce
          ];
        } else if (params.functionName === "symbol") {
          return "TEST";
        } else if (params.functionName === "decimals") {
          return 18;
        } else if (params.functionName === "balanceOf") {
          return BigInt(5000000000000000000); // 5 tokens
        }
      });

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
      };

      const response = await actionProvider.getAllowanceInfo(mockWallet, args);

      // Verify response contains expected information
      expect(response).toContain(`Delegate ${MOCK_DELEGATE_ADDRESS} has the following allowances`);
      expect(response).toContain(`TEST (${MOCK_TOKEN_ADDRESS})`);
      expect(response).toContain("Current Safe balance: 5 TEST");
      expect(response).toContain("Allowance: 0.7 available of 1 total (0.3 spent)");
      expect(response).toContain("resets every 1440 minutes");
    });

    it("should handle case with no allowances", async () => {
      // Mock empty token list response
      (mockWallet.readContract as jest.Mock).mockImplementation(params => {
        if (params.functionName === "getTokens") {
          return []; // No tokens with allowances
        }
      });

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
      };

      const response = await actionProvider.getAllowanceInfo(mockWallet, args);

      // Verify response indicates no allowances
      expect(response).toBe(
        `Get allowance: Delegate ${MOCK_DELEGATE_ADDRESS} has no token allowances from Safe ${MOCK_SAFE_ADDRESS}`,
      );
    });

    it("should handle errors when getting allowance info", async () => {
      // Mock error when reading contract
      const error = new Error("Failed to get allowance info");
      (mockWallet.readContract as jest.Mock).mockRejectedValue(error);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
      };

      const response = await actionProvider.getAllowanceInfo(mockWallet, args);
      expect(response).toBe(`Get allowance: Error getting allowance: ${error.message}`);
    });
  });

  describe("withdrawAllowance", () => {
    beforeEach(() => {
      // Mock wallet methods needed for withdrawAllowance
      mockWallet.readContract = jest.fn();
      mockWallet.signHash = jest.fn();
      mockWallet.sendTransaction = jest.fn();
      mockWallet.waitForTransactionReceipt = jest.fn();

      // Mock the getAllowanceModuleDeployment function
      jest.mock("@safe-global/safe-modules-deployments", () => ({
        getAllowanceModuleDeployment: jest.fn().mockReturnValue({
          networkAddresses: { "11155111": "0xallowanceModuleAddress" }, // Sepolia chain ID
          abi: [
            {
              name: "getTokenAllowance",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }, { type: "address" }],
              outputs: [
                { type: "uint256" }, // amount
                { type: "uint256" }, // spent
                { type: "uint256" }, // resetTimeMin
                { type: "uint256" }, // lastResetMin
                { type: "uint256" }, // nonce
              ],
            },
            {
              name: "generateTransferHash",
              type: "function",
              inputs: [
                { type: "address" }, // safe
                { type: "address" }, // token
                { type: "address" }, // to
                { type: "uint256" }, // amount
                { type: "address" }, // paymentToken
                { type: "uint256" }, // payment
                { type: "uint256" }, // nonce
              ],
              outputs: [{ type: "bytes32" }],
            },
            {
              name: "executeAllowanceTransfer",
              type: "function",
              inputs: [
                { type: "address" }, // safe
                { type: "address" }, // token
                { type: "address" }, // to
                { type: "uint256" }, // amount
                { type: "address" }, // paymentToken
                { type: "uint256" }, // payment
                { type: "address" }, // delegate
                { type: "bytes" }, // signature
              ],
              outputs: [],
            },
          ],
        }),
      }));
    });

    it("should successfully withdraw tokens using allowance", async () => {
      // Mock contract read responses
      (mockWallet.readContract as jest.Mock).mockImplementation(params => {
        if (params.functionName === "getTokenAllowance") {
          return [
            BigInt(5000000000000000000), // amount: 5 tokens
            BigInt(1000000000000000000), // spent: 1 token
            BigInt(0), // resetTimeMin: no reset
            BigInt(0), // lastResetMin: no reset
            BigInt(3), // nonce: 3
          ];
        } else if (params.functionName === "generateTransferHash") {
          return "0xmockhash123456789";
        } else if (params.functionName === "decimals") {
          return 18;
        } else if (params.functionName === "symbol") {
          return "TEST";
        }
      });

      // Mock signature
      (mockWallet.signHash as jest.Mock).mockResolvedValue("0xmocksignature");

      // Mock transaction sending
      const mockTxHash = "0xmocktxhash123456789";
      (mockWallet.sendTransaction as jest.Mock).mockResolvedValue(mockTxHash);

      // Mock transaction receipt
      (mockWallet.waitForTransactionReceipt as jest.Mock).mockResolvedValue({
        transactionHash: mockTxHash,
        status: "success",
      });

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "2.5", // 2.5 tokens
      };

      const response = await actionProvider.withdrawAllowance(mockWallet, args);

      // Verify the response contains expected information
      expect(response).toContain(`Successfully withdrew 2.5 TEST from Safe ${MOCK_SAFE_ADDRESS}`);
      expect(response).toContain(`Transaction hash: ${mockTxHash}`);

      // Verify the correct contract methods were called
      expect(mockWallet.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getTokenAllowance",
          args: [MOCK_SAFE_ADDRESS, MOCK_DELEGATE_ADDRESS, MOCK_TOKEN_ADDRESS],
        }),
      );

      expect(mockWallet.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "generateTransferHash",
        }),
      );

      expect(mockWallet.signHash).toHaveBeenCalledWith("0xmockhash123456789");

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.any(String),
          data: expect.any(String),
          value: BigInt(0),
        }),
      );
    });

    it("should handle errors when withdrawing allowance", async () => {
      // Mock error when reading contract
      const error = new Error("Insufficient allowance");
      (mockWallet.readContract as jest.Mock).mockRejectedValue(error);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "10", // 10 tokens
      };

      const response = await actionProvider.withdrawAllowance(mockWallet, args);
      expect(response).toBe(`Withdraw allowance: Error withdrawing allowance: ${error.message}`);
    });

    it("should handle transaction failure", async () => {
      // Mock successful contract reads
      (mockWallet.readContract as jest.Mock).mockImplementation(params => {
        if (params.functionName === "getTokenAllowance") {
          return [
            BigInt(5000000000000000000), // amount: 5 tokens
            BigInt(1000000000000000000), // spent: 1 token
            BigInt(0), // resetTimeMin: no reset
            BigInt(0), // lastResetMin: no reset
            BigInt(3), // nonce: 3
          ];
        } else if (params.functionName === "generateTransferHash") {
          return "0xmockhash123456789";
        } else if (params.functionName === "decimals") {
          return 18;
        } else if (params.functionName === "symbol") {
          return "TEST";
        }
      });

      // Mock signature
      (mockWallet.signHash as jest.Mock).mockResolvedValue("0xmocksignature");

      // Mock transaction sending failure
      const txError = new Error("Transaction reverted");
      (mockWallet.sendTransaction as jest.Mock).mockRejectedValue(txError);

      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
        delegateAddress: MOCK_DELEGATE_ADDRESS,
        tokenAddress: MOCK_TOKEN_ADDRESS,
        amount: "2.5", // 2.5 tokens
      };

      const response = await actionProvider.withdrawAllowance(mockWallet, args);
      expect(response).toBe(`Withdraw allowance: Error withdrawing allowance: ${txError.message}`);
    });
  });
});
