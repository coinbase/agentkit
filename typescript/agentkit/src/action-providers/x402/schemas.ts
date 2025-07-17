import { z } from "zod";

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
    body: z
      .any()
      .optional()
      .nullable()
      .describe("Optional request body for POST/PUT/PATCH requests"),
  })
  .strip()
  .describe("Instructions for making a basic HTTP request");

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
    headers: z
      .record(z.string())
      .optional()
      .describe("Optional headers to include in the request"),
    body: z
      .any()
      .optional()
      .describe("Optional request body for POST/PUT/PATCH requests"),
    selectedPaymentOption: z
      .object({
        scheme: z.string(),
        network: z.string(),
        maxAmountRequired: z.string(),
        asset: z.string(),
      })
      .describe("The payment option to use for this request"),
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
    body: z
      .any()
      .optional()
      .nullable()
      .describe("Optional request body for POST/PUT/PATCH requests"),
  })
  .strip()
  .describe(
    "Instructions for making an HTTP request with automatic x402 payment handling. WARNING: This bypasses user confirmation - only use when explicitly told to skip confirmation!",
  );
