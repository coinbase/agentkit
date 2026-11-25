import { z } from "zod";

export const CheckPayeeSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .describe(
        "The address you are about to send money to: EVM (0x...), Solana, Bitcoin or Tron.",
      ),
  })
  .strict()
  .describe("Input for checking a payment recipient before sending funds");

export const CheckSignatureSchema = z
  .object({
    payload: z
      .string()
      .min(1)
      .describe(
        "What you were asked to sign: raw transaction calldata (0x...), an EIP-712 typed-data JSON string, or a JSON-RPC signing request as a JSON string.",
      ),
  })
  .strict()
  .describe("Input for checking a signing request before signing it");

export const CheckDenylistSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .describe("The address to look up: EVM (0x...), Solana, Bitcoin or Tron."),
  })
  .strict()
  .describe("Input for a free lookup against the Veriql denylist");
