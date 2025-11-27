import { VaultsfyiActionProvider } from "./vaultsfyiActionProvider";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { SUPPORTED_CHAIN_IDS } from "./constants";

const mockFetchResult = (status: number, data: object) => {
  return {
    json: async () => data,
    status,
    ok: status >= 200 && status < 300,
  };
};

const mockVault = (num: number) => ({
  apiResult: {
    address: "0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
    network: {
      name: "base",
      chainId: 8453,
      networkCaip: "eip155:8453",
    },
    asset: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      assetCaip: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      assetLogo: "https://images.vaults.fyi/tokens/usdc.png",
      assetPriceInUsd: "0.99983592",
      assetGroup: "USD",
    },
    isTransactional: true,
    isAppFeatured: true,
    name: `vault-${num}`,
    protocol: {
      name: "40acres",
      product: "",
      version: "",
      protocolLogo: "https://images.vaults.fyi/protocols/40acres.png",
    },
    lendUrl: "https://app.vaults.fyi/opportunity/base/0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
    description: `Description for vault-${num}`,
    protocolVaultUrl: "https://www.40acres.finance/",
    tags: ["Lending"],
    holdersData: {
      totalCount: num,
      totalBalance: (num * 1000000).toString(),
      topHolders: [
        {
          address: "0x1d59868D7767d703929393bDaB313302840f533c",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x1c6586f4895A569d9EFac5ABd231b79E0D47cAAD",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x011b0a055E02425461A1ae95B30F483c4fF05bE7",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x9551EeC2a31025D582Be358E05D88a9c95cAD86E",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x10076ed296571cE4Fde5b1FDF0eB9014a880e47B",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x9e33Fef28A75303B4FEB7b4c713c27Fed2AC78DD",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x166B9a0390474C455115dFb64579D1D79286588F",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x318962D28813fe14B9b6265fE2dAFB241C7F7777",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x22e4bB70905c7Ad93B65BC9Bd5B1b06e67378124",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x57609a91CC6eA77D9805137656A9308F5bF52f23",
          lpTokenBalance: (num * 1000000).toString(),
        },
      ],
    },
    apy: {
      "1day": {
        base: num,
        reward: num,
        total: num,
      },
      "7day": {
        base: num,
        reward: num,
        total: num,
      },
      "30day": {
        base: num,
        reward: num,
        total: num,
      },
      "1hour": {
        base: num,
        reward: num,
        total: num,
      },
    },
    tvl: {
      usd: num.toString(),
      native: (num * 1000000).toString(),
    },
    lastUpdateTimestamp: 1764259200,
    rewards: [],
    score: {
      vaultScore: num,
      vaultTvlScore: num,
      protocolTvlScore: num,
      holderScore: num,
      networkScore: num,
      assetScore: num,
    },
    lpToken: {
      address: "0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
      tokenCaip: "eip155:8453/erc20:0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
      name: `Vault-${num}`,
      symbol: `VAULT-${num}`,
      decimals: 6,
    },
    transactionalProperties: {
      depositStepsType: "instant",
      redeemStepsType: "instant",
      rewardsSupported: false,
    },
    warnings: [],
  },
  transformedResult: {
    address: "0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
    network: {
      name: "base",
      chainId: 8453,
      networkCaip: "eip155:8453",
    },
    asset: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      assetCaip: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      assetLogo: "https://images.vaults.fyi/tokens/usdc.png",
      assetPriceInUsd: "0.99983592",
      assetGroup: "USD",
    },
    isTransactional: true,
    isAppFeatured: true,
    name: `vault-${num}`,
    protocol: {
      name: "40acres",
      product: "",
      version: "",
      protocolLogo: "https://images.vaults.fyi/protocols/40acres.png",
    },
    lendUrl: "https://app.vaults.fyi/opportunity/base/0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
    description: `Description for vault-${num}`,
    protocolVaultUrl: "https://www.40acres.finance/",
    tags: ["Lending"],
    holdersData: {
      totalCount: num,
      totalBalance: (num * 1000000).toString(),
      topHolders: [
        {
          address: "0x1d59868D7767d703929393bDaB313302840f533c",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x1c6586f4895A569d9EFac5ABd231b79E0D47cAAD",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x011b0a055E02425461A1ae95B30F483c4fF05bE7",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x9551EeC2a31025D582Be358E05D88a9c95cAD86E",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x10076ed296571cE4Fde5b1FDF0eB9014a880e47B",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x9e33Fef28A75303B4FEB7b4c713c27Fed2AC78DD",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x166B9a0390474C455115dFb64579D1D79286588F",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x318962D28813fe14B9b6265fE2dAFB241C7F7777",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x22e4bB70905c7Ad93B65BC9Bd5B1b06e67378124",
          lpTokenBalance: (num * 1000000).toString(),
        },
        {
          address: "0x57609a91CC6eA77D9805137656A9308F5bF52f23",
          lpTokenBalance: (num * 1000000).toString(),
        },
      ],
    },
    apy: {
      "1day": {
        base: `${(num * 100).toFixed(2)}%`,
        reward: `${(num * 100).toFixed(2)}%`,
        total: `${(num * 100).toFixed(2)}%`,
      },
      "7day": {
        base: `${(num * 100).toFixed(2)}%`,
        reward: `${(num * 100).toFixed(2)}%`,
        total: `${(num * 100).toFixed(2)}%`,
      },
      "30day": {
        base: `${(num * 100).toFixed(2)}%`,
        reward: `${(num * 100).toFixed(2)}%`,
        total: `${(num * 100).toFixed(2)}%`,
      },
      "1hour": {
        base: `${(num * 100).toFixed(2)}%`,
        reward: `${(num * 100).toFixed(2)}%`,
        total: `${(num * 100).toFixed(2)}%`,
      },
    },
    tvl: {
      usd: num.toString(),
      native: (num * 1000000).toString(),
    },
    lastUpdateTimestamp: new Date(1764259200 * 1000).toISOString(),
    rewards: [],
    score: {
      vaultScore: num,
      vaultTvlScore: num,
      protocolTvlScore: num,
      holderScore: num,
      networkScore: num,
      assetScore: num,
    },
    lpToken: {
      address: "0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
      tokenCaip: "eip155:8453/erc20:0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5",
      name: `Vault-${num}`,
      symbol: `VAULT-${num}`,
      decimals: 6,
    },
    transactionalProperties: {
      depositStepsType: "instant",
      redeemStepsType: "instant",
      rewardsSupported: false,
    },
    warnings: [],
    link: `https://app.vaults.fyi/opportunity/base/0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5`,
  },
});

const MOCK_TX_HASH = "0xmock-hash";

describe("VaultsfyiActionProvider", () => {
  const provider = new VaultsfyiActionProvider({ apiKey: "test-api-key" });
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;
  let mockedFetch: jest.Mock;
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = mockedFetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn(),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "test-network",
      }),
      nativeTransfer: jest.fn(),
      readContract: jest.fn(() => Promise.resolve(18)), // token decimals
      sendTransaction: jest.fn(() => Promise.resolve(MOCK_TX_HASH)),
      waitForTransactionReceipt: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support all vaultsfyi networks", () => {
      SUPPORTED_CHAIN_IDS.forEach(chainId => {
        expect(
          provider.supportsNetwork({
            protocolFamily: "evm",
            chainId: chainId,
          }),
        ).toBe(true);
      });
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          chainId: "some-other-chain",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("vaults action", () => {
    it("should return a transformed vault", async () => {
      const mockedVault = mockVault(1);
      mockedFetch.mockResolvedValue(mockFetchResult(200, { data: [mockedVault.apiResult] }));
      const args = {};
      const result = await provider.vaults(mockWalletProvider, args);
      expect(JSON.parse(result)).toStrictEqual({
        data: [mockedVault.transformedResult],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {};
      expect(await provider.vaults(mockWalletProvider, args)).toBe(
        "Failed to fetch vaults: some more info",
      );
    });
  });

  describe("execute_step action", () => {
    it("should execute deposit", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          currentActionIndex: 0,
          actions: [
            {
              tx: {
                to: "0x123",
                data: "0x456",
                value: "1",
                chainId: 1,
              },
              description: "Deposit to vault",
            },
          ],
        }),
      );
      const args = {
        vaultAddress: "0x123",
        assetAddress: "0x456",
        network: "mainnet",
        amount: 1n,
        action: "deposit",
      } as const;
      const response = await provider.executeStep(mockWalletProvider, args);
      expect(response).toBe("Successfully executed deposit step");
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledWith({
        to: "0x123",
        data: "0x456",
        value: 1n,
      });
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
    });

    it("should execute multiple transactions", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          currentActionIndex: 0,
          actions: [
            {
              tx: {
                to: "0x123",
                data: "0x456",
                value: "1",
                chainId: 1,
              },
              description: "Deposit to vault",
            },
            {
              tx: {
                to: "0x789",
                data: "0xabc",
                value: "2",
                chainId: 1,
              },
              description: "Deposit to vault",
            },
          ],
        }),
      );
      const args = {
        vaultAddress: "0x123",
        assetAddress: "0x456",
        network: "mainnet",
        amount: 1n,
        action: "deposit",
      } as const;
      const response = await provider.executeStep(mockWalletProvider, args);
      expect(response).toBe("Successfully executed deposit step");
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledWith({
        to: "0x123",
        data: "0x456",
        value: 1n,
      });
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalledWith({
        to: "0x789",
        data: "0xabc",
        value: 2n,
      });
      expect(mockWalletProvider.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_TX_HASH);
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {
        vaultAddress: "0x123",
        assetAddress: "0x456",
        network: "mainnet",
        amount: 1n,
        action: "deposit",
      } as const;
      expect(await provider.executeStep(mockWalletProvider, args)).toBe(
        "Failed to execute step: some more info",
      );
    });
  });

  describe("user_idle_assets action", () => {
    it("should return the response", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          mainnet: [
            {
              address: "0x123",
              name: "token-1",
              symbol: "T1",
              balance: (10 ** 18).toString(),
              decimals: 18,
            },
          ],
        }),
      );
      const response = await provider.idleAssets(mockWalletProvider);
      expect(JSON.parse(response)).toStrictEqual({
        mainnet: [
          {
            address: "0x123",
            name: "token-1",
            symbol: "T1",
            balance: (10 ** 18).toString(),
            decimals: 18,
          },
        ],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      expect(await provider.idleAssets(mockWalletProvider)).toBe(
        "Failed to fetch idle assets: some more info",
      );
    });
  });

  describe("wallet positions action", () => {
    it("should return the response", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          mainnet: [
            {
              vaultName: "vault-1",
              vaultAddress: "0x123",
              asset: {
                assetAddress: "0x456",
                name: "token-1",
                symbol: "T1",
                decimals: 18,
              },
              balanceNative: (10 ** 18).toString(),
              balanceLp: (10 ** 18).toString(),
              unclaimedUsd: "100",
              apy: {
                base: 100,
                rewards: 100,
                total: 100,
              },
            },
          ],
        }),
      );
      const response = await provider.positions(mockWalletProvider);
      expect(JSON.parse(response)).toStrictEqual({
        mainnet: [
          {
            vaultName: "vault-1",
            vaultAddress: "0x123",
            asset: {
              assetAddress: "0x456",
              name: "token-1",
              symbol: "T1",
              decimals: 18,
            },
            balanceNative: (10 ** 18).toString(),
            balanceLp: (10 ** 18).toString(),
            unclaimedUsd: "100",
            apy: {
              base: 100,
              rewards: 100,
              total: 100,
            },
          },
        ],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      expect(await provider.positions(mockWalletProvider)).toBe(
        "Failed to fetch positions: some more info",
      );
    });
  });

  describe("detailed_vault action", () => {
    it("should return the response", async () => {
      const detailedVault = mockVault(1);

      mockedFetch.mockResolvedValue(mockFetchResult(200, detailedVault.apiResult));

      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };

      const result = await provider.vaultDetails(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toStrictEqual({
        ...detailedVault.transformedResult,
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );

      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };

      expect(await provider.vaultDetails(mockWalletProvider, args)).toBe(
        "Failed to fetch vault: some more info",
      );
    });
  });

  describe("vault_historical_data action", () => {
    it("transforms the response correctly", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          data: [
            {
              timestamp: 1704067200,
              blockNumber: 12345678,
              apy: {
                base: 0.5,
                reward: 0.3,
                total: 0.8,
              },
              tvl: {
                usd: 1000000,
                native: 1000000,
              },
            },
          ],
        }),
      );
      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
        fromDate: "2024-01-01T00:00:00Z",
        toDate: "2024-01-02T00:00:00Z",
        granularity: "1hour" as const,
        apyInterval: "1day" as const,
      };

      const result = await provider.vaultHistoricalData(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toEqual({
        data: [
          {
            timestamp: "2024-01-01T00:00:00.000Z",
            blockNumber: 12345678,
            apy: {
              base: "50.00%",
              reward: "30.00%",
              total: "80.00%",
            },
            tvl: {
              usd: 1000000,
              native: 1000000,
            },
          },
        ],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );

      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
        fromDate: "2024-01-01T00:00:00Z",
        toDate: "2024-01-02T00:00:00Z",
        granularity: "1hour" as const,
        apyInterval: "1day" as const,
      };

      expect(await provider.vaultHistoricalData(mockWalletProvider, args)).toBe(
        "Failed to fetch vault historical data: some more info",
      );
    });
  });

  describe("rewards_context action", () => {
    it("should return the response", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          data: [
            {
              some: "data",
            },
          ],
        }),
      );
      const response = await provider.rewardsContext(mockWalletProvider);
      expect(JSON.parse(response)).toStrictEqual({ data: [{ some: "data" }] });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      expect(await provider.rewardsContext(mockWalletProvider)).toBe(
        "Failed to fetch rewards context: some more info",
      );
    });
  });

  describe("get_benchmark_apy action", () => {
    it("should transform the response correctly", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          apy: {
            "1day": {
              base: 0.5,
              reward: 0.3,
              total: 0.8,
            },
            "7day": {
              base: 0.5,
              reward: 0.3,
              total: 0.8,
            },
            "30day": {
              base: 0.5,
              reward: 0.3,
              total: 0.8,
            },
          },
          timestamp: 1704067200,
        }),
      );
      const args = {
        network: "mainnet" as const,
        benchmarkCode: "eth" as const,
      };
      const result = await provider.benchmarkApy(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toEqual({
        apy: {
          "1day": {
            base: "50.00%",
            reward: "30.00%",
            total: "80.00%",
          },
          "7day": {
            base: "50.00%",
            reward: "30.00%",
            total: "80.00%",
          },
          "30day": {
            base: "50.00%",
            reward: "30.00%",
            total: "80.00%",
          },
        },
        timestamp: new Date(1704067200 * 1000).toISOString(),
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {
        network: "mainnet" as const,
        benchmarkCode: "eth" as const,
      };
      expect(await provider.benchmarkApy(mockWalletProvider, args)).toBe(
        "Failed to fetch benchmark: some more info",
      );
    });
  });

  describe("historical_benchmark_apy action", () => {
    it("should transform the response correctly", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          data: [
            {
              timestamp: 1704067200,
              apy: {
                "1day": {
                  base: 0.5,
                  reward: 0.3,
                  total: 0.8,
                },
                "7day": {
                  base: 0.5,
                  reward: 0.3,
                  total: 0.8,
                },

                "30day": {
                  base: 0.5,
                  reward: 0.3,
                  total: 0.8,
                },
              },
            },
          ],
        }),
      );
      const args = {
        network: "mainnet" as const,
        benchmarkCode: "eth" as const,
        fromDate: "2024-01-01T00:00:00Z",
        toDate: "2024-01-02T00:00:00Z",
        page: 1,
        perPage: 10,
      };
      const result = await provider.historicalBenchmarkApy(mockWalletProvider, args);
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toEqual({
        data: [
          {
            timestamp: "2024-01-01T00:00:00.000Z",
            apy: {
              "1day": {
                base: "50.00%",
                reward: "30.00%",
                total: "80.00%",
              },
              "7day": {
                base: "50.00%",
                reward: "30.00%",
                total: "80.00%",
              },
              "30day": {
                base: "50.00%",
                reward: "30.00%",
                total: "80.00%",
              },
            },
          },
        ],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {
        network: "mainnet" as const,
        benchmarkCode: "eth" as const,
        fromDate: "2024-01-01T00:00:00Z",
        toDate: "2024-01-02T00:00:00Z",
        page: 1,
        perPage: 10,
      };
      expect(await provider.historicalBenchmarkApy(mockWalletProvider, args)).toBe(
        "Failed to fetch historical benchmark: some more info",
      );
    });
  });

  describe("total_vault_returns action", () => {
    it("should return the response", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          data: {
            totalReturns: 1000000,
          },
        }),
      );
      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };
      const result = await provider.totalVaultReturns(mockWalletProvider, args);
      expect(JSON.parse(result)).toEqual({
        data: {
          totalReturns: 1000000,
        },
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };
      expect(await provider.totalVaultReturns(mockWalletProvider, args)).toBe(
        "Failed to fetch total vault returns: some more info",
      );
    });
  });

  describe("user_events action", () => {
    it("should transform the response correctly", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(200, {
          data: [
            {
              timestamp: 1704067200,
              action: "deposit",
              amount: 1000000,
            },
          ],
        }),
      );
      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };
      const result = await provider.userEvents(mockWalletProvider, args);
      expect(JSON.parse(result)).toEqual({
        data: [
          {
            timestamp: "2024-01-01T00:00:00.000Z",
            action: "deposit",
            amount: 1000000,
          },
        ],
      });
    });

    it("should return an error if the API request fails", async () => {
      mockedFetch.mockResolvedValue(
        mockFetchResult(500, { error: "Internal Server Error", message: "some more info" }),
      );
      const args = {
        vaultAddress: "0x123456",
        network: "mainnet" as const,
      };
      expect(await provider.userEvents(mockWalletProvider, args)).toBe(
        "Failed to fetch user events: some more info",
      );
    });
  });
});
