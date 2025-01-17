import { CdpAction } from "./cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const TRANSFER_NFT_PROMPT = `
This tool will transfer an NFT (ERC721 token) from the wallet to another onchain address.

It takes the following inputs:
- contractAddress: The NFT contract address
- tokenId: The ID of the specific NFT to transfer
- destination: Where to send the NFT (can be an onchain address, ENS 'example.eth', or Basename 'example.base.eth')

Important notes:
- Ensure you have ownership of the NFT before attempting transfer
- Ensure there is sufficient native token balance for gas fees
- The wallet must either own the NFT or have approval to transfer it
`;

/**
 * Input schema for NFT transfer action.
 */
export const TransferNftInput = z
  .object({
    contractAddress: z.string().describe("The NFT contract address to interact with"),
    tokenId: z.string().describe("The ID of the NFT to transfer"),
    destination: z
      .string()
      .describe(
        "The destination to transfer the NFT, e.g. `0x58dBecc0894Ab4C24F98a0e684c989eD07e4e027`, `example.eth`, `example.base.eth`",
      ),
    fromAddress: z
      .string()
      .optional()
      .describe(
        "The address to transfer from. If not provided, defaults to the wallet's default address",
      ),
  })
  .strip()
  .describe("Input schema for transferring an NFT");

/**
 * Transfers an NFT (ERC721 token) to a destination address.
 *
 * @param wallet - The wallet to transfer the NFT from.
 * @param args - The input arguments for the action.
 * @returns A message containing the transfer details.
 */
export async function transferNft(
  wallet: Wallet,
  args: z.infer<typeof TransferNftInput>,
): Promise<string> {
  const from = args.fromAddress || (await wallet.getDefaultAddress()).getId();

  try {
    const transferResult = await wallet.invokeContract({
      contractAddress: args.contractAddress,
      method: "transferFrom",
      args: {
        from,
        to: args.destination,
        tokenId: args.tokenId,
      },
    });

    const result = await transferResult.wait();

    const transaction = result.getTransaction();

    return `Transferred NFT (ID: ${args.tokenId}) from contract ${args.contractAddress} to ${
      args.destination
    }.\nTransaction hash: ${transaction.getTransactionHash()}\nTransaction link: ${transaction.getTransactionLink()}`;
  } catch (error) {
    return `Error transferring the NFT (contract: ${args.contractAddress}, ID: ${args.tokenId}) from ${from} to ${args.destination}): ${error}`;
  }
}

/**
 * Transfer NFT action.
 */
export class TransferNftAction implements CdpAction<typeof TransferNftInput> {
  name = "transfer_nft";
  description = TRANSFER_NFT_PROMPT;
  argsSchema = TransferNftInput;
  func = transferNft;
}
