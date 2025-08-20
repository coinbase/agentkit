import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { SuperfluidStreamActionProvider } from "./superfluidStreamActionProvider";
import { SuperfluidPoolActionProvider } from "./superfluidPoolActionProvider";
import { SuperfluidQueryActionProvider } from "./superfluidQueryActionProvider";
import { SuperfluidWrapperActionProvider } from "./superfluidWrapperActionProvider";
import { SuperfluidSuperTokenCreatorActionProvider } from "./superfluidSuperTokenCreatorActionProvider";

/**
 * SuperfluidActionProvider aggregates all Superfluid-related actions into a single provider.
 */
export class SuperfluidActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Superfluid Action Provider constructor
   */
  constructor() {
    super("superfluid", [
      new SuperfluidStreamActionProvider(),
      new SuperfluidPoolActionProvider(),
      new SuperfluidQueryActionProvider(),
      new SuperfluidWrapperActionProvider(),
      new SuperfluidSuperTokenCreatorActionProvider(),
    ]);
  }

  /**
   * Supports Base mainnet and Base sepolia like the underlying Superfluid providers.
   *
   * @param network - network to check
   * @returns - A boolean if this action provider supports the network
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}
export const superfluidActionProvider = () => new SuperfluidActionProvider();
