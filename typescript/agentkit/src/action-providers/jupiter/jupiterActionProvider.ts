import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { SwapTokenSchema } from "./schemas";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { createJupiterApiClient, SwapRequest } from "@jup-ag/api";

/**
 * JupiterActionProvider handles token swaps using Jupiter's API.
 */
export class JupiterActionProvider extends ActionProvider<SvmWalletProvider> {
  /**
   * Initializes Jupiter API client.
   */
  constructor() {
    super("jupiter", []);
  }

  /**
   * Swaps tokens using Jupiter's API.
   *
   * @param walletProvider - The wallet provider to use for the swap
   * @param args - Swap parameters including input token, output token, and amount
   * @returns A message indicating success or failure with transaction details
   */
  @CreateAction({
    name: "swap",
    description: `
    Swaps tokens using Jupiter's DEX aggregator.
    - Input and output tokens must be valid SPL token mints.
    - Ensures sufficient balance before executing swap.
    - If says "SOL" as the input or output, use the mint address So11111111111111111111111111111111111111112
    NOTE: Only available on Solana mainnet.
    `,
    schema: SwapTokenSchema,
  })
  async swap(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof SwapTokenSchema>,
  ): Promise<string> {
    try {
      const jupiterApi = createJupiterApiClient();
      const userPublicKey = walletProvider.getPublicKey();
      const inputMint = new PublicKey(args.inputMint);
      const outputMint = new PublicKey(args.outputMint);

      const { getMint } = await import("@solana/spl-token");

      let mintInfo: Awaited<ReturnType<typeof getMint>>;
      try {
        mintInfo = await getMint(walletProvider.getConnection(), inputMint);
      } catch (error) {
        return `Failed to fetch mint info for mint address ${args.inputMint}. Error: ${error}`;
      }
      const amount = args.amount * 10 ** mintInfo.decimals;

      const quoteResponse = await jupiterApi.quoteGet({
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount: amount,
        slippageBps: args.slippageBps || 50, // 0.5% default slippage
      });

      if (!quoteResponse) {
        throw new Error("Failed to get a swap quote.");
      }

      const swapRequest: SwapRequest = {
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: true, // Optimize for low transaction costs
        quoteResponse,
      };

      const swapResponse = await jupiterApi.swapPost({ swapRequest });

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error("Failed to generate swap transaction.");
      }

      const transactionBuffer = Buffer.from(swapResponse.swapTransaction, "base64");
      const tx = VersionedTransaction.deserialize(transactionBuffer);

      const signature = await walletProvider.signAndSendTransaction(tx);

      await walletProvider.waitForSignatureResult(signature);

      return `Successfully swapped ${args.amount} tokens! Signature: ${signature}`;
    } catch (error) {
      return `Error swapping tokens: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Only supports Solana networks.
   *
   * @param network - The network to check support for
   * @returns True if the network is a Solana network
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily == "svm" && network.networkId === "solana-mainnet";
  }
}

/**
 * Factory function to create a new JupiterActionProvider instance.
 *
 * @returns A new JupiterActionProvider instance
 */
export const jupiterActionProvider = () => new JupiterActionProvider();
