import { ActionProvider } from "../actionProvider";
import { CdpSmartWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

/**
 * CdpSmartWalletActionProvider is an action provider for Cdp.
 *
 * This provider is used for any action that requires a CDP Wallet.
 */
class CdpSmartWalletActionProvider extends ActionProvider<CdpSmartWalletProvider> {
  /**
   * Constructor for the CdpSmartWalletActionProvider class.
   */
  constructor() {
    super("cdp_smart_wallet", []);
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const cdpSmartWalletActionProvider = () => new CdpSmartWalletActionProvider();
