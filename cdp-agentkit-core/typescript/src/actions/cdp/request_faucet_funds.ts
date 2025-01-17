import { CdpAction } from "./cdp_action";
import { Wallet } from "@coinbase/coinbase-sdk";
import { z } from "zod";

const REQUEST_FAUCET_FUNDS_PROMPT = `
This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
If no asset ID is provided the faucet defaults to ETH. Faucet is only allowed on 'base-sepolia' and can only provide asset ID 'eth' or 'usdc'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.
`;

/**
 * Input schema for request faucet funds action.
 */
export const RequestFaucetFundsInput = z
  .object({
    assetId: z.string().optional().describe("The optional asset ID to request from faucet"),
  })
  .strip()
  .describe("Instructions for requesting faucet funds");

/**
 * Requests test tokens from the faucet for the default address in the wallet.
 *
 * @param wallet - The wallet to receive tokens.
 * @param args - The input arguments for the action.
 * @returns A confirmation message with transaction details.
 */
export async function requestFaucetFunds(
  wallet: Wallet,
  args: z.infer<typeof RequestFaucetFundsInput>,
): Promise<string> {
  try {
    // Request funds from the faucet
    const faucetTx = await wallet.faucet(args.assetId || undefined);

    // Wait for the faucet transaction to be confirmed
    const result = await faucetTx.wait();

    return `Received ${
      args.assetId || "ETH"
    } from the faucet. Transaction: ${result.getTransactionLink()}`;
  } catch (error) {
    return `Error requesting faucet funds: ${error}`;
  }
}

/**
 * Request faucet funds action.
 */
export class RequestFaucetFundsAction implements CdpAction<typeof RequestFaucetFundsInput> {
  public name = "request_faucet_funds";
  public description = REQUEST_FAUCET_FUNDS_PROMPT;
  public argsSchema = RequestFaucetFundsInput;
  public func = requestFaucetFunds;
}
