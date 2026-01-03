import { z } from "zod";
import { KNOWN_FACILITATORS, KnownFacilitatorName, DEFAULT_FACILITATOR } from "./constants";

/**
 * Resolves a facilitator name or URL to the actual URL.
 *
 * @param facilitator - Either a known facilitator name ('cdp', 'payai') or a custom URL
 * @returns The facilitator URL
 */
export function resolveFacilitatorUrl(facilitator: string): string {
  if (facilitator in KNOWN_FACILITATORS) {
    return KNOWN_FACILITATORS[facilitator as KnownFacilitatorName];
  }
  return facilitator;
}

// Schema for listing x402 services
export const ListX402ServicesSchema = z
  .object({
    facilitator: z
      .union([z.enum(["cdp", "payai"]), z.string().url()])
      .default(DEFAULT_FACILITATOR)
      .describe(
        "Facilitator to query: 'cdp' (Coinbase CDP), 'payai' (PayAI Network), or a custom facilitator URL.",
      ),
    maxUsdcPrice: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe(
        "Optional maximum price in USDC whole units (e.g., 0.1 for 0.10 USDC). Only USDC payment options will be considered when this filter is applied.",
      ),
    x402Versions: z
      .array(z.union([z.literal(1), z.literal(2)]))
      .default([1, 2])
      .describe("Filter by x402 protocol version (1 or 2). Defaults to accepting both versions."),
    keyword: z
      .string()
      .optional()
      .describe(
        "Optional keyword to filter services by description (case-insensitive). Example: 'weather' to find weather-related services.",
      ),
  })
  .strip()
  .describe("Parameters for listing x402 services with optional filtering");

// Schema for initial HTTP request
export const HttpRequestSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The URL of the API endpoint (can be localhost for development)"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .nullable()
      .default("GET")
      .describe("The HTTP method to use for the request"),
    headers: z
      .record(z.string())
      .optional()
      .nullable()
      .describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string())
      .optional()
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, you must use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .optional()
      .nullable()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
  })
  .strip()
  .describe("Instructions for making a basic HTTP request");

// Payment option schema that supports both v1 and v2 formats
const PaymentOptionSchema = z
  .object({
    scheme: z.string().describe("Payment scheme (e.g., 'exact')"),
    network: z
      .string()
      .describe("Network identifier (v1: 'base-sepolia' or v2 CAIP-2: 'eip155:84532')"),
    asset: z.string().describe("Asset address or identifier"),
    // v1 format
    maxAmountRequired: z.string().optional().describe("Maximum amount required (v1 format)"),
    // v2 format
    amount: z.string().optional().describe("Amount required (v2 format)"),
    price: z.string().optional().describe("Price (v2 format, e.g., '$0.01')"),
    payTo: z.string().optional().describe("Payment recipient address (v2 format)"),
  })
  .describe("Payment option supporting both v1 and v2 x402 formats");

// Schema for retrying a failed request with x402 payment
export const RetryWithX402Schema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The URL of the API endpoint (can be localhost for development)"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .nullable()
      .default("GET")
      .describe("The HTTP method to use for the request"),
    headers: z.record(z.string()).optional().describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string())
      .optional()
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, you must use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .optional()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
    selectedPaymentOption: PaymentOptionSchema.describe(
      "The payment option to use for this request",
    ),
  })
  .strip()
  .describe("Instructions for retrying a request with x402 payment after receiving a 402 response");

// Schema for direct x402 payment request (with warning)
export const DirectX402RequestSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The URL of the API endpoint (can be localhost for development)"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .nullable()
      .default("GET")
      .describe("The HTTP method to use for the request"),
    headers: z
      .record(z.string())
      .optional()
      .nullable()
      .describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string())
      .optional()
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .optional()
      .nullable()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
  })
  .strip()
  .describe(
    "Instructions for making an HTTP request with automatic x402 payment handling. WARNING: This bypasses user confirmation - only use when explicitly told to skip confirmation!",
  );
