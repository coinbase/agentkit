import { z } from "zod";
import { DEFAULT_FACILITATOR } from "./constants";

/**
 * Schema for listing registered services/facilitators (no parameters required).
 */
export const EmptySchema = z.object({}).describe("No parameters required");

/**
 * Configuration options for X402ActionProvider.
 
 */
export interface X402Config {
  /** Service URLs the agent can call. Only these services will be allowed for HTTP requests. */
  registeredServices?: string[];

  /**
   * Allow agent to register services discovered from bazaar at runtime.
   * Default: false (or X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION="true" env var)
   */
  allowDynamicServiceRegistration?: boolean;

  /**
   * Additional facilitators beyond the defaults (CDP + PayAI).
   * Map of name -> URL. Names can be used with discover_x402_services action.
   * Example: { "myFacilitator": "https://my-facilitator.com" }
   */
  registeredFacilitators?: Record<string, string>;

  /**
   * Maximum payment per request in USDC whole units.
   * Default: 1.0 (or X402_MAX_PAYMENT_USDC env var)
   */
  maxPaymentUsdc?: number;
}

/**
 * Schema for registering a service URL for x402 requests.
 * Only available when allowDynamicServiceRegistration is true.
 */
export const RegisterServiceSchema = z
  .object({
    url: z.string().url().describe("Service URL to register for x402 requests"),
  })
  .describe("Parameters for registering a service URL for x402 requests");

// Schema for listing x402 services
export const ListX402ServicesSchema = z
  .object({
    facilitator: z
      .string()
      .nullable()
      .transform(val => val ?? DEFAULT_FACILITATOR)
      .describe(
        "Facilitator to query: 'cdp' (Coinbase CDP), 'payai' (PayAI) or a registered custom facilitator name.",
      ),
    maxUsdcPrice: z
      .number()
      .nonnegative()
      .finite()
      .nullable()
      .transform(val => val ?? 1.0)
      .describe(
        "Maximum price in USDC whole units (e.g., 0.1 for 0.10 USDC). Only USDC payment options will be considered. Defaults to 1.0 USDC.",
      ),
    x402Versions: z
      .array(z.union([z.literal(1), z.literal(2)]))
      .nullable()
      .transform(val => val ?? ([1, 2] as (1 | 2)[]))
      .describe("Filter by x402 protocol version (1 or 2). Defaults to accepting both versions."),
    keyword: z
      .string()
      .nullable()
      .describe(
        "Optional keyword to filter services by description (case-insensitive). Example: 'weather' to find weather-related services.",
      ),
  })
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
      .transform(val => val ?? "GET")
      .describe("The HTTP method to use for the request"),
    headers: z
      .record(z.string(), z.string())
      .nullable()
      .describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, you must use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .nullable()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
  })
  .describe("Instructions for making a basic HTTP request");

// Payment option schema that supports both v1 and v2 formats
const PaymentOptionSchema = z
  .object({
    scheme: z.string().describe("Payment scheme (e.g., 'exact')"),
    network: z
      .string()
      .describe("Network identifier (v1: 'base-sepolia' or v2 CAIP-2: 'eip155:84532')"),
    asset: z.string().describe("Asset address or identifier"),
    maxAmountRequired: z.string().nullable().describe("Maximum amount required (v1 format)"),
    amount: z.string().nullable().describe("Amount required (v2 format)"),
    price: z.string().nullable().describe("Price (v2 format, e.g., '$0.01')"),
    payTo: z.string().nullable().describe("Payment recipient address (v2 format)"),
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
      .transform(val => val ?? "GET")
      .describe("The HTTP method to use for the request"),
    headers: z
      .record(z.string(), z.string())
      .nullable()
      .describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, you must use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .nullable()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
    selectedPaymentOption: PaymentOptionSchema.describe(
      "The payment option to use for this request",
    ),
  })
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
      .transform(val => val ?? "GET")
      .describe("The HTTP method to use for the request"),
    headers: z
      .record(z.string(), z.string())
      .nullable()
      .describe("Optional headers to include in the request"),
    queryParams: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        "Query parameters to append to the URL as key-value string pairs. " +
          "Use ONLY for GET/DELETE requests. " +
          "For POST/PUT/PATCH, use the 'body' parameter instead. " +
          "Example: {location: 'NYC', units: 'metric'} becomes ?location=NYC&units=metric",
      ),
    body: z
      .any()
      .nullable()
      .describe(
        "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. " +
          "Always prefer 'body' over 'queryParams' for POST/PUT/PATCH. " +
          "Do NOT use for GET or DELETE, use queryParams instead.",
      ),
  })
  .describe(
    "Instructions for making an HTTP request with automatic x402 payment handling. WARNING: This bypasses user confirmation - only use when explicitly told to skip confirmation!",
  );
