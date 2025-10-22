import { pruneGetProtocolResponse } from "./utils";
import { ProtocolResponse, TimeSeriesDataPoint, TokenTimeSeriesDataPoint } from "./types";

describe("DefiLlama Utilities", () => {
  describe("pruneGetProtocolResponse", () => {
    it("should handle null input", () => {
      expect(pruneGetProtocolResponse(null)).toBeNull();
    });

    it("should not modify objects without time-series data", () => {
      const input: ProtocolResponse = {
        id: "test-protocol",
        name: "Protocol",
        symbol: "ABC",
      };
      const result = pruneGetProtocolResponse(input);
      expect(result).not.toBeNull();
      expect(result).toEqual(input);
    });

    it("should prune time-series arrays", () => {
      const timeSeriesData: TimeSeriesDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        date: Date.now() - i * 86400000,
        totalLiquidityUSD: 1000 + i,
      }));

      const input: ProtocolResponse = {
        id: "test-protocol",
        name: "Protocol",
        tvl: [...timeSeriesData],
      };

      const result = pruneGetProtocolResponse(input, 5);
      expect(result).not.toBeNull();

      if (result) {
        expect(result.name).toBe("Protocol");
        expect(result.tvl).toHaveLength(5);

        const resultDates = result.tvl!.map(entry => entry.date);
        const sortedDates = [...resultDates].sort((a, b) => b - a);
        expect(resultDates).toEqual(sortedDates);
      }
    });

    it("should prune nested time-series arrays in chainTvls", () => {
      const timeSeriesData: TimeSeriesDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        date: Date.now() - i * 86400000,
        totalLiquidityUSD: 1000 + i,
      }));

      const tokenTimeSeriesData: TokenTimeSeriesDataPoint[] = Array.from(
        { length: 20 },
        (_, i) => ({
          date: Date.now() - i * 86400000,
          tokens: { ETH: 1000 + i },
        }),
      );

      const input: ProtocolResponse = {
        id: "test-protocol",
        name: "Protocol",
        chainTvls: {
          Ethereum: {
            tvl: [...timeSeriesData],
            tokens: [...tokenTimeSeriesData],
          },
          Polygon: {
            tvl: [...timeSeriesData],
            tokensInUsd: [...tokenTimeSeriesData],
          },
        },
      };

      const result = pruneGetProtocolResponse(input, 3);
      expect(result).not.toBeNull();

      if (result) {
        expect(result.name).toBe("Protocol");
        expect(result.chainTvls).toBeDefined();

        if (result.chainTvls) {
          expect(result.chainTvls.Ethereum.tvl).toHaveLength(3);
          expect(result.chainTvls.Ethereum.tokens).toHaveLength(3);
          expect(result.chainTvls.Polygon.tvl).toHaveLength(3);
          expect(result.chainTvls.Polygon.tokensInUsd).toHaveLength(3);

          const ethereumTvlDates = result.chainTvls.Ethereum.tvl!.map(entry => entry.date);
          const sortedDates = [...ethereumTvlDates].sort((a, b) => b - a);
          expect(ethereumTvlDates).toEqual(sortedDates);
        }
      }
    });

    it("should respect the maxEntries parameter", () => {
      const timeSeriesData: TimeSeriesDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
        date: Date.now() - i * 86400000,
        totalLiquidityUSD: 1000 + i,
      }));

      const tokenTimeSeriesData: TokenTimeSeriesDataPoint[] = Array.from(
        { length: 50 },
        (_, i) => ({
          date: Date.now() - i * 86400000,
          tokens: { ETH: 1000 + i },
        }),
      );

      const input: ProtocolResponse = {
        id: "test-protocol",
        name: "Protocol",
        tvl: [...timeSeriesData],
        tokens: [...tokenTimeSeriesData],
      };

      const result1 = pruneGetProtocolResponse(input, 1);
      expect(result1).not.toBeNull();

      if (result1) {
        expect(result1.tvl).toHaveLength(1);
        expect(result1.tokens).toHaveLength(1);
      }

      const result10 = pruneGetProtocolResponse(input, 10);
      expect(result10).not.toBeNull();

      if (result10) {
        expect(result10.tvl).toHaveLength(10);
        expect(result10.tokens).toHaveLength(10);
      }
    });

    it("should handle arrays without date property", () => {
      const nonDateArray = Array.from({ length: 20 }, (_, i) => ({
        value: 1000 + i,
        name: `Item ${i}`,
      }));

      // Using a type assertion for this test case as it's testing a specific behavior
      const input = {
        id: "test-protocol",
        name: "Protocol",
        tvl: [...nonDateArray],
      } as unknown as ProtocolResponse;

      const result = pruneGetProtocolResponse(input, 5);
      expect(result).not.toBeNull();

      if (result) {
        expect(result.tvl).toHaveLength(5);
      }
    });
  });
});
