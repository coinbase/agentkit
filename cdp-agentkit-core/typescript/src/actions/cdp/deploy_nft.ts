import { CdpAction } from "./cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const DEPLOY_NFT_PROMPT = `
This tool will deploy an NFT (ERC-721) contract onchain from the wallet. 
It takes the name of the NFT collection, the symbol of the NFT collection, and the base URI for the token metadata as inputs.
`;

/**
 * Input schema for deploy NFT action.
 */
export const DeployNftInput = z
  .object({
    name: z.string().describe("The name of the NFT collection"),
    symbol: z.string().describe("The symbol of the NFT collection"),
    baseURI: z.string().describe("The base URI for the token metadata"),
  })
  .strip()
  .describe("Instructions for deploying an NFT collection");

/**
 * Deploys an NFT (ERC-721) token collection onchain from the wallet.
 *
 * @param wallet - The wallet to deploy the NFT from.
 * @param args - The input arguments for the action.
 * @returns A message containing the NFT token deployment details.
 */
export async function deployNft(
  wallet: Wallet,
  args: z.infer<typeof DeployNftInput>,
): Promise<string> {
  try {
    const nftContract = await wallet.deployNFT({
      name: args.name,
      symbol: args.symbol,
      baseURI: args.baseURI,
    });

    const result = await nftContract.wait();

    return `Deployed NFT Collection ${
      args.name
    } to address ${result.getContractAddress()} on network ${wallet.getNetworkId()}.\nTransaction hash for the deployment: ${result
      .getTransaction()!
      .getTransactionHash()}\nTransaction link for the deployment: ${result
      .getTransaction()!
      .getTransactionLink()}`;
  } catch (error) {
    return `Error deploying NFT: ${error}`;
  }
}

/**
 * Deploy NFT action.
 */
export class DeployNftAction implements CdpAction<typeof DeployNftInput> {
  public name = "deploy_nft";
  public description = DEPLOY_NFT_PROMPT;
  public argsSchema = DeployNftInput;
  public func = deployNft;
}
