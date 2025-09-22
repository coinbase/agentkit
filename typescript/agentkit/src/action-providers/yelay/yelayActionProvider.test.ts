import { YelayActionProvider } from "./yelayActionProvider";
import { Network } from "../../network";
import { APYResponse, ClaimRequest, VaultsDetailsResponse } from "./types";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CONTRACTS_BY_CHAIN,
  RETAIL_POOL_ID,
  YELAY_VAULT_ABI,
  YIELD_EXTRACTOR_ABI,
} from "./constants";
import { encodeFunctionData, parseEther, formatUnits } from "viem";

const mockFetchResult = (status: number, data: object) => {
  return {
    json: async () => data,
    status,
    ok: status >= 200 && status < 400,
  };
};

const MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_WHOLE_ASSETS = "1";
const MOCK_RECEIVER_ID = "0x9876543210987654321098765432109876543210";
const MOCK_TX_HASH = "0xabcdef1234567890";
const MOCK_RECEIPT = { status: 1, blockNumber: 1234567 };
const MOCK_DECIMALS = 18;
const BASE_CHAIN_ID = "8453";

const mockVaults: VaultsDetailsResponse[] = [
  {
    address: MOCK_VAULT_ADDRESS,
    name: "Base WETH Vault",
    decimals: 18,
    chainId: BASE_CHAIN_ID,
    underlying: "0x123...",
  },
  {
    address: "0x456...",
    name: "Base USDC Vault",
    decimals: 6,
    chainId: BASE_CHAIN_ID,
    underlying: "0x456...",
  },
];

const mockAPYs: APYResponse[] = [
  {
    vault: MOCK_VAULT_ADDRESS,
    startBlock: 1000,
    finishBlock: 2000,
    startTimestamp: 1234567890,
    finishTimestamp: 1234667890,
    yield: "100",
    apy: "3.4",
  },
  {
    vault: "0x456...",
    startBlock: 1000,
    finishBlock: 2000,
    startTimestamp: 1234567890,
    finishTimestamp: 1234667890,
    yield: "50",
    apy: "5.2",
  },
];

const mockClaimProof: ClaimRequest[] = [
  {
    yelayLiteVault: MOCK_VAULT_ADDRESS,
    projectId: RETAIL_POOL_ID,
    cycle: 1,
    yieldSharesTotal: "100",
    proof: ["0x1234567890123456789012345678901234567890123456789012345678901234"], // 32 bites string,
  },
];

describe("YelayActionProvider", () => {
  const provider = new YelayActionProvider();
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  let mockedFetch: jest.Mock;
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = mockedFetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_RECEIVER_ID),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", chainId: BASE_CHAIN_ID }),
      sendTransaction: jest.fn().mockResolvedValue(MOCK_TX_HASH as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(MOCK_RECEIPT),
      readContract: jest.fn().mockResolvedValue(MOCK_DECIMALS),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support the protocol EVM family", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          chainId: "8453",
        } as Network),
      ).toBe(true);
    });

    it("should support the Base, Mainnet, Sonic, Arbitrum and Avalanche networks", () => {
      const networks = ["1", "146", "8453", "42161", "43114"];
      networks.forEach(network => {
        expect(
          provider.supportsNetwork({
            protocolFamily: "evm",
            chainId: network,
          } as Network),
        ).toBe(true);
      });
    });

    it("should not support other networks", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          chainId: "10",
        } as Network),
      ).toBe(false);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
          chainId: "8453",
        } as Network),
      ).toBe(false);
    });
  });

  describe("getVaults action", () => {
    it("returns list of vaults with their APYs", async () => {
      mockedFetch
        .mockResolvedValueOnce(mockFetchResult(200, mockVaults))
        .mockResolvedValueOnce(mockFetchResult(200, mockAPYs));

      const result = await provider.getVaults(mockWallet);

      expect(result).toBe(`
Base WETH Vault:
Address: ${MOCK_VAULT_ADDRESS}
APY: 3.4%
----------------
Base USDC Vault:
Address: 0x456...
APY: 5.2%
`);
    });

    it("returns error message when vaults API fails", async () => {
      mockedFetch.mockResolvedValue(mockFetchResult(500, mockVaults));

      const result = await provider.getVaults(mockWallet);
      expect(result).toBe("Yield backend is currently unavailable. Please try again later.");
    });

    it("returns error message when APY API fails", async () => {
      mockedFetch.mockResolvedValue(mockFetchResult(500, mockAPYs));

      const result = await provider.getVaults(mockWallet);
      expect(result).toBe("Yield backend is currently unavailable. Please try again later.");
    });
  });

  describe("deposit action", () => {
    it("should deposit assets into a specified Yelay Vault", async () => {
      const args = {
        assets: MOCK_WHOLE_ASSETS,
        vaultAddress: MOCK_VAULT_ADDRESS,
      };
      mockedFetch.mockResolvedValueOnce(mockFetchResult(200, mockVaults));

      const atomicAssets = parseEther(MOCK_WHOLE_ASSETS);

      const response = await provider.deposit(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: args.vaultAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: YELAY_VAULT_ABI,
          functionName: "deposit",
          args: [atomicAssets, RETAIL_POOL_ID, MOCK_RECEIVER_ID],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Deposited ${MOCK_WHOLE_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error message when deposit fails", async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResult(200, mockVaults));
      mockWallet.sendTransaction.mockRejectedValue(new Error("Deposit failed"));

      const args = {
        assets: MOCK_WHOLE_ASSETS,
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.deposit(mockWallet, args);
      expect(response).toContain("Deposit failed");
    });
  });

  describe("redeem action", () => {
    it("should redeem assets from a specified Yelay Vault", async () => {
      const args = {
        assets: MOCK_WHOLE_ASSETS,
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      mockedFetch.mockResolvedValueOnce(mockFetchResult(200, mockVaults));

      const response = await provider.redeem(mockWallet, args);
      const atomicAssets = parseEther(MOCK_WHOLE_ASSETS);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: args.vaultAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: YELAY_VAULT_ABI,
          functionName: "redeem",
          args: [atomicAssets, RETAIL_POOL_ID, MOCK_RECEIVER_ID],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Redeemed ${MOCK_WHOLE_ASSETS}`);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error message when redeem fails", async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResult(200, mockVaults));
      mockWallet.sendTransaction.mockRejectedValue(new Error("Redeem failed"));

      const args = {
        assets: MOCK_WHOLE_ASSETS,
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.redeem(mockWallet, args);
      expect(response).toContain("Redeem failed");
    });
  });

  describe("claim action", () => {
    it("should claim yield from a specified Yelay Vault", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      mockedFetch.mockResolvedValue(mockFetchResult(200, mockClaimProof));
      const response = await provider.claim(mockWallet, args);

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: CONTRACTS_BY_CHAIN[BASE_CHAIN_ID].YieldExtractor,
        data: encodeFunctionData({
          abi: YIELD_EXTRACTOR_ABI,
          functionName: "claim",
          args: [mockClaimProof],
        }),
      });

      expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(response).toContain(`Claimed ${mockClaimProof[0].yieldSharesTotal}`);
      expect(response).toContain(`Yelay Vault ${MOCK_VAULT_ADDRESS}`);
      expect(response).toContain(MOCK_TX_HASH);
    });

    it("should return error message when claim fails", async () => {
      mockWallet.sendTransaction.mockRejectedValue(new Error("Claim failed"));

      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.claim(mockWallet, args);
      expect(response).toContain("Claim failed");
    });
  });

  describe("balance action", () => {
    it("should get balance from a specified Yelay Vault", async () => {
      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };
      const balance = BigInt("1000000000000000000"); // 1 ETH in wei
      const yieldSharesClaimed = BigInt("50");
      const expectedBalanceInWholeUnits = formatUnits(balance, MOCK_DECIMALS);

      mockWallet.readContract
        .mockResolvedValueOnce(balance)
        .mockResolvedValueOnce(yieldSharesClaimed);
      mockedFetch
        .mockResolvedValueOnce(mockFetchResult(200, mockVaults))
        .mockResolvedValueOnce(mockFetchResult(200, mockClaimProof));

      const response = await provider.getBalance(mockWallet, args);

      expect(response).toContain(
        `User balance from Yelay Vault ${MOCK_VAULT_ADDRESS}: ${expectedBalanceInWholeUnits}`,
      );
      expect(response).toContain(`Yield shares generated: ${mockClaimProof[0].yieldSharesTotal}`);
      expect(response).toContain(`Yield shares claimed: ${yieldSharesClaimed}`);
    });

    it("should return only user balance when there is no claimable yield", async () => {
      const balance = BigInt("1000000000000000000"); // 1 ETH in wei
      const expectedBalanceInWholeUnits = formatUnits(balance, MOCK_DECIMALS);

      mockWallet.readContract.mockResolvedValueOnce(balance);
      mockedFetch
        .mockResolvedValueOnce(mockFetchResult(200, mockVaults))
        .mockResolvedValueOnce(mockFetchResult(200, []));

      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.getBalance(mockWallet, args);
      expect(response).toContain(
        `User balance from Yelay Vault ${MOCK_VAULT_ADDRESS}: ${expectedBalanceInWholeUnits}`,
      );
    });

    it("should return error message when balance fails", async () => {
      mockWallet.readContract.mockRejectedValue(new Error("Balance failed"));

      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.getBalance(mockWallet, args);
      expect(response).toContain("Balance failed");
    });

    it("should return error message when claim proof fails", async () => {
      mockedFetch.mockResolvedValue(mockFetchResult(500, mockClaimProof));

      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.getBalance(mockWallet, args);
      expect(response).toContain("Claim proof failed");
    });

    it("should return error message when yield shares claimed fails", async () => {
      mockWallet.readContract.mockRejectedValue(new Error("Yield shares claimed failed"));

      const args = {
        vaultAddress: MOCK_VAULT_ADDRESS,
      };

      const response = await provider.getBalance(mockWallet, args);
      expect(response).toContain("Yield shares claimed failed");
    });
  });
});
