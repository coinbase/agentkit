import { SafeActionProvider } from "./safeActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { waitForTransactionReceipt } from "viem/actions";
import { SafeTransaction } from "@safe-global/safe-core-sdk-types";

jest.mock("@safe-global/protocol-kit");
jest.mock("@safe-global/api-kit");
jest.mock("viem/actions");

describe("Safe Action Provider", () => {
  const MOCK_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const MOCK_NETWORK_ID = "base-sepolia";
  const MOCK_SAFE_ADDRESS = "0x1234567890123456789012345678901234567890";
  const MOCK_SIGNER_ADDRESS = "0x2345678901234567890123456789012345678901";
  const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890";

  const MOCK_TRANSACTION = {
    data: {
      to: MOCK_SAFE_ADDRESS,
      value: "0",
      data: "0x",
    },
    signatures: new Map(),
    getSignature: jest.fn(),
    addSignature: jest.fn(),
    encodedSignatures: jest.fn(),
  } as unknown as SafeTransaction;

  const MOCK_TX_RESULT = {
    hash: MOCK_TX_HASH,
    isExecuted: true,
    transactionResponse: { hash: MOCK_TX_HASH },
  };

  let actionProvider: SafeActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockSafeSDK: jest.Mocked<Safe>;
  let mockApiKit: jest.Mocked<SafeApiKit>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_SIGNER_ADDRESS),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: MOCK_NETWORK_ID }),
      getPublicClient: jest.fn().mockReturnValue({
        transport: {},
        chain: {
          blockExplorers: {
            default: { url: "https://sepolia.basescan.org" },
          },
        },
        getBalance: jest.fn().mockResolvedValue(BigInt(1000000000000000000)), // 1 ETH
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    const mockExternalSigner = {
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH),
    };

    const mockReceipt = {
      transactionHash: MOCK_TX_HASH,
      status: 1,
      blockNumber: 123456,
    };

    (waitForTransactionReceipt as jest.Mock).mockResolvedValue(mockReceipt);

    mockSafeSDK = {
      getAddress: jest.fn().mockResolvedValue(MOCK_SAFE_ADDRESS),
      getOwners: jest.fn().mockResolvedValue([MOCK_SIGNER_ADDRESS]),
      getThreshold: jest.fn().mockResolvedValue(1),
      createTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION),
      getTransactionHash: jest.fn(),
      signHash: jest.fn().mockResolvedValue({
        data: "0x",
        signer: MOCK_SIGNER_ADDRESS,
        isContractSignature: false,
        staticPart: () => "0x",
        dynamicPart: () => "0x",
      }),
      executeTransaction: jest.fn().mockResolvedValue(MOCK_TX_RESULT),
      connect: jest.fn().mockReturnThis(),
      isSafeDeployed: jest.fn().mockResolvedValue(true),
      createSafeDeploymentTransaction: jest.fn().mockResolvedValue({
        to: MOCK_SAFE_ADDRESS,
        value: "0",
        data: "0x",
      }),
      getSafeProvider: jest.fn().mockReturnValue({
        getExternalSigner: jest.fn().mockResolvedValue(mockExternalSigner),
      }),
    } as unknown as jest.Mocked<Safe>;

    (Safe.init as jest.Mock).mockResolvedValue(mockSafeSDK);

    mockApiKit = {
      getPendingTransactions: jest.fn().mockResolvedValue({ results: [], count: 0 }),
      proposeTransaction: jest.fn(),
      getTransaction: jest.fn().mockResolvedValue({
        safe: MOCK_SAFE_ADDRESS,
        to: MOCK_SAFE_ADDRESS,
        data: "0x",
        value: "0",
        operation: 0,
        nonce: 0,
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: "0",
        gasToken: "0x0000000000000000000000000000000000000000",
        refundReceiver: "0x0000000000000000000000000000000000000000",
        submissionDate: new Date().toISOString(),
        executionDate: new Date().toISOString(),
        modified: new Date().toISOString(),
        transactionHash: MOCK_TX_HASH,
        isExecuted: true,
        isSuccessful: true,
        safeTxHash: MOCK_TX_HASH,
        confirmationsRequired: 1,
        confirmations: [
          {
            owner: MOCK_SIGNER_ADDRESS,
            signature: "0x",
            signatureType: "EOA",
            submissionDate: new Date().toISOString(),
          },
        ],
      }),
    } as unknown as jest.Mocked<SafeApiKit>;

    (SafeApiKit as unknown as jest.Mock).mockImplementation(() => mockApiKit);

    actionProvider = new SafeActionProvider({
      privateKey: MOCK_PRIVATE_KEY,
      networkId: MOCK_NETWORK_ID,
    });
  });

  describe("initializeSafe", () => {
    it("should successfully create a new Safe", async () => {
      const args = {
        signers: ["0x3456789012345678901234567890123456789012"],
        threshold: 2,
      };

      const response = await actionProvider.initializeSafe(mockWallet, args);

      expect(Safe.init).toHaveBeenCalled();
      expect(response).toContain("Successfully created Safe");
      expect(response).toContain(MOCK_SAFE_ADDRESS);
    });

    it("should handle Safe creation errors", async () => {
      const args = {
        signers: ["0x3456789012345678901234567890123456789012"],
        threshold: 2,
      };

      (Safe.init as jest.Mock).mockRejectedValue(new Error("Failed to create Safe"));

      const response = await actionProvider.initializeSafe(mockWallet, args);

      expect(response).toContain("Error creating Safe");
    });
  });

  describe("safeInfo", () => {
    it("should successfully get Safe info", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      const response = await actionProvider.safeInfo(mockWallet, args);

      expect(response).toContain(MOCK_SAFE_ADDRESS);
      expect(response).toContain("owners:");
      expect(response).toContain("Threshold:");
    });

    it("should handle Safe info errors", async () => {
      const args = {
        safeAddress: MOCK_SAFE_ADDRESS,
      };

      mockSafeSDK.getOwners.mockRejectedValue(new Error("Failed to get owners"));

      const response = await actionProvider.safeInfo(mockWallet, args);

      expect(response).toContain("Error connecting to Safe");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for EVM networks", () => {
      const result = actionProvider.supportsNetwork({ protocolFamily: "evm", networkId: "any" });
      expect(result).toBe(true);
    });

    it("should return false for non-EVM networks", () => {
      const result = actionProvider.supportsNetwork({
        protocolFamily: "bitcoin",
        networkId: "any",
      });
      expect(result).toBe(false);
    });
  });
});
