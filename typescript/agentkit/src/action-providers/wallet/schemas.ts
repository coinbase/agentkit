import { z } from "zod";

/**
 * The EVM zero address. Transfers to this address permanently burn tokens with no recovery.
 */
const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Returns true when the address is NOT the EVM zero address.
 * Handles addresses with or without the 0x prefix so that both
 * "0x000...000" and "000...000" (40 hex zeros) are rejected.
 */
const isNotZeroAddress = (addr: string): boolean => {
  const normalized = addr.startsWith("0x") ? addr.toLowerCase() : `0x${addr.toLowerCase()}`;
  return normalized !== EVM_ZERO_ADDRESS;
};

/**
 * Schema for the get_wallet_details action.
 * This action doesn't require any input parameters, so we use an empty object schema.
 */
export const GetWalletDetailsSchema = z.object({});

/**
 * Schema for the get_balance action.
 * This action doesn't require any input parameters, so we use an empty object schema.
 */
export const GetBalanceSchema = z.object({});

/**
 * Input schema for native transfer action.
 */
export const NativeTransferSchema = z
  .object({
    to: z
      .string()
      .refine(isNotZeroAddress, { message: "Transfer to the zero address is not allowed" })
      .describe("The destination address to receive the funds"),
    value: z.string().describe("The amount to transfer in whole units e.g. 1 ETH or 0.00001 ETH"),
  })
  .strip()
  .describe("Instructions for transferring native tokens");

/**
 * Input schema for return native balance action.
 */
export const ReturnNativeBalanceSchema = z
  .object({
    to: z
      .string()
      .refine(isNotZeroAddress, { message: "Transfer to the zero address is not allowed" })
      .describe("The destination address to receive all native token funds"),
  })
  .strip()
  .describe("Instructions for returning all native token balance to a destination address");
