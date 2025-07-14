import { ActionProvider } from "../actionProvider";
import { CdpSolanaWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

/**
 * CdpSolanaWalletActionProvider is an action provider for Cdp.
 *
 * This provider is used for any action that requires a CDP Wallet.
 */
class CdpSolanaWalletActionProvider extends ActionProvider<CdpSolanaWalletProvider> {
  /**
   * Constructor for the CdpSolanaWalletActionProvider class.
   */
  constructor() {
    super("cdp_solana", []);
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "solana";
}

export const cdpSolanaWalletActionProvider = () => new CdpSolanaWalletActionProvider();
