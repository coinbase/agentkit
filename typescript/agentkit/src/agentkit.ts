import { WalletProvider, CdpWalletProvider } from "./wallet-providers";
import { Action, ActionProvider, walletActionProvider } from "./action-providers";

/**
 * Configuration options for AgentKit
 */
export type AgentKitOptions = {
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
  walletProvider?: WalletProvider;
  actionProviders?: ActionProvider[];
};

/**
 * AgentKit
 */
export class AgentKit {
  private walletProvider: WalletProvider;
  private actionProviders: ActionProvider[];

  /**
   * Initializes a new AgentKit instance
   *
   * @param config - Configuration options for the AgentKit
   * @param config.walletProvider - The wallet provider to use
   * @param config.actionProviders - The action providers to use
   * @param config.actions - The actions to use
   */
  private constructor(config: AgentKitOptions & { walletProvider: WalletProvider }) {
    this.walletProvider = config.walletProvider;
    this.actionProviders = config.actionProviders || [walletActionProvider()];
  }

  /**
   * Initializes a new AgentKit instance
   *
   * @param config - Configuration options for the AgentKit
   * @param config.walletProvider - The wallet provider to use
   * @param config.actionProviders - The action providers to use
   * @param config.actions - The actions to use
   *
   * @returns A new AgentKit instance
   */
  public static async from(
    config: AgentKitOptions = { actionProviders: [walletActionProvider()] },
  ): Promise<AgentKit> {
    let walletProvider: WalletProvider | undefined = config.walletProvider;

    if (!config.walletProvider) {
      if (!config.cdpApiKeyId || !config.cdpApiKeySecret) {
        throw new Error(
          "cdpApiKeyId and cdpApiKeySecret are required if not providing a walletProvider",
        );
      }

      walletProvider = await CdpWalletProvider.configureWithWallet({
        apiKeyId: config.cdpApiKeyId,
        apiKeySecret: config.cdpApiKeySecret,
      });
    }

    return new AgentKit({ ...config, walletProvider: walletProvider! });
  }

  /**
   * Returns the actions available to the AgentKit.
   *
   * @returns An array of actions
   */
  public getActions(): Action[] {
    const actions: Action[] = [];

    const unsupported: string[] = [];

    for (const actionProvider of this.actionProviders) {
      if (actionProvider.supportsNetwork(this.walletProvider.getNetwork())) {
        actions.push(...actionProvider.getActions(this.walletProvider));
      } else {
        unsupported.push(actionProvider.name);
      }
    }

    if (unsupported.length > 0) {
      console.log(
        `Warning: The following action providers are not supported on the current network and will be unavailable: ${unsupported.join(", ")}`,
      );
      console.log("Current network:", this.walletProvider.getNetwork());
    }

    return actions;
  }
}
