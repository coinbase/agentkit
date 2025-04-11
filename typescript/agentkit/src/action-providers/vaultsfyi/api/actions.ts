import z from "zod";
import { claimActionSchema, depositActionSchema, redeemActionSchema } from "../schemas";
import { createSearchParams } from "../utils";
import { VAULTS_API_URL } from "../constants";
import { ApiError } from "./types";
import { Address, Hex } from "viem";

type FetchVaultActionsParams = (
  | {
      action: "deposit";
      args: z.infer<typeof depositActionSchema>;
    }
  | {
      action: "redeem";
      args: z.infer<typeof redeemActionSchema>;
    }
  | {
      action: "claim-rewards";
      args: z.infer<typeof claimActionSchema>;
    }
) & {
  sender: string;
  apiKey: string;
};

export type Actions = {
  actions: {
    tx: {
      to: Address;
      data: Hex;
      value: string;
      chainId: number;
    };
    description: string;
  }[];
  currentActionIndex: number;
};

/**
 * Fetches a list of actions for a vault from the vaultsfyi API.
 *
 * @param root0 - The fetch parameters
 * @param root0.action - The action to fetch
 * @param root0.args - The action parameters
 * @param root0.sender - The sender address
 * @param root0.apiKey - The vaultsfyi API key
 * @returns The list of actions
 */
export async function fetchVaultActions({
  action,
  args,
  sender,
  apiKey,
}: FetchVaultActionsParams): Promise<Actions | ApiError> {
  const params = createSearchParams({
    ...args,
    sender,
  });
  const response = await fetch(`${VAULTS_API_URL}/transactions/vaults/${action}?${params}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });
  return (await response.json()) as Actions | ApiError;
}
