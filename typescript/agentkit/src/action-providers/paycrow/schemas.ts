import { z } from "zod";

/**
 * Input schema for PayCrow trust_gate action.
 */
export const TrustGateSchema = z
  .object({
    address: z
      .string()
      .describe("The wallet address of the agent or seller to check trust for"),
    intendedAmount: z
      .number()
      .optional()
      .describe("Optional intended payment amount in USDC to evaluate against trust thresholds"),
  })
  .strip()
  .describe("Parameters for checking an agent's trust score before paying");

/**
 * Input schema for PayCrow safe_pay action.
 */
export const SafePaySchema = z
  .object({
    url: z.string().url().describe("The service URL to pay for"),
    sellerAddress: z
      .string()
      .describe("The wallet address of the seller to receive payment"),
    amountUsdc: z
      .number()
      .positive()
      .describe("The amount in USDC to pay"),
  })
  .strip()
  .describe("Parameters for making a trust-informed escrow payment");

/**
 * Input schema for PayCrow escrow_create action.
 */
export const EscrowCreateSchema = z
  .object({
    seller: z.string().describe("The wallet address of the seller"),
    amountUsdc: z
      .number()
      .positive()
      .describe("The amount in USDC to escrow"),
    timelockMinutes: z
      .number()
      .positive()
      .default(60)
      .describe("Time lock duration in minutes before the escrow can be released (default: 60)"),
    serviceUrl: z
      .string()
      .url()
      .describe("The URL of the service being paid for"),
  })
  .strip()
  .describe("Parameters for creating a USDC escrow");

/**
 * Input schema for PayCrow rate_service action.
 */
export const RateServiceSchema = z
  .object({
    escrowId: z.string().describe("The ID of the completed escrow to rate"),
    stars: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Rating from 1 to 5 stars"),
  })
  .strip()
  .describe("Parameters for rating a completed escrow service");
