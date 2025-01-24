import { Asset, Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";

import { CdpAction } from "../../cdp_action";
import { METAMORPHO_ABI } from "./constants";

const WITHDRAW_PROMPT = `
This tool allows withdrawing assets from a Morpho Vault. It takes:

- vaultAddress: The address of the Morpho Vault to withdraw from
- assets: The amount of assets to withdraw in atomic units
- receiver: The address to receive the shares
`;

/**
 * Input schema for Morpho Vault withdraw action.
 */
export const MorphoWithdrawInput = z
  .object({
    vaultAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the Morpho Vault to withdraw from"),
    assets: z
      .string()
      .regex(/^\d+$/, "Must be a valid whole number")
      .describe("The amount of assets to withdraw in atomic units e.g. 1"),
    receiver: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address to receive the shares"),
  })
  .strip()
  .describe("Input schema for Morpho Vault withdraw action");

/**
 * Withdraw assets from a Morpho Vault.
 *
 * @param wallet - The wallet to execute the withdrawal from
 * @param args - The input arguments for the action
 * @returns A success message with transaction details or error message
 */
export async function withdrawFromMorpho(
  wallet: Wallet,
  args: z.infer<typeof MorphoWithdrawInput>,
): Promise<string> {
  if (BigInt(args.assets) <= 0) {
    return "Error: Assets amount must be greater than 0";
  }

  try {
    const invocation = await wallet.invokeContract({
      contractAddress: args.vaultAddress,
      method: "withdraw",
      abi: METAMORPHO_ABI,
      args: {
        assets: args.assets,
        receiver: args.receiver,
        owner: args.receiver,
      },
    });

    const result = await invocation.wait();

    return `Withdrawn ${args.assets} from Morpho Vault ${args.vaultAddress} with transaction hash: ${result.getTransaction().getTransactionHash()} and transaction link: ${result.getTransaction().getTransactionLink()}`;
  } catch (error) {
    return `Error withdrawing from Morpho Vault: ${error}`;
  }
}

/**
 * Morpho Vault withdraw action.
 */
export class MorphoWithdrawAction implements CdpAction<typeof MorphoWithdrawInput> {
  public name = "morpho_withdraw";
  public description = WITHDRAW_PROMPT;
  public argsSchema = MorphoWithdrawInput;
  public func = withdrawFromMorpho;
}
