import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { GenerateBlinkSchema, SwapTokenSchema } from "./schemas";
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
      const { decimals } = await getMint(walletProvider.getConnection(), inputMint);
      const amount = args.amount * 10 ** decimals;

      // Get the best swap route
      const quoteResponse = await jupiterApi.quoteGet({
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount: amount,
        slippageBps: args.slippageBps || 50, // 0.5% default slippage
      });

      if (!quoteResponse) {
        throw new Error("Failed to get a swap quote.");
      }

      // Request the swap transaction
      const swapRequest: SwapRequest = {
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: true, // Defaults to true for SOL swaps
        useSharedAccounts: true, // Optimize for low transaction costs
        quoteResponse,
      };

      // Request the swap transaction
      const swapResponse = await jupiterApi.swapPost({ swapRequest });

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error("Failed to generate swap transaction.");
      }

      // Deserialize, sign, and send transaction
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
   * Generates a Jupiter Swap Blink URL.
   *
   * @param walletProvider - The wallet provider (not used in this action)
   * @param args - Contains input and output mint addresses
   * @returns A URL string for the Jupiter Swap Blink
   */
  @CreateAction({
    name: "generate_blink",
    description: `
    Generates a Jupiter Swap Blink (URL).
    - Input and output tokens must be valid SPL token symbols or SPL token mint addresses.
    - The returned URL can be shared to facilitate token swaps.
    `,
    schema: GenerateBlinkSchema,
  })
  async generateBlink(
    _: SvmWalletProvider,
    args: z.infer<typeof GenerateBlinkSchema>,
  ): Promise<string> {
    const { inputSymbolOrMint, outputSymbolOrMint } = args;
    const blinkUrl = `https://jup.ag/swap/${inputSymbolOrMint}-${outputSymbolOrMint}`;
    return `Jupiter Swap Blink URL: ${blinkUrl}`;
  }

  /**
   * Checks if the action provider supports the given network.
   * Only supports Solana networks.
   *
   * @param network - The network to check support for
   * @returns True if the network is a Solana network
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily == "svm";
  }
}

/**
 * Factory function to create a new JupiterActionProvider instance.
 *
 * @returns A new JupiterActionProvider instance
 */
export const jupiterActionProvider = () => new JupiterActionProvider();
