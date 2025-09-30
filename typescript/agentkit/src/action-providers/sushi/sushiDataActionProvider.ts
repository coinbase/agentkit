import { z } from "zod";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { FindTokenSchema } from "./sushiDataSchemas";
import { SUSHI_DATA_API_HOST, isEvmChainId, getEvmChainById } from "sushi/evm";
import { isAddress } from "viem";

/**
 * SushiDataActionProvider is an action provider for Sushi.
 *
 * This provider is used for any action that uses the Sushi Data API.
 */
export class SushiDataActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the SushiDataActionProvider class.
   */
  constructor() {
    super("sushi-data", []);
  }

  /**
   * Swaps a specified amount of a from token to a to token for the wallet.
   *
   * @param walletProvider - The wallet provider to swap the tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the swap details.
   */
  @CreateAction({
    name: "find-token",
    description: `This tool finds tokens (erc20) using the Sushi Data API
It takes the following inputs:
- Search: Either the token symbol (either full or partial) or token address to search for

Important notes:
- Only returns the first 10 tokens found
- Always use the full token symbol for better results
- Always use this tool to verify the token address if you are not sure about the address
`,
    schema: FindTokenSchema,
  })
  async findToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FindTokenSchema>,
  ): Promise<string> {
    try {
      const chainId = Number((await walletProvider.getNetwork()).chainId);
      if (!isEvmChainId(chainId)) {
        return `Unsupported chainId: ${chainId}`;
      }

      const request = await fetch(`${SUSHI_DATA_API_HOST}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: `{"query":"query { tokenList(chainId: ${chainId}, first: 10, search: \\"${args.search}\\") { address symbol name decimals } }"}`,
      });

      const response = await request.json();

      const schema = z.object({
        data: z.object({
          tokenList: z.array(
            z.object({
              address: z.string().refine(val => isAddress(val, { strict: false })),
              symbol: z.string(),
              name: z.string(),
              decimals: z.number(),
            }),
          ),
        }),
      });

      const result = schema.safeParse(response);

      if (!result.success) {
        return `Error parsing response: ${result.error.message}`;
      }

      const tokens = result.data.data.tokenList;

      const chain = getEvmChainById(chainId);

      let message = `Found ${tokens.length} tokens on ${chain.shortName}:`;
      tokens.forEach(token => {
        message += `\n- ${token.symbol} (${token.name}) - ${token.address}`;
      });
      return message;
    } catch (error) {
      return `Error finding tokens: ${error}`;
    }
  }

  /**
   * Custom action providers are supported on all networks
   *
   * @param network - The network to checkpointSaver
   * @returns True if the network is supported, false otherwise
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm" || !network.chainId) {
      return false;
    }

    return isEvmChainId(Number(network.chainId));
  }
}

export const sushiDataActionProvider = () => new SushiDataActionProvider();
