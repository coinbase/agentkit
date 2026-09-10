import { graphAdvocateActionProvider, GraphAdvocateActionProvider } from "./graphAdvocateActionProvider";
import { Network } from "../../network";

describe("GraphAdvocateActionProvider", () => {
  let provider: GraphAdvocateActionProvider;

  beforeEach(() => {
    provider = graphAdvocateActionProvider({ maxPaymentUsdc: 0.1 });
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

  describe("payment cap guard", () => {
    it("refuses an action priced above maxPaymentUsdc before signing", async () => {
      // maxPaymentUsdc of 0.001 is below every endpoint price, so the action
      // must return a 'Payment exceeds limit' error and never touch the wallet.
      const capped = graphAdvocateActionProvider({ maxPaymentUsdc: 0.001 });
      const result = await capped.getHyperliquidTraderScore(
        {} as never,
        { wallet: "0x38e598961dd0456a7fb2e758bd433d3e59fb8a4a" },
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Payment exceeds limit");
    });
  });

  describe("wallet provider guard", () => {
    it("rejects a non-EVM wallet provider", async () => {
      const result = await provider.getAgentReputation(
        {} as never, // not an EvmWalletProvider
        { wallet: "0x38e598961dd0456a7fb2e758bd433d3e59fb8a4a" },
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Unsupported wallet provider");
    });
  });
});
