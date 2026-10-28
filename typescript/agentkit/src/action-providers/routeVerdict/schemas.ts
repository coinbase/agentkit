import { z } from "zod";

/**
 * Input schema for the RouteVerdict action — mirrors the RouteVerdict
 * service's real request contract (POST /v1/check):
 *
 *   { "resource_url": "https://.../v1/some-paid-route" }
 *
 * `resource_url` is required: the full URL of the x402 resource to audit.
 */
export const RouteVerdictSchema = z
  .object({
    resource_url: z
      .string()
      .url("resource_url must be a full URL")
      .describe("Full URL of the x402 resource to audit"),
  })
  .strict()
  .describe("Instructions for getting a trust verdict on an x402 endpoint");

export type RouteVerdictArgs = z.infer<typeof RouteVerdictSchema>;
