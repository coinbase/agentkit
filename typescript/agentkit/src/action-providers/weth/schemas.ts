import { z } from "zod";

export const WrapEthInput = z
  .object({
    amountToWrap: z.string().describe("Amount of ETH to wrap in wei"),
  })
  .strip()
  .describe("Instructions for wrapping ETH to WETH");
