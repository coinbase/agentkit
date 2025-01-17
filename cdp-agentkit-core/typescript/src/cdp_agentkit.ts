import { Coinbase, MnemonicSeedPhrase, Wallet, WalletData } from "@coinbase/coinbase-sdk";
import { version } from "../package.json";
import { CdpAction, CdpActionSchemaAny } from "./actions/cdp/cdp_action";
import { z } from "zod";

/**
 * Configuration options for the CDP Agentkit
 */
interface CdpAgentkitOptions {
  cdpApiKeyName?: string;
  cdpApiKeyPrivateKey?: string;
  source?: string;
  sourceVersion?: string;
}

/**
 * Configuration options for the CDP Agentkit with a Wallet.
 */
interface ConfigureCdpAgentkitWithWalletOptions extends CdpAgentkitOptions {
  networkId?: string;
  cdpWalletData?: string;
  mnemonicPhrase?: string;
}

/**
 * CDP Agentkit
 */
export class CdpAgentkit {
  private wallet?: Wallet;

  /**
   * Initializes a new CDP Agentkit instance
   *
   * @param config - Configuration options for the CDP Agentkit
   */
  public constructor(config: CdpAgentkitOptions = {}) {
    const cdpApiKeyName = config.cdpApiKeyName || process.env.CDP_API_KEY_NAME;
    const cdpApiKeyPrivateKey = config.cdpApiKeyPrivateKey || process.env.CDP_API_KEY_PRIVATE_KEY;
    const source = config.source;
    const sourceVersion = config.sourceVersion;

    if (!cdpApiKeyName) {
      throw new Error("CDP_API_KEY_NAME is required but not provided");
    }
    if (!cdpApiKeyPrivateKey) {
      throw new Error("CDP_API_KEY_PRIVATE_KEY is required but not provided");
    }

    // Configure CDP SDK
    Coinbase.configure({
      apiKeyName: cdpApiKeyName,
      privateKey: cdpApiKeyPrivateKey.replace(/\\n/g, "\n"),
      source: source || "agentkit-core",
      sourceVersion: sourceVersion || version,
    });
  }

  /**
   * Configures CDP Agentkit with a Wallet.
   *
   * @param config - Optional configuration parameters
   * @returns A Promise that resolves to a new CdpAgentkit instance
   * @throws Error if required environment variables are missing or wallet initialization fails
   */
  public static async configureWithWallet(
    config: ConfigureCdpAgentkitWithWalletOptions = {},
  ): Promise<CdpAgentkit> {
    const agentkit = new CdpAgentkit(config);

    const mnemonicPhrase = config.mnemonicPhrase || process.env.MNEMONIC_PHRASE;
    const networkId = config.networkId || process.env.NETWORK_ID || Coinbase.networks.BaseSepolia;

    try {
      if (config.cdpWalletData) {
        const walletData = JSON.parse(config.cdpWalletData) as WalletData;
        agentkit.wallet = await Wallet.import(walletData);
      } else if (mnemonicPhrase) {
        agentkit.wallet = await Wallet.import({ mnemonicPhrase: mnemonicPhrase }, networkId);
      } else {
        agentkit.wallet = await Wallet.create({ networkId: networkId });
      }
    } catch (error) {
      throw new Error(`Failed to initialize wallet: ${error}`);
    }

    return agentkit;
  }

  /**
   * Executes a CDP action
   *
   * @param action - The CDP action to execute
   * @param args - Arguments for the action
   * @returns Result of the action execution
   * @throws Error if action execution fails
   */
  async run<TActionSchema extends CdpActionSchemaAny>(
    action: CdpAction<TActionSchema>,
    args: TActionSchema,
  ): Promise<string> {
    if (action.func.length > 1) {
      if (!this.wallet) {
        return `Unable to run CDP Action: ${action.name}. A Wallet is required. Please configure CDP Agentkit with a Wallet to run this action.`;
      }

      return await action.func(this.wallet!, args);
    }

    return await (action.func as (args: z.infer<TActionSchema>) => Promise<string>)(args);
  }

  /**
   * Exports wallet data required to re-instantiate the wallet
   *
   * @returns JSON string of wallet data including wallet_id and seed
   */
  async exportWallet(): Promise<string> {
    if (!this.wallet) {
      throw Error("Unable to export wallet. Agentkit is not configured with a wallet.");
    }

    const walletData = this.wallet.export();
    return JSON.stringify({
      ...walletData,
      defaultAddressId: (await this.wallet.getDefaultAddress()).getId(),
    });
  }
}
