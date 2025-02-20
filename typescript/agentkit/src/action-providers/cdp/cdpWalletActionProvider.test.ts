import { CdpWalletProvider } from "../../wallet-providers";
import { CdpWalletActionProvider } from "./cdpWalletActionProvider";
import { DeployNftSchema, DeployTokenSchema, DeployContractSchema } from "./schemas";
import { SmartContract, Trade } from "@coinbase/coinbase-sdk";

// Mock the entire module
jest.mock("@coinbase/coinbase-sdk");

// Get the mocked constructor
const { ExternalAddress } = jest.requireMock("@coinbase/coinbase-sdk");

describe("CDP Wallet Action Provider Input Schemas", () => {
  describe("Deploy NFT Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        baseURI: "https://www.test.xyz/metadata/",
        name: "Test Token",
        symbol: "TEST",
      };

      const result = DeployNftSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = DeployNftSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });

  describe("Deploy Token Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        name: "Test Token",
        symbol: "TEST",
        totalSupply: 1000000000000000000n,
      };

      const result = DeployTokenSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });
  });

  describe("Deploy Contract Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        solidityVersion: "0.8.0",
        solidityInputJson: "{}",
        contractName: "Test Contract",
        constructorArgs: {},
      };

      const result = DeployContractSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = DeployContractSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("CDP Wallet Action Provider", () => {
  let actionProvider: CdpWalletActionProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExternalAddressInstance: jest.Mocked<any>;
  let mockWallet: jest.Mocked<CdpWalletProvider>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    actionProvider = new CdpWalletActionProvider();
    mockExternalAddressInstance = {
      reputation: jest.fn(),
      faucet: jest.fn(),
    };

    // Mock the constructor to return our mock instance
    (ExternalAddress as jest.Mock).mockImplementation(() => mockExternalAddressInstance);

    mockWallet = {
      createTrade: jest.fn(),
      deployToken: jest.fn(),
      deployContract: jest.fn(),
      getAddress: jest.fn().mockReturnValue("0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83"),
      getNetwork: jest.fn().mockReturnValue({ networkId: "base-sepolia" }),
    } as unknown as jest.Mocked<CdpWalletProvider>;
  });

  describe("deployNft", () => {
    let mockWallet: jest.Mocked<CdpWalletProvider>;
    const MOCK_NFT_BASE_URI = "https://www.test.xyz/metadata/";
    const MOCK_NFT_NAME = "Test Token";
    const MOCK_NFT_SYMBOL = "TEST";
    const CONTRACT_ADDRESS = "0x123456789abcdef";
    const NETWORK_ID = "base-sepolia";
    const TRANSACTION_HASH = "0xghijkl987654321";
    const TRANSACTION_LINK = `https://etherscan.io/tx/${TRANSACTION_HASH}`;

    beforeEach(() => {
      mockWallet = {
        deployNFT: jest.fn().mockResolvedValue({
          wait: jest.fn().mockResolvedValue({
            getContractAddress: jest.fn().mockReturnValue(CONTRACT_ADDRESS),
            getTransaction: jest.fn().mockReturnValue({
              getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
              getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
            }),
          }),
        }),
        getNetwork: jest.fn().mockReturnValue({ networkId: NETWORK_ID }),
      } as unknown as jest.Mocked<CdpWalletProvider>;
    });

    it("should successfully deploy an NFT", async () => {
      const args = {
        name: MOCK_NFT_NAME,
        symbol: MOCK_NFT_SYMBOL,
        baseURI: MOCK_NFT_BASE_URI,
      };

      const result = await actionProvider.deployNFT(mockWallet, args);

      expect(mockWallet.deployNFT).toHaveBeenCalledWith(args);
      expect(result).toContain(`Deployed NFT Collection ${MOCK_NFT_NAME}:`);
      expect(result).toContain(`- to address ${CONTRACT_ADDRESS}`);
      expect(result).toContain(`- on network ${NETWORK_ID}`);
      expect(result).toContain(`Transaction hash: ${TRANSACTION_HASH}`);
      expect(result).toContain(`Transaction link: ${TRANSACTION_LINK}`);
    });

    it("should handle deployment errors", async () => {
      const args = {
        name: MOCK_NFT_NAME,
        symbol: MOCK_NFT_SYMBOL,
        baseURI: MOCK_NFT_BASE_URI,
      };

      const error = new Error("An error has occurred");
      mockWallet.deployNFT.mockRejectedValue(error);

      const result = await actionProvider.deployNFT(mockWallet, args);

      expect(mockWallet.deployNFT).toHaveBeenCalledWith(args);
      expect(result).toBe(`Error deploying NFT: ${error}`);
    });
  });

  describe("deployToken", () => {
    beforeEach(() => {
      mockWallet = {
        deployToken: jest.fn().mockResolvedValue({
          wait: jest.fn().mockResolvedValue({
            getContractAddress: jest.fn().mockReturnValue("0x123"),
            getTransaction: jest.fn().mockReturnValue({
              getTransactionLink: jest.fn().mockReturnValue("tx-link"),
            }),
          }),
        }),
      } as unknown as jest.Mocked<CdpWalletProvider>;
    });

    it("should successfully deploy a token", async () => {
      const args = {
        name: "Test Token",
        symbol: "TEST",
        totalSupply: 1000000000000000000n,
      };

      const result = await actionProvider.deployToken(mockWallet, args);

      expect(mockWallet.deployToken).toHaveBeenCalledWith(args);
      expect(mockWallet.deployToken).toHaveBeenCalledTimes(1);
      expect(result).toContain(
        "Deployed ERC20 token contract Test Token (TEST) with total supply of 1000000000000000000 tokens at address 0x123. Transaction link: tx-link",
      );
    });

    it("should handle errors when deploying a token", async () => {
      const args = {
        name: "Test Token",
        symbol: "TEST",
        totalSupply: 1000000000000000000n,
      };

      const error = new Error("Token deployment failed");
      mockWallet.deployToken.mockRejectedValue(error);

      const result = await actionProvider.deployToken(mockWallet, args);

      expect(result).toBe(`Error deploying token: ${error}`);
    });
  });

  describe("deployContract", () => {
    const CONTRACT_ADDRESS = "0x123456789abcdef";
    const TRANSACTION_LINK = "https://etherscan.io/tx/0xghijkl987654321";
    const MOCK_CONTRACT_NAME = "Test Contract";
    const MOCK_SOLIDITY_VERSION = "0.8.0";
    const MOCK_SOLIDITY_INPUT_JSON = "{}";
    const MOCK_CONSTRUCTOR_ARGS = { arg1: "value1", arg2: "value2" };

    beforeEach(() => {
      mockWallet.deployContract.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          getContractAddress: jest.fn().mockReturnValue(CONTRACT_ADDRESS),
          getTransaction: jest.fn().mockReturnValue({
            getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
          }),
        }),
      } as unknown as SmartContract);
    });

    it("should successfully deploy a contract", async () => {
      const args = {
        solidityVersion: MOCK_SOLIDITY_VERSION,
        solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
        contractName: MOCK_CONTRACT_NAME,
        constructorArgs: MOCK_CONSTRUCTOR_ARGS,
      };

      const response = await actionProvider.deployContract(mockWallet, args);

      expect(mockWallet.deployContract).toHaveBeenCalledWith({
        solidityVersion: "0.8.0+commit.c7dfd78e",
        solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
        contractName: MOCK_CONTRACT_NAME,
        constructorArgs: MOCK_CONSTRUCTOR_ARGS,
      });
      expect(response).toContain(
        `Deployed contract ${MOCK_CONTRACT_NAME} at address ${CONTRACT_ADDRESS}`,
      );
      expect(response).toContain(`Transaction link: ${TRANSACTION_LINK}`);
    });

    it("should handle deployment errors", async () => {
      const args = {
        solidityVersion: MOCK_SOLIDITY_VERSION,
        solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
        contractName: MOCK_CONTRACT_NAME,
        constructorArgs: MOCK_CONSTRUCTOR_ARGS,
      };

      const error = new Error("An error has occurred");
      mockWallet.deployContract.mockRejectedValue(error);

      const response = await actionProvider.deployContract(mockWallet, args);

      expect(mockWallet.deployContract).toHaveBeenCalledWith({
        solidityVersion: "0.8.0+commit.c7dfd78e",
        solidityInputJson: MOCK_SOLIDITY_INPUT_JSON,
        contractName: MOCK_CONTRACT_NAME,
        constructorArgs: MOCK_CONSTRUCTOR_ARGS,
      });
      expect(response).toBe(`Error deploying contract: ${error}`);
    });
  });

  describe("trade", () => {
    const TRANSACTION_HASH = "0xghijkl987654321";
    const TRANSACTION_LINK = "https://etherscan.io/tx/0xghijkl987654321";
    const TO_AMOUNT = "100";

    beforeEach(() => {
      mockWallet.createTrade.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          getTransaction: jest.fn().mockReturnValue({
            getTransactionHash: jest.fn().mockReturnValue(TRANSACTION_HASH),
            getTransactionLink: jest.fn().mockReturnValue(TRANSACTION_LINK),
          }),
          getToAmount: jest.fn().mockReturnValue(TO_AMOUNT),
        }),
      } as unknown as Trade);
    });

    it("should successfully trade assets", async () => {
      const args = {
        amount: 1n,
        fromAssetId: "eth",
        toAssetId: "usdc",
      };

      const result = await actionProvider.trade(mockWallet, args);

      expect(mockWallet.createTrade).toHaveBeenCalledWith(args);
      expect(result).toContain(
        `Traded ${args.amount} of ${args.fromAssetId} for ${TO_AMOUNT} of ${args.toAssetId}`,
      );
      expect(result).toContain(`Transaction hash for the trade: ${TRANSACTION_HASH}`);
      expect(result).toContain(`Transaction link for the trade: ${TRANSACTION_LINK}`);
    });

    it("should handle trade errors", async () => {
      const args = {
        amount: 1000000000000000000n,
        fromAssetId: "eth",
        toAssetId: "usdc",
      };

      const error = new Error("An error has occurred");
      mockWallet.createTrade.mockRejectedValue(error);

      const result = await actionProvider.trade(mockWallet, args);

      expect(result).toBe(`Error trading assets: ${error}`);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true when protocolFamily is evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false when protocolFamily is not evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });
});
