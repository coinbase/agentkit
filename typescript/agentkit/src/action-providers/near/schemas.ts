import { z } from "zod";

const WholeTokenAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a non-negative decimal string");

const AtomicAmount = z.string().regex(/^\d+$/, "Amount must be an unsigned integer string");

/** Input schema for reading a NEP-141 token balance. */
export const GetNep141BalanceSchema = z
  .object({
    tokenId: z.string().min(2).describe("NEP-141 token contract account ID"),
    accountId: z
      .string()
      .min(2)
      .nullable()
      .describe("Account to inspect; defaults to the connected wallet"),
  })
  .describe("Read a NEP-141 fungible-token balance");

/** Input schema for transferring NEP-141 tokens. */
export const TransferNep141Schema = z
  .object({
    tokenId: z.string().min(2).describe("NEP-141 token contract account ID"),
    receiverId: z.string().min(2).describe("NEAR account that will receive the tokens"),
    amount: WholeTokenAmount.describe("Amount in whole token units, such as 1.25 USDC"),
  })
  .describe("Transfer NEP-141 fungible tokens");

/** Input schema for a state-changing NEAR contract call. */
export const CallContractSchema = z
  .object({
    contractId: z.string().min(2).describe("NEAR contract account ID"),
    methodName: z.string().min(1).describe("Contract method to call"),
    args: z.record(z.string(), z.unknown()).describe("JSON arguments passed to the contract"),
    gas: AtomicAmount.nullable()
      .transform(value => value ?? "30000000000000")
      .describe("Gas units to attach; defaults to 30 TGas"),
    deposit: AtomicAmount.nullable()
      .transform(value => value ?? "0")
      .describe("Attached deposit in yoctoNEAR; defaults to zero"),
  })
  .describe("Call a state-changing method on a NEAR contract");
