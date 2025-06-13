/**
 * ZerionActionProvider Tests
 */

import { ZerionActionProvider } from "./zerionActionProvider";
import { Network } from "../../network";
import { formatPortfolioData, formatPositionsData } from "./utils";

// Mocks for fetch and utils
global.fetch = jest.fn();
jest.mock("./utils", () => ({
  formatPortfolioData: jest.fn(() => "formatted portfolio"),
  formatPositionsData: jest.fn(() => "formatted positions"),
}));

describe("ZerionActionProvider", () => {
  const mockApiKey = "test-api-key";
  const originalEnv = process.env.ZERION_API_KEY;

  const mockFungiblePositionResponse = {
    links: {
      self: "https://api.zerion.io/v1/wallets/0x42b9df65b219b3dd36ff330a4dd8f327a6ada990/positions/",
    },
    data: [
      {
        type: "positions",
        id: "0x111c47865ade3b172a928df8f990bc7f2a3b9aaa-polygon-asset-none-",
        attributes: {
          parent: "0x111c47865ade3b172a928df8f990bc7f2a3b9aaa-polygon-asset-none-",
          protocol: null,
          pool_address: "0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa",
          name: "Asset",
          group_id: "0a771a0064dad468045899032c7fb01a971f973f7dff0a5cdc3ce199f45e94d7",
          position_type: "deposit",
          quantity: {
            int: "12345678",
            decimals: 5,
            float: 123.45678,
            numeric: "123.45678",
          },
          value: 5.384656557642683,
          price: 0.043615722,
          changes: {
            absolute_1d: 0.272309794,
            percent_1d: 5.326512552079021,
          },
          fungible_info: {
            name: "Bankless BED Index",
            symbol: "BED",
            description: "The BED index is meant to track crypto’s top 3 investab...",
            icon: {
              url: "https://token-icons.s3.amazonaws.com/0x0391d2021f89dc339f60fff84546ea23e337750f.png",
            },
            flags: {
              verified: true,
            },
            implementations: [
              {
                chain_id: "ethereum",
                address: "0x2af1df3ab0ab157e1e2ad8f88a7d04fbea0c7dc6",
                decimals: 18,
              },
            ],
          },
          flags: {
            displayable: true,
            is_trash: true,
          },
          updated_at: "2023-11-10T23:00:00Z",
          updated_at_block: 0,
          application_metadata: {
            name: "AAVE",
            icon: {
              url: "https://token-icons.s3.amazonaws.com/0x0391d2021f89dc339f60fff84546ea23e337750f.png",
            },
            url: "https://app.aave.com/",
          },
        },
        relationships: {
          chain: {
            links: {
              related: "https://api.zerion.io/v1/chains/polygon",
            },
            data: {
              type: "chains",
              id: "polygon",
            },
          },
          fungible: {
            links: {
              related:
                "https://api.zerion.io/v1/fungibles/0x111c47865ade3b172a928df8f990bc7f2a3b9aaa",
            },
            data: {
              type: "fungibles",
              id: "0x111c47865ade3b172a928df8f990bc7f2a3b9aaa",
            },
          },
          dapp: {
            data: {
              type: "dapps",
              id: "aave-v3",
            },
          },
        },
      },
    ],
  };

  const mockPortfolioResponse = {
    links: {
      self: "https://api.zerion.io/v1/wallets/0x42b9df65b219b3dd36ff330a4dd8f327a6ada990/portfolio",
    },
    data: {
      type: "portfolio",
      id: "0x42b9df65b219b3dd36ff330a4dd8f327a6ada990",
      attributes: {
        positions_distribution_by_type: {
          wallet: 1864.774102420957,
          deposited: 78.04192492782934,
          borrowed: 0.9751475798305564,
          locked: 5.780032725068765,
          staked: 66.13183205505294,
        },
        positions_distribution_by_chain: {
          arbitrum: 458.3555051522226,
          aurora: 72.01031337463428,
          avalanche: 17.128850607339444,
          base: 55.01550749900544,
          "binance-smart-chain": 5.561075880033699,
          celo: 31.293849330045006,
          ethereum: 1214.009900354964,
          fantom: 84.58514074264951,
          linea: 8.258227109505139,
          optimism: 573.032664994399,
          polygon: 64.31407562634853,
          xdai: 113.1679493137936,
          "zksync-era": 9.451002156306377,
        },
        total: {
          positions: 2017.4858230069574,
        },
        changes: {
          absolute_1d: 102.0271468171374,
          percent_1d: 5.326512552079021,
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ZERION_API_KEY = mockApiKey;
  });

  afterAll(() => {
    process.env.ZERION_API_KEY = originalEnv;
  });

  it("should throw if no API key is provided", () => {
    delete process.env.ZERION_API_KEY;
    expect(() => new ZerionActionProvider()).toThrow("ZERION_API_KEY is not configured.");
  });

  it("should use provided API key from config", () => {
    const provider = new ZerionActionProvider({ apiKey: "foo" });
    expect(provider).toBeDefined();
  });

  // supportsNetwork tests
  const provider = new ZerionActionProvider({ apiKey: mockApiKey });

  it("should support the protocol family", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm" } as Network)).toBe(true);
  });

  it("should not support other protocol families", () => {
    expect(provider.supportsNetwork({ protocolFamily: "other-protocol-family" } as Network)).toBe(
      false,
    );
  });

  it("should handle invalid network objects", () => {
    expect(provider.supportsNetwork({ protocolFamily: "invalid-protocol" } as Network)).toBe(false);
    expect(provider.supportsNetwork({} as Network)).toBe(false);
  });

  describe("getPortfolioOverview", () => {
    const validAddress = "0x42b9df65b219b3dd36ff330a4dd8f327a6ada990";
    const invalidAddress = "invalid-address";
    const provider = new ZerionActionProvider({ apiKey: mockApiKey });

    it("returns error for invalid address", async () => {
      const result = await provider.getPortfolioOverview({ walletAddress: invalidAddress });
      expect(result).toMatch(/Invalid wallet address/);
    });

    it("returns formatted data for valid address", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockPortfolioResponse),
      });
      const result = await provider.getPortfolioOverview({ walletAddress: validAddress });
      expect(formatPortfolioData).toHaveBeenCalledWith(mockPortfolioResponse.data);
      expect(result).toBe("formatted portfolio");
    });

    it("returns error on fetch failure", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("fail"));
      const result = await provider.getPortfolioOverview({ walletAddress: validAddress });
      expect(result).toMatch(/Error fetching portfolio overview/);
    });
  });

  describe("getFungiblePositions", () => {
    const validAddress = "0x42b9df65b219b3dd36ff330a4dd8f327a6ada990";
    const invalidAddress = "invalid-address";
    const provider = new ZerionActionProvider({ apiKey: mockApiKey });

    it("returns error for invalid address", async () => {
      const result = await provider.getFungiblePositions({ walletAddress: invalidAddress });
      expect(result).toMatch(/Invalid wallet address/);
    });

    it("returns formatted data for valid address", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockFungiblePositionResponse),
      });
      const result = await provider.getFungiblePositions({ walletAddress: validAddress });
      expect(formatPositionsData).toHaveBeenCalledWith(mockFungiblePositionResponse.data);
      expect(result).toBe("formatted positions");
    });

    it("returns error on fetch failure", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("fail"));
      const result = await provider.getFungiblePositions({ walletAddress: validAddress });
      expect(result).toMatch(/Error fetching fungible positions/);
    });
  });
});
