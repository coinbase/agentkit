import { CdpAction } from "./cdp_action";
import { Wallet, Amount } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const DEPLOY_TOKEN_PROMPT = `
This tool will deploy an ERC20 token smart contract. It takes the token name, symbol, and total supply as input. 
The token will be deployed using the wallet's default address as the owner and initial token holder.
`;

/**
 * Input schema for deploy token action.
 */
export const DeployTokenInput = z
  .object({
    name: z.string().describe("The name of the token"),
    symbol: z.string().describe("The token symbol"),
    totalSupply: z.custom<Amount>().describe("The total supply of tokens to mint"),
  })
  .strip()
  .describe("Instructions for deploying a token");

/**
 * Deploys an ERC20 token smart contract.
 *
 * @param wallet - The wallet to deploy the Token from.
 * @param args - The input arguments for the action.
 * @returns A message containing the deployed token contract address and details.
 */
export async function deployToken(
  wallet: Wallet,
  args: z.infer<typeof DeployTokenInput>,
): Promise<string> {
  try {
    const tokenContract = await wallet.deployToken({
      name: args.name,
      symbol: args.symbol,
      totalSupply: args.totalSupply,
    });

    const result = await tokenContract.wait();

    return `Deployed ERC20 token contract ${args.name} (${args.symbol}) with total supply of ${
      args.totalSupply
    } tokens at address ${result.getContractAddress()}. Transaction link: ${result
      .getTransaction()!
      .getTransactionLink()}`;
  } catch (error) {
    return `Error deploying token: ${error}`;
  }
}

/**
 * Deploy token action.
 */
export class DeployTokenAction implements CdpAction<typeof DeployTokenInput> {
  public name = "deploy_token";
  public description = DEPLOY_TOKEN_PROMPT;
  public argsSchema = DeployTokenInput;
  public func = deployToken;
}
