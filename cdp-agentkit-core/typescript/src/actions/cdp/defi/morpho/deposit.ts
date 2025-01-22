import { Asset, Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";
import { Decimal } from "decimal.js";

import { CdpAction } from "../../cdp_action";
import { approve } from "../../utils";

import { METAMORPHO_ABI } from "./constants";

const DEPOSIT_PROMPT = `
This tool allows depositing assets into a Morpho Vault. 

It takes:
- vaultAddress: The address of the Morpho Vault to deposit to
- assets: The amount of assets to deposit in whole units
  Examples for WETH:
  - 1 WETH
  - 0.1 WETH
  - 0.01 WETH
- receiver: The address to receive the shares
- tokenAddress: The address of the token to approve

Important notes:
- Make sure to use the exact amount provided. Do not convert units for assets for this action. 
- Please use a token address (example 0x4200000000000000000000000000000000000006) for the tokenAddress field. If you are unsure of the token address, please clarify what the requested token address is before continuing.
`;

/**
 * Input schema for Morpho Vault deposit action.
 */
export const MorphoDepositInput = z
  .object({
    assets: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The quantity of assets to deposit, in whole units"),
    receiver: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe(
        "The address that will own the position on the vault which will receive the shares",
      ),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the assets token to approve for deposit"),
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the Morpho Vault to deposit to"),
  })
  .describe("Input schema for Morpho Vault deposit action");

/**
 * Deposits assets into a Morpho Vault
 * @param Wallet - The wallet instance to execute the transaction
 * @param args - The input arguments for the action
 * @returns A success message with transaction details or an error message
 */
export async function depositToMorpho(
  wallet: Wallet,
  args: z.infer<typeof MorphoDepositInput>,
): Promise<string> {
  const assets = new Decimal(args.assets);

  if (assets.comparedTo(new Decimal(0.0)) != 1) {
    return "Error: Assets amount must be greater than 0";
  }

  try {
    const tokenAsset = await Asset.fetch(wallet.getNetworkId(), args.tokenAddress);
    const atomicAssets = tokenAsset.toAtomicAmount(assets);

    const approvalResult = await approve(
      wallet,
      args.tokenAddress,
      args.vaultAddress,
      atomicAssets,
    );
    if (approvalResult.startsWith("Error")) {
      return `Error approving Morpho Vault as spender: ${approvalResult}`;
    }

    const contractArgs = {
      assets: atomicAssets.toString(),
      receiver: args.receiver,
    };

    const invocation = await wallet.invokeContract({
      contractAddress: args.vaultAddress,
      method: "deposit",
      abi: METAMORPHO_ABI,
      args: contractArgs,
    });

    const result = await invocation.wait();

    return `Deposited ${args.assets} to Morpho Vault ${args.vaultAddress} with transaction hash: ${result.getTransactionHash()} and transaction link: ${result.getTransactionLink()}`;
  } catch (error) {
    return `Error depositing to Morpho Vault: ${error}`;
  }
}

/**
 * Morpho Vault deposit action.
 */
export class MorphoDepositAction implements CdpAction<typeof MorphoDepositInput> {
  public name = "morpho_deposit";
  public description = DEPOSIT_PROMPT;
  public argsSchema = MorphoDepositInput;
  public func = depositToMorpho;
}
