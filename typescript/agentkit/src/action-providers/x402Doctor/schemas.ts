import { z } from "zod";

export const PreflightX402EndpointSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("The x402 endpoint you are about to pay, e.g. https://api.example.com/data?q=1"),
    method: z
      .enum(["GET", "POST"])
      .nullable()
      .optional()
      .describe("HTTP method you will call the endpoint with (default GET)"),
    maxUsd: z
      .number()
      .positive()
      .nullable()
      .optional()
      .describe("Your budget per call in USD; above it the verdict is no_go (e.g. 0.05)"),
  })
  .describe("Check an x402 endpoint with x402 Doctor before paying it");
