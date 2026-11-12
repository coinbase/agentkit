import { z } from "zod";

const usdcAmount = z
  .string()
  .regex(/^[0-9]{1,18}$/, "USDC base units (6 decimals) as a decimal string")
  .describe("Amount in USDC base units (6 decimals) as a decimal string, e.g. 10000 = 0.01 USDC");

const protocol = z
  .enum(["x402", "a2a", "mcp", "openapi", "erc8004"])
  .describe("Protocol the service speaks");

const serviceId = z.string().max(40).describe("AgentCoin listing id, e.g. svc_962928f654d2a8a1");

const orderId = z.string().max(40).describe("AgentCoin order id, e.g. ord_f06171f16b1402f1");

/**
 * Input schema for find_service.
 */
export const FindServiceSchema = z
  .object({
    id: serviceId.optional().describe("Listing id; when set, returns that one listing"),
    q: z.string().max(300).optional().describe("Free-text search query"),
    protocol: protocol.optional(),
    maxPrice: usdcAmount.optional().describe("Maximum price in USDC base units"),
    minScore: z.number().min(0).max(1).optional().describe("Minimum delivered-after-pay rate"),
    claimed: z.boolean().optional().describe("Only listings claimed by their operator"),
    cursor: z.string().max(200).optional().describe("Pagination cursor from a previous call"),
    limit: z.number().int().min(1).max(50).optional().describe("Page size (1-50)"),
  })
  .strict()
  .describe("Search the AgentCoin service index, or fetch one listing by id");

/**
 * Input schema for route_task.
 */
export const RouteTaskSchema = z
  .object({
    task: z.string().min(2).max(2000).describe("Plain-language description of the task"),
    budget: usdcAmount.optional().describe("Budget in USDC base units"),
    protocol: protocol.optional(),
    claimed: z.boolean().optional().describe("Only listings claimed by their operator"),
    minScore: z.number().min(0).max(1).optional().describe("Minimum delivered-after-pay rate"),
    limit: z.number().int().min(1).max(20).optional().describe("Maximum number of candidates"),
  })
  .strict()
  .describe("Rank candidate sellers for a task and budget");

/**
 * Input schema for place_order.
 */
export const PlaceOrderSchema = z
  .object({
    serviceId,
    skillId: z
      .string()
      .max(300)
      .optional()
      .describe("Skill id from the listing, if it has several"),
    body: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("JSON request body sent to the seller (see the listing's request template)"),
  })
  .strict()
  .describe("Place an escrowed order for a listing and fund it from the wallet");

/**
 * Input schema for get_order.
 */
export const GetOrderSchema = z
  .object({
    orderId,
  })
  .strict()
  .describe("Get an order's status, escrow job state and verdict");

/**
 * Input schema for claim_listing.
 */
export const ClaimListingSchema = z
  .object({
    serviceId: serviceId.optional().describe("Listing id to claim"),
    url: z
      .string()
      .url()
      .max(2000)
      .optional()
      .describe("Public metadata URL to index (A2A card, x402 resource, MCP server card)"),
    sign: z
      .boolean()
      .optional()
      .describe("Sign the EIP-712 claim with the wallet (must be the listing's payTo or owner)"),
    method: z
      .enum(["eip712", "well-known"])
      .optional()
      .describe("Claim method; well-known checks /.well-known/agentcoin-claim on the seller host"),
  })
  .strict()
  .describe("Seller side: index a listing and/or claim it");

/**
 * Input schema for verify.
 */
export const VerifySchema = z
  .object({
    serviceId: serviceId.optional().describe("Check the signed delivery score of a listing"),
    orderId: orderId.optional().describe("Check the signed delivery record of an order"),
  })
  .strict()
  .describe("Verify AgentCoin signatures locally");

/**
 * Input schema for refund.
 */
export const RefundSchema = z
  .object({
    orderId: orderId.optional().describe("Escrow order id"),
    jobId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .optional()
      .describe("JobEscrow job id (decimal string)"),
  })
  .strict()
  .describe("Send the escrow refund-path call that applies to the job, if any");
