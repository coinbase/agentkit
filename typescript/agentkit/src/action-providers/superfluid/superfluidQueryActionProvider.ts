import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EmptySchema } from "./schemas";
import { getAccountOutflow } from "./graphQueries/superfluidGraphQueries";

/**
 * SuperfluidQueryActionProvider is an action provider for Superfluid interactions.
 */
export class SuperfluidQueryActionProvider extends ActionProvider {
  /**
   * Constructor for the SuperfluidQueryActionProvider class.
   */
  constructor() {
    super("superfluid-query", []);
  }

  /**
   * Gets a list of addresses to which a stream is open
   *
   * @param walletProvider - The wallet of the agent.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "query_streams",
    description: `
This tool will query the Superfluid subgraph to find a list of addresses to which you are streaming a token.
It takes nothing as input; you will be checking against your own wallet.
It returns an array of account outflows, each with a receiver (wallet address), a token, and a flow rate. If the flow rate is greater than zero, there is a current flow.
`,
    schema: EmptySchema,
  })
  async queryStreams(walletProvider: EvmWalletProvider): Promise<string> {
    try {
      const accountData = await getAccountOutflow(walletProvider.getAddress());
      const outflows = accountData?.accounts?.length ? accountData?.accounts[0].outflows : [];
      const activeOutflows = outflows.filter(o => {
        return parseInt(o.currentFlowRate) > 0;
      });

      return `Current outflows are ${JSON.stringify(activeOutflows)}`;
    } catch (error) {
      return `Error querying Superfluid streams: ${error}`;
    }
  }

  /**
   * Checks if the Superfluid action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Superfluid action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const superfluidQueryActionProvider = () => new SuperfluidQueryActionProvider();
