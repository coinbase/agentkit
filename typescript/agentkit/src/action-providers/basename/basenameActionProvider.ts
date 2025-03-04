import { encodeFunctionData, Hex, namehash, parseEther } from "viem";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  L2_RESOLVER_ADDRESS_MAINNET,
  L2_RESOLVER_ADDRESS_TESTNET,
  L2_RESOLVER_ABI,
  REGISTRATION_DURATION,
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
  REGISTRAR_ABI,
} from "./constants";
import { RegisterBasenameSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

/**
 * Action provider for registering Basenames.
 */
export class BasenameActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new BasenameActionProvider.
   */
  constructor() {
    super("basename", []);
  }

  /**
   * Registers a Basename.
   *
   * @param wallet - The wallet to use for the registration.
   * @param args - The arguments for the registration.
   * @returns A string indicating the success or failure of the registration.
   */
  @CreateAction({
    name: "register_basename",
    description: `
This tool will register a Basename for the agent. The agent should have a wallet associated to register a Basename.
When your network ID is 'base-mainnet' (also sometimes known simply as 'base'), the name must end with .base.eth, and when your network ID is 'base-sepolia', it must ends with .basetest.eth.
Do not suggest any alternatives and never try to register a Basename with another postfix. The prefix of the name must be unique so if the registration of the
Basename fails, you should prompt to try again with a more unique name.
`,
    schema: RegisterBasenameSchema,
  })
  async register(
    wallet: EvmWalletProvider,
    args: z.infer<typeof RegisterBasenameSchema>,
  ): Promise<string> {
    const address = wallet.getAddress();
    const isMainnet = wallet.getNetwork().networkId === "base-mainnet";

    const suffix = isMainnet ? ".base.eth" : ".basetest.eth";
    if (!args.basename.endsWith(suffix)) {
      args.basename += suffix;
    }

    const l2ResolverAddress = isMainnet ? L2_RESOLVER_ADDRESS_MAINNET : L2_RESOLVER_ADDRESS_TESTNET;

    const addressData = encodeFunctionData({
      abi: L2_RESOLVER_ABI,
      functionName: "setAddr",
      args: [namehash(args.basename), address],
    });
    const nameData = encodeFunctionData({
      abi: L2_RESOLVER_ABI,
      functionName: "setName",
      args: [namehash(args.basename), args.basename],
    });

    try {
      const contractAddress = isMainnet
        ? BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET
        : BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET;

      const hash = await wallet.sendTransaction({
        to: contractAddress,
        data: encodeFunctionData({
          abi: REGISTRAR_ABI,
          functionName: "register",
          args: [
            {
              name: args.basename.replace(suffix, ""),
              owner: address as Hex,
              duration: REGISTRATION_DURATION,
              resolver: l2ResolverAddress,
              data: [addressData, nameData],
              reverseRecord: true,
            },
          ],
        }),
        value: parseEther(args.amount),
      });

      await wallet.waitForTransactionReceipt(hash);

      return `Successfully registered basename ${args.basename} for address ${address}`;
    } catch (error) {
      return `Error registering basename: Error: ${error}`;
    }
  }

  /**
   * Checks if the Basename action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Basename action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const basenameActionProvider = () => new BasenameActionProvider();
