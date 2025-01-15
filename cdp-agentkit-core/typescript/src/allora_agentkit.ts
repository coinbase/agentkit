import { AlloraAPIClient, ChainSlug } from "@alloralabs/allora-sdk";
import { AlloraAction, AlloraActionSchemaAny } from "./actions/cdp/allora";

interface AlloraAgentkitOptions {
  apiKey?: string;
  baseAPIUrl?: string;
  chainSlug?: string;
}

export class AlloraAgentkit {
  private client: AlloraAPIClient;

  constructor(config: AlloraAgentkitOptions = {}) {
    const apiKey = config.apiKey || process.env.ALLORA_API_KEY || "UP-4151d0cc489a44a7aa5cd7ef";
    const baseAPIUrl = config.baseAPIUrl || process.env.ALLORA_BASE_API_URL;
    const chainSlug = config.chainSlug || process.env.ALLORA_CHAIN_SLUG || ChainSlug.TESTNET;

    if (!Object.values(ChainSlug).includes(chainSlug as ChainSlug)) {
      throw new Error(
        `Invalid chainSlug: ${chainSlug}. Valid options are: ${Object.values(ChainSlug).join(", ")}`,
      );
    }

    this.client = new AlloraAPIClient({
      apiKey,
      baseAPIUrl,
      chainSlug: chainSlug as ChainSlug,
    });
  }

  /**
   * Executes a Allora action.
   *
   * @param action - The Allora action to execute.
   * @param args - The arguments for the action.
   * @returns The result of the execution.
   */
  async run<TActionSchema extends AlloraActionSchemaAny>(
    action: AlloraAction<TActionSchema>,
    args: TActionSchema,
  ): Promise<string> {
    return await action.func(this.client!, args);
  }
}
