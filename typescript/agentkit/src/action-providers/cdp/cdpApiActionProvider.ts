import { z } from "zod";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { RequestFaucetFundsV2Schema } from "./schemas";
import {
  getCdpClient,
  validateNetworkSupport,
  handleEvmFaucet,
  handleSvmFaucet,
} from "./faucetUtils";

/**
 * CdpApiActionProvider is an action provider for CDP API.
 *
 * This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
 */
export class CdpApiActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the CdpApiActionProvider class.
   */
  constructor() {
    super("cdp_api", []);
  }

  /**
   * Requests test tokens from the faucet for the default address in the wallet.
   *
   * @param walletProvider - The wallet provider to request funds from.
   * @param args - The input arguments for the action.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "request_faucet_funds",
    description: `This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia', user can only provide asset ID 'eth', 'usdc', 'eurc' or 'cbbtc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol' or 'usdc', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.`,
    schema: RequestFaucetFundsV2Schema,
  })
  async faucet(
    walletProvider: WalletProvider,
    args: z.infer<typeof RequestFaucetFundsV2Schema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const networkId = network.networkId!;
    const address = walletProvider.getAddress();

    const cdpClient = getCdpClient(walletProvider);
    validateNetworkSupport(network, networkId);

    return network.protocolFamily === "evm"
      ? handleEvmFaucet(cdpClient, address, networkId, args)
      : handleSvmFaucet(cdpClient, address, args);
  }

  /**
   * Checks if the CDP action provider supports the given network.
   *
   * NOTE: Network scoping is done at the action implementation level
   *
   * @param _ - The network to check.
   * @returns True if the CDP action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network) => true;
}

export const cdpApiActionProvider = () => new CdpApiActionProvider();
