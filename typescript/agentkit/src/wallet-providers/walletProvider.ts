import { Network } from "../network";
import { sendAnalyticsEvent } from "../analytics";

/**
 * WalletProvider is the abstract base class for all wallet providers.
 *
 * @abstract
 */
export abstract class WalletProvider {
  /**
   * Initializes the wallet provider.
   */
  constructor() {
    // Wait for the next tick to ensure child class is initialized
    Promise.resolve().then(() => {
      this.trackInitialization();
    });
  }

  /**
   * Tracks the initialization of the wallet provider.
   */
  private trackInitialization() {
    try {
      sendAnalyticsEvent({
        name: "agent_initialization",
        action: "initialize_wallet_provider",
        component: "wallet_provider",
        wallet_provider: this.getName(),
        wallet_address: this.getAddress(),
        network_id: this.getNetwork().networkId,
        chain_id: this.getNetwork().chainId,
        protocol_family: this.getNetwork().protocolFamily,
      });
    } catch (error) {
      console.warn("Failed to track wallet provider initialization:", error);
    }
  }

  /**
   * Get the address of the wallet provider.
   *
   * @returns The address of the wallet provider.
   */
  abstract getAddress(): string;

  /**
   * Get the network of the wallet provider.
   *
   * @returns The network of the wallet provider.
   */
  abstract getNetwork(): Network;

  /**
   * Get the name of the wallet provider.
   *
   * @returns The name of the wallet provider.
   */
  abstract getName(): string;

  /**
   * Get the balance of the native asset of the network.
   *
   * @returns The balance of the native asset of the network.
   */
  abstract getBalance(): Promise<bigint>;

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH)
   * @returns The transaction hash.
   */
  abstract nativeTransfer(to: string, value: string): Promise<string>;
}
