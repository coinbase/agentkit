import { z } from "zod";

export const CheckTokenControlSchema = z
  .object({
    contractAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 42-character hex address")
      .describe("The Base Mainnet smart-contract address (0x...) to inspect for bytecode, owner, pause state, and proxy signals."),
  })
  .strip()
  .describe("Instructions for checking token contract control markers on Base Mainnet");
