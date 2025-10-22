import { z } from "zod";
import { SuperfluidCreateStreamSchema, SuperfluidDeleteStreamSchema } from "./schemas";
import { CFAv1ForwarderAddress, CFAv1ForwarderABI } from "./constants";
import { encodeFunctionData, Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";

/**
 * SuperfluidStreamActionProvider is an action provider for Superfluid interactions.
 */
export class SuperfluidStreamActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the SuperfluidStreamActionProvider class.
   */
  constructor() {
    super("superfluid-stream", []);
  }

  /**
   * Creates a stream from the agent wallet to the recipient
   *
   * @param walletProvider - The wallet provider to start the stream from.
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "create_stream",
    description: `
This tool will create a Superfluid stream for a desired token on an EVM network.
It takes the Super token address, a recipient address, and a stream rate to create a Superfluid stream.
Assume the Super token already exists; if the action fails, tell the user to ensure the Super token exists.
Superfluid will then start streaming the token to the recipient at the specified rate (wei per second).
Do not use the ERC20 address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    schema: SuperfluidCreateStreamSchema,
  })
  async createStream(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SuperfluidCreateStreamSchema>,
  ): Promise<string> {
    try {
      const streamData = encodeFunctionData({
        abi: CFAv1ForwarderABI,
        functionName: "createFlow",
        args: [
          args.superTokenAddress as Hex,
          walletProvider.getAddress() as Hex,
          args.recipientAddress as Hex,
          BigInt(args.flowRate),
          "0x",
        ],
      });

      const streamHash = await walletProvider.sendTransaction({
        to: CFAv1ForwarderAddress as `0x${string}`,
        data: streamData,
      });

      await walletProvider.waitForTransactionReceipt(streamHash);

      return `Created stream of token ${args.superTokenAddress} to ${args.recipientAddress} at a rate of ${args.flowRate}. The link to the stream is ${this.getStreamLink(walletProvider.getNetwork(), args.superTokenAddress, walletProvider.getAddress(), args.recipientAddress)}.  Transaction hash: ${streamHash}`;
    } catch (error) {
      return `Error creating Superfluid stream: ${error}`;
    }
  }

  /**
   * Updates a stream from the agent wallet to the recipient
   *
   * @param walletProvider - The wallet provider to start the stream from.
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "update_stream",
    description: `
This tool will update a Superfluid stream for a desired token on an EVM network.
It takes the ERC20 token address, a recipient address, and a stream rate to update a Superfluid stream.
Superfluid will then start streaming the token with the updated flow rate to the recipient.
Do not use the ERC20 address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    // schema same as create schema
    schema: SuperfluidCreateStreamSchema,
  })
  async updateStream(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SuperfluidCreateStreamSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: CFAv1ForwarderABI,
        functionName: "updateFlow",
        args: [
          args.superTokenAddress as Hex,
          walletProvider.getAddress() as Hex,
          args.recipientAddress as Hex,
          BigInt(args.flowRate),
          "0x",
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: CFAv1ForwarderAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Updated stream of token ${args.superTokenAddress} to ${args.recipientAddress} at a rate of ${args.flowRate}.  Transaction hash: ${hash}`;
    } catch (error) {
      return `Error updating Superfluid stream: ${error}`;
    }
  }

  /**
   * Deletes a stream from the agent wallet to the recipient
   *
   * @param walletProvider - The wallet provider to start the stream from.
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the account details or error message
   */
  @CreateAction({
    name: "delete_stream",
    description: `
This tool will stop the streaming of a Superfluid ERC20 token.
It takes the ERC20 token address and a recipient address to delete a Superfluid stream, if one is present.
Superfluid will then stop streaming the token to the recipient.
Do not use the ERC20 address as the destination address. If you are unsure of the destination address, please ask the user before proceeding.
`,
    schema: SuperfluidDeleteStreamSchema,
  })
  async deleteStream(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SuperfluidDeleteStreamSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: CFAv1ForwarderABI,
        functionName: "deleteFlow",
        args: [
          args.superTokenAddress as Hex,
          walletProvider.getAddress() as Hex,
          args.recipientAddress as Hex,
          "0x",
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: CFAv1ForwarderAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Stopped stream of token ${args.superTokenAddress} to ${args.recipientAddress}.  Transaction hash: ${hash}`;
    } catch (error) {
      return `Error deleting Superfluid stream: ${error}`;
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

  /**
   * Gets the link to the Superfluid dashboard pertaining to the stream
   *
   * @param network - The current network
   * @param tokenAddress - The ERC20 token address of the underlying stream
   * @param senderAddress - The sender of the stream (the agent)
   * @param recipientAddress - The recipient of the stream
   * @returns The view link to the new stream on Superfluid
   */
  getStreamLink = (
    network: Network,
    tokenAddress: string,
    senderAddress: string,
    recipientAddress: string,
  ) => {
    return `https://app.superfluid.finance/stream/${network.networkId}/${senderAddress}-${recipientAddress}-${tokenAddress}`;
  };
}

export const superfluidStreamActionProvider = () => new SuperfluidStreamActionProvider();
