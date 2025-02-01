import { z } from "zod";

export const WrapEthSchema = z
  .object({
    amountToWrap: z.string().describe("Amount of ETH to wrap in wei"),
  })
  .strip()
  .describe("Instructions for wrapping ETH to WETH");
