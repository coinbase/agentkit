import { z } from "zod";

/**
 * Input schema for find token action
 */
export const FindTokenSchema = z
  .object({
    search: z
      .string()
      .min(2)
      .describe("Either the (partial or complete) symbol OR the address of the token to find"),
  })
  .strip()
  .describe("Instructions for finding a token");
