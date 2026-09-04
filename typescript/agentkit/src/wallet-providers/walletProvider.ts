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
    const onError = (error: unknown) =>
      console.warn("Failed to track wallet provider initialization:", error);

    try {
      // `sendAnalyticsEvent` is async and rejects on a non-ok response or a
      // network failure. The surrounding try/catch only catches synchronous
      // throws, so the rejection has to be handled here. Otherwise it becomes
      // an unhandled rejection, which terminates the host process on Node 15+.
      sendAnalyticsEvent({
        name: "agent_initialization",
        action: "initialize_wallet_provider",
        component: "wallet_provider",
        wallet_provider: this.getName(),
        wallet_address: this.getAddress(),
        network_id: this.getNetwork().networkId,
        chain_id: this.getNetwork().chainId,
        protocol_family: this.getNetwork().protocolFamily,
      }).catch(onError);
    } catch (error) {
      onError(error);
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
   * @param value - The amount to transfer in atomic units (e.g. Wei for EVM, Lamports for Solana)
   * @returns The transaction hash.
   */
  abstract nativeTransfer(to: string, value: string): Promise<string>;
}
