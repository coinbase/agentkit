import { uniswapActionProvider } from "../uniswapActionProvider";

describe("UniswapActionProvider", () => {
  const actionProvider = uniswapActionProvider();

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      expect(actionProvider.supportsNetwork({ networkId: "base-mainnet", protocolFamily: "evm" })).toBe(true);
    });

    it("should return true for base-sepolia", () => {
      expect(actionProvider.supportsNetwork({ networkId: "base-sepolia", protocolFamily: "evm" })).toBe(true);
    });

    it("should return false for ethereum-mainnet", () => {
      expect(actionProvider.supportsNetwork({ networkId: "ethereum-mainnet", protocolFamily: "evm" })).toBe(false);
    });

    it("should return false for solana", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana", networkId: "solana-mainnet" })).toBe(false);
    });
  });
}); 