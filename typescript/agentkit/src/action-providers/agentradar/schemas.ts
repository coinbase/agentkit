import { z } from "zod";
import { EVM_ADDRESS_REGEX } from "./constants";

/**
 * Input schema for verifying an agent or wallet's trust.
 */
export const VerifyAgentSchema = z
  .object({
    address: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 0x-prefixed EVM address")
      .describe("The EVM address (0x...) of the agent or wallet to verify"),
  })
  .strict();

/**
 * Input schema for fetching an embeddable trust badge.
 */
export const GetTrustBadgeSchema = z
  .object({
    address: z
      .string()
      .regex(EVM_ADDRESS_REGEX, "Must be a valid 0x-prefixed EVM address")
      .describe("The EVM address (0x...) to render a trust badge for"),
    style: z
      .enum(["flat", "pill", "detailed"])
      .nullable()
      .describe("Optional badge style: 'flat', 'pill', or 'detailed'. Defaults to 'flat'."),
  })
  .strict();
