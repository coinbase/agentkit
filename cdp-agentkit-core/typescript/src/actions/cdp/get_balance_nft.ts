import { CdpAction } from "./cdp_action";
import { readContract, Wallet } from "@coinbase/coinbase-sdk";
import { Hex } from "viem";
import { z } from "zod";

const GET_BALANCE_NFT_PROMPT = `
This tool will get the NFTs (ERC721 tokens) owned by the wallet for a specific NFT contract.

It takes the following inputs:
- contractAddress: The NFT contract address to check
- address: (Optional) The address to check NFT balance for. If not provided, uses the wallet's default address
`;

/**
 * Input schema for get NFT balance action.
 */
export const GetBalanceNftInput = z
  .object({
    contractAddress: z.string().describe("The NFT contract address to check balance for"),
    address: z
      .string()
      .optional()
      .describe(
        "The address to check NFT balance for. If not provided, uses the wallet's default address",
      ),
  })
  .strip()
  .describe("Instructions for getting NFT balance");

/**
 * Gets NFT balance for a specific contract.
 *
 * @param wallet - The wallet to check balance from.
 * @param args - The input arguments for the action.
 * @returns A message containing the NFT balance details.
 */
export async function getBalanceNft(
  wallet: Wallet,
  args: z.infer<typeof GetBalanceNftInput>,
): Promise<string> {
  try {
    const checkAddress = args.address || (await wallet.getDefaultAddress()).getId();

    const ownedTokens = await readContract({
      contractAddress: args.contractAddress as Hex,
      networkId: wallet.getNetworkId(),
      method: "tokensOfOwner",
      args: { owner: checkAddress },
    });

    if (!ownedTokens || ownedTokens.length === 0) {
      return `Address ${checkAddress} owns no NFTs in contract ${args.contractAddress}`;
    }

    const tokenList = ownedTokens.map(String).join(", ");
    return `Address ${checkAddress} owns ${ownedTokens.length} NFTs in contract ${args.contractAddress}.\nToken IDs: ${tokenList}`;
  } catch (error) {
    return `Error getting NFT balance for address ${args.address} in contract ${args.contractAddress}: ${error}`;
  }
}

/**
 * Get NFT balance action.
 */
export class GetBalanceNftAction implements CdpAction<typeof GetBalanceNftInput> {
  name = "get_balance_nft";
  description = GET_BALANCE_NFT_PROMPT;
  argsSchema = GetBalanceNftInput;
  func = getBalanceNft;
}
