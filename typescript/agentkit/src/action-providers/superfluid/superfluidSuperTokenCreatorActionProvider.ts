import { z } from "zod";
import { SuperfluidCreateSuperTokenSchema } from "./schemas";
import {
  SuperTokenFactoryAddress,
  SuperTokenFactoryAddress_Base_Sepolia,
  SuperTokenFactoryABI,
} from "./constants";
import { encodeFunctionData, Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { erc20Abi as ERC20ABI } from "viem";
import { extractCreatedSuperTokenAddressAbi } from "./utils/parseLogs";

/**
 * SuperfluidSuperTokenCreatorActionProvider is an action provider for Superfluid interactions.
 */
export class SuperfluidSuperTokenCreatorActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the SuperfluidSuperTokenCreatorActionProvider class.
   */
  constructor() {
    super("superfluid-super-token-creator", []);
  }

  /**
   * Creates a new Super token
   *
   * @param walletProvider - The wallet provider to start the stream from.
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "create_super_token",
    description: `
This action will create a Super token, essentially a wrapper token around an ERC20 that can freely stream between wallets.
It will return the address of the newly created Supertoken.
You should only take this action when requested.  A Supertoken implementation is needed to stream tokens or to wrap an ERC20 token.
`,
    schema: SuperfluidCreateSuperTokenSchema,
  })
  async createSuperToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SuperfluidCreateSuperTokenSchema>,
  ): Promise<string> {
    try {
      const decimals = await walletProvider.readContract({
        address: args.erc20TokenAddress as Hex,
        abi: ERC20ABI,
        functionName: "decimals",
        args: [],
      });

      const name = await walletProvider.readContract({
        address: args.erc20TokenAddress as Hex,
        abi: ERC20ABI,
        functionName: "name",
        args: [],
      });

      const symbol = await walletProvider.readContract({
        address: args.erc20TokenAddress as Hex,
        abi: ERC20ABI,
        functionName: "symbol",
        args: [],
      });

      const createSuperTokenData = encodeFunctionData({
        abi: SuperTokenFactoryABI,
        functionName: "createERC20Wrapper",
        args: [
          args.erc20TokenAddress,
          decimals,
          2, // upgradeable
          `Super ${name}`,
          `${symbol}x`,
        ],
      });

      const superTokenFactoryAddress =
        walletProvider.getNetwork().networkId === "base-sepolia"
          ? (SuperTokenFactoryAddress_Base_Sepolia as `0x${string}`)
          : (SuperTokenFactoryAddress as `0x${string}`);

      const createSuperTokenHash = await walletProvider.sendTransaction({
        to: superTokenFactoryAddress,
        data: createSuperTokenData,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(createSuperTokenHash);

      const superTokenAddress = extractCreatedSuperTokenAddressAbi(
        receipt,
        superTokenFactoryAddress,
      );

      return `Created super token for ${args.erc20TokenAddress}.  Super token address at ${superTokenAddress}  Transaction hash: ${createSuperTokenHash}`;
    } catch (error) {
      return `Error creating Superfluid Super Token: ${error}`;
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

export const superfluidSuperTokenCreatorActionProvider = () =>
  new SuperfluidSuperTokenCreatorActionProvider();
