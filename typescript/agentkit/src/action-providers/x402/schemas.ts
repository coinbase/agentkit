import { z } from "zod";

export const PaidRequestSchema = z
  .object({
    url: z.string().url().describe("The URL of the x402-protected API endpoint"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .default("GET")
      .describe("The HTTP method to use for the request"),
    headers: z.record(z.string()).optional().describe("Optional headers to include in the request"),
    body: z.any().optional().describe("Optional request body for POST/PUT/PATCH requests"),
  })
  .strip()
  .describe("Instructions for making a paid request to an x402-protected API");

export const FetchPaymentInfoSchema = z
  .object({
    url: z.string().url().describe("The URL of the x402-protected API endpoint"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .default("GET")
      .describe("The HTTP method to use for the request"),
    headers: z.record(z.string()).optional().describe("Optional headers to include in the request"),
  })
  .strip()
  .describe("Instructions for fetching payment information from an x402-protected API endpoint");
