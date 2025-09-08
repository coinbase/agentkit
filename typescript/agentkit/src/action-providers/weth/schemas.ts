import { z } from "zod";

export const WrapEthSchema = z
  .object({
    amountToWrap: z.string().describe("Amount of ETH to wrap in wei"),
  })
  .strip()
  .describe("Instructions for wrapping ETH to WETH");

export const UnwrapEthSchema = z
  .object({
    amountToUnwrap: z.string().describe("Amount of WETH to unwrap in wei"),
  })
  .strip()
  .describe("Instructions for unwrapping WETH to ETH");
