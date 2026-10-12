import * as walletProviders from "../../src/wallet-providers";
import { WALLET_PROVIDERS_BY_PROTOCOL } from "./constants";

describe("WALLET_PROVIDERS_BY_PROTOCOL", () => {
  it("only includes exported wallet providers", () => {
    const exportedWalletProviders = new Set(Object.keys(walletProviders));
    const configuredWalletProviders = Object.values(WALLET_PROVIDERS_BY_PROTOCOL).flatMap(
      providers => providers.map(provider => provider.value),
    );

    expect(configuredWalletProviders).toEqual(
      expect.arrayContaining([
        "CdpEvmWalletProvider",
        "CdpSmartWalletProvider",
        "PrivyEvmDelegatedEmbeddedWalletProvider",
        "CdpSolanaWalletProvider",
      ]),
    );

    for (const walletProvider of configuredWalletProviders) {
      expect(exportedWalletProviders.has(walletProvider)).toBe(true);
    }
  });
});
