import { EvmWalletProvider } from "../../wallet-providers";
import { CdpApiActionProvider } from "./cdpApiActionProvider";
import { AddressReputationSchema, RequestFaucetFundsSchema } from "./schemas";

jest.mock("@coinbase/coinbase-sdk");

const { ExternalAddress } = jest.requireMock("@coinbase/coinbase-sdk");

describe("CDP API Action Provider Input Schemas", () => {
  describe("Address Reputation Schema", () => {
    it("should successfully parse valid input", () => {
      const validInput = {
        address: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        network: "base-mainnet",
      };

      const result = AddressReputationSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing invalid address", () => {
      const invalidInput = {
        address: "invalid-address",
        network: "base-mainnet",
      };
      const result = AddressReputationSchema.safeParse(invalidInput);

      expect(result.success).toBe(false);
    });
  });

  describe("Request Faucet Funds Schema", () => {
    it("should successfully parse with optional assetId", () => {
      const validInput = {
        assetId: "eth",
      };

      const result = RequestFaucetFundsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse without assetId", () => {
      const validInput = {};
      const result = RequestFaucetFundsSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });
  });
});

describe("CDP API Action Provider", () => {
  let actionProvider: CdpApiActionProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExternalAddressInstance: jest.Mocked<any>;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    actionProvider = new CdpApiActionProvider();
    mockExternalAddressInstance = {
      reputation: jest.fn(),
      faucet: jest.fn(),
    };

    // Mock the constructor to return our mock instance
    (ExternalAddress as jest.Mock).mockImplementation(() => mockExternalAddressInstance);

    mockWallet = {
      deployToken: jest.fn(),
      deployContract: jest.fn(),
      getAddress: jest.fn().mockReturnValue("0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83"),
      getNetwork: jest.fn().mockReturnValue({ networkId: "base-sepolia" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("addressReputation", () => {
    it("should successfully check address reputation", async () => {
      const args = {
        address: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        network: "base-mainnet",
      };

      mockExternalAddressInstance.reputation.mockResolvedValue("Good reputation");

      const result = await actionProvider.addressReputation(args);

      expect(ExternalAddress).toHaveBeenCalledWith(args.network, args.address);
      expect(ExternalAddress).toHaveBeenCalledTimes(1);
      expect(mockExternalAddressInstance.reputation).toHaveBeenCalled();
      expect(mockExternalAddressInstance.reputation).toHaveBeenCalledTimes(1);
      expect(result).toBe("Good reputation");
    });

    it("should handle errors when checking reputation", async () => {
      const args = {
        address: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        network: "base-mainnet",
      };

      const error = new Error("Reputation check failed");
      mockExternalAddressInstance.reputation.mockRejectedValue(error);

      const result = await actionProvider.addressReputation(args);

      expect(ExternalAddress).toHaveBeenCalledWith(args.network, args.address);
      expect(ExternalAddress).toHaveBeenCalledTimes(1);
      expect(mockExternalAddressInstance.reputation).toHaveBeenCalled();
      expect(mockExternalAddressInstance.reputation).toHaveBeenCalledTimes(1);
      expect(result).toBe(`Error checking address reputation: ${error}`);
    });

    it("should return error if not on Ethereum network", async () => {
      const args = {
        address: "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83",
        network: "solana-devnet",
      };

      const result = await actionProvider.addressReputation(args);

      expect(result).toBe("Address reputation is only supported on Ethereum networks.");
    });
  });

  describe("faucet", () => {
    beforeEach(() => {
      mockExternalAddressInstance.faucet.mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          getTransactionLink: jest.fn().mockReturnValue("tx-link"),
        }),
      });
    });

    it("should successfully request faucet funds with assetId", async () => {
      const args = {
        assetId: "eth",
      };

      const result = await actionProvider.faucet(mockWallet, args);

      expect(ExternalAddress).toHaveBeenCalledWith("base-sepolia", mockWallet.getAddress());
      expect(ExternalAddress).toHaveBeenCalledTimes(1);
      expect(mockExternalAddressInstance.faucet).toHaveBeenCalledWith("eth");
      expect(mockExternalAddressInstance.faucet).toHaveBeenCalledTimes(1);
      expect(result).toContain("Received eth from the faucet");
      expect(result).toContain("tx-link");
    });

    it("should successfully request faucet funds without assetId", async () => {
      const args = {};

      const result = await actionProvider.faucet(mockWallet, args);

      expect(ExternalAddress).toHaveBeenCalledWith("base-sepolia", mockWallet.getAddress());
      expect(ExternalAddress).toHaveBeenCalledTimes(1);
      expect(mockExternalAddressInstance.faucet).toHaveBeenCalledWith(undefined);
      expect(mockExternalAddressInstance.faucet).toHaveBeenCalledTimes(1);
      expect(result).toContain("Received ETH from the faucet");
    });

    it("should handle faucet errors", async () => {
      const args = {};
      const error = new Error("Faucet request failed");
      mockExternalAddressInstance.faucet.mockRejectedValue(error);

      const result = await actionProvider.faucet(mockWallet, args);

      expect(result).toBe(`Error requesting faucet funds: ${error}`);
    });

    it("should return error if not on base-sepolia or solana-devnet", async () => {
      mockWallet.getNetwork.mockReturnValue({ networkId: "solana-mainnet", protocolFamily: "svm" });
      const args = {};
      const result = await actionProvider.faucet(mockWallet, args);

      expect(result).toBe("Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.");
    });
  });
});
