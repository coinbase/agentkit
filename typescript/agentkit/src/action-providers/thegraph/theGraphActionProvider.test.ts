import { theGraphActionProvider, TheGraphActionProvider } from "./theGraphActionProvider";
import { toFulltext, parseHits } from "./queries";
import { Network } from "../../network";

describe("TheGraphActionProvider", () => {
  let provider: TheGraphActionProvider;

  beforeEach(() => {
    provider = theGraphActionProvider({ maxPaymentUsdc: 0.05 });
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as Network)).toBe(true);
    });

    it("does not support other networks", () => {
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as Network)).toBe(false);
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as Network)).toBe(false);
    });
  });

  describe("wallet provider guard", () => {
    it("rejects a non-EVM wallet provider before any network call", async () => {
      const result = await provider.querySubgraph(
        {} as never, // not an EvmWalletProvider
        { subgraphId: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV", query: "{ _meta { block { number } } }" },
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Unsupported wallet provider");
    });
  });

  describe("toFulltext", () => {
    it("builds a prefix tsquery from free text", () => {
      expect(toFulltext("uniswap v3")).toBe("uniswap:* & v3:*");
      expect(toFulltext("Aave, Lending!")).toBe("aave:* & lending:*");
    });
  });

  describe("parseHits", () => {
    it("maps and sorts subgraphMetadataSearch results by signal", () => {
      const raw = {
        data: {
          subgraphMetadataSearch: [
            {
              displayName: "Low",
              description: "d1",
              categories: ["defi"],
              subgraphs: [
                {
                  id: "sgLow",
                  active: true,
                  currentSignalledTokens: String(1e18),
                  currentVersion: { subgraphDeployment: { ipfsHash: "Qm1", queryFeesAmount: String(2e18) } },
                },
              ],
            },
            {
              displayName: "High",
              description: "d2",
              categories: ["nft"],
              subgraphs: [
                {
                  id: "sgHigh",
                  active: true,
                  currentSignalledTokens: String(9e18),
                  currentVersion: { subgraphDeployment: { ipfsHash: "Qm2", queryFeesAmount: String(3e18) } },
                },
              ],
            },
          ],
        },
      };
      const hits = parseHits(raw);
      expect(hits.map(h => h.subgraphId)).toEqual(["sgHigh", "sgLow"]);
      expect(hits[0].currentSignalledTokensGRT).toBe(9);
      expect(hits[0].queryFeesGRT).toBe(3);
    });
  });
});
