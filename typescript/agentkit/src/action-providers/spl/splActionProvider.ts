import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { TransferTokenSchema } from "./schemas";
import {
  PublicKey,
  VersionedTransaction,
  MessageV0,
  TransactionInstruction,
} from "@solana/web3.js";

/**
 * SplActionProvider serves as a provider for SPL token actions.
 * It provides SPL token transfer functionality.
 */
export class SplActionProvider extends ActionProvider<SvmWalletProvider> {
  /**
   * Creates a new SplActionProvider instance.
   */
  constructor() {
    super("spl", []);
  }

  /**
   * Transfer SPL tokens to another address.
   *
   * @param walletProvider - The wallet provider to use for the transfer
   * @param args - Transfer parameters including recipient address, mint address, and amount
   * @returns A message indicating success or failure with transaction details
   */
  @CreateAction({
    name: "transfer",
    description: `
    This tool will transfer SPL tokens to another address.
    - Amount should be specified in token units (not raw)
    - Recipient must be a valid Solana address
    - Mint address must be a valid SPL token mint
    - Ensures sufficient token balance before transfer
    - Returns transaction details
    `,
    schema: TransferTokenSchema,
  })
  async transfer(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof TransferTokenSchema>,
  ): Promise<string> {
    try {
      const connection = walletProvider.getConnection();
      const fromPubkey = walletProvider.getPublicKey();
      const toPubkey = new PublicKey(args.recipient);
      const mintPubkey = new PublicKey(args.mintAddress);

      const {
        getMint,
        getAssociatedTokenAddress,
        getAccount,
        createAssociatedTokenAccountInstruction,
        createTransferCheckedInstruction,
      } = await import("@solana/spl-token");

      const mintInfo = await getMint(connection, mintPubkey);
      const adjustedAmount = args.amount * Math.pow(10, mintInfo.decimals);

      const sourceAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
      const destinationAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

      const instructions: TransactionInstruction[] = [];

      const sourceAccount = await getAccount(connection, sourceAta);
      if (sourceAccount.amount < BigInt(adjustedAmount)) {
        throw new Error(
          `Insufficient token balance. Have ${sourceAccount.amount}, need ${adjustedAmount}`,
        );
      }

      try {
        await getAccount(connection, destinationAta);
      } catch {
        instructions.push(
          createAssociatedTokenAccountInstruction(fromPubkey, destinationAta, toPubkey, mintPubkey),
        );
      }

      instructions.push(
        createTransferCheckedInstruction(
          sourceAta,
          mintPubkey,
          destinationAta,
          fromPubkey,
          adjustedAmount,
          mintInfo.decimals,
        ),
      );

      const tx = new VersionedTransaction(
        MessageV0.compile({
          payerKey: fromPubkey,
          instructions: instructions,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        }),
      );

      const signature = await walletProvider.signAndSendTransaction(tx);
      await walletProvider.waitForSignatureResult(signature);

      return [
        `Successfully transferred ${args.amount} tokens to ${args.recipient}`,
        `Token mint: ${args.mintAddress}`,
        `Signature: ${signature}`,
      ].join("\n");
    } catch (error) {
      return `Error transferring SPL tokens: ${error}`;
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
    return network.protocolFamily === "svm";
  }
}

/**
 * Factory function to create a new SplActionProvider instance.
 *
 * @returns A new SplActionProvider instance
 */
export const splActionProvider = () => new SplActionProvider();
