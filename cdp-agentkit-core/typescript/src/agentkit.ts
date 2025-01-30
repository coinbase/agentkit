import { WalletProvider, CdpWalletProvider } from "./wallet_providers";
import { Action, ActionProvider } from "./action_providers";

/**
 * Configuration options for AgentKit
 */
interface AgentKitOptions {
  walletProvider?: WalletProvider;
  actionProviders?: ActionProvider[];
  actions?: Action[];
}

/**
 * AgentKit
 */
export class AgentKit {
  private walletProvider: WalletProvider;
  private actionProviders?: ActionProvider[];
  private actions?: Action[];

  /**
   * Initializes a new AgentKit instance
   *
   * @param config - Configuration options for the AgentKit
   * @param config.walletProvider - The wallet provider to use
   * @param config.actionProviders - The action providers to use
   * @param config.actions - The actions to use
   */
  public constructor(config: AgentKitOptions = {}) {
    this.walletProvider = config.walletProvider || new CdpWalletProvider();
    this.actionProviders = config.actionProviders || [];
    this.actions = config.actions || [];
  }

  /**
   * Returns the actions available to the AgentKit.
   *
   * @returns An array of actions
   */
  public getActions(): Action[] {
    let actions: Action[] = this.actions || [];

    if (this.actionProviders) {
      for (const actionProvider of this.actionProviders) {
        if (actionProvider.supportsNetwork(this.walletProvider.getNetwork())) {
          actions = actions.concat(actionProvider.getActions(this.walletProvider));
        }
      }
    }

    return actions;
  }
}
