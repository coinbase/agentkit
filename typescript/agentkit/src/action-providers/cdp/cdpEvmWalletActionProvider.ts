import { ActionProvider } from "../actionProvider";
import { CdpEvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

/**
 * CdpEvmWalletActionProvider is an action provider for Cdp.
 *
 * This provider is used for any action that requires a CDP Wallet.
 */
class CdpEvmWalletActionProvider extends ActionProvider<CdpEvmWalletProvider> {
  /**
   * Constructor for the CdpEvmWalletActionProvider class.
   */
  constructor() {
    super("cdp_evm", []);
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const cdpEvmWalletActionProvider = () => new CdpEvmWalletActionProvider();
