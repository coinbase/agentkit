import { z } from "zod";

const EthAddressRegex = /^0x[a-fA-F0-9]{40}$/;

export const CreateEscrowSchema = z
  .object({
    seller: z
      .string()
      .regex(EthAddressRegex, "Invalid Ethereum address format")
      .describe("Ethereum address of the seller/service provider to receive payment"),
    amount_usdc: z
      .number()
      .positive()
      .describe(
        "Amount of USDC to lock in escrow, in whole units (e.g., 0.50 for $0.50). " +
          "Minimum $0.10, maximum $100. Do not convert to wei.",
      ),
    timelock_minutes: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe(
        "Minutes until the escrow expires and the buyer can claim a refund. " +
          "Default: 30 minutes for API calls. Use longer for tasks (e.g., 1440 for 24 hours).",
      ),
    service_url: z
      .string()
      .describe(
        "URL or description of the service being purchased. Hashed on-chain as serviceHash.",
      ),
  })
  .strip()
  .describe("Create a USDC escrow to protect a transaction with a seller");

export const ReleaseEscrowSchema = z
  .object({
    escrow_id: z
      .string()
      .describe("The numeric escrow ID returned by create_escrow (e.g., '0', '1', '42')"),
  })
  .strip()
  .describe("Release escrowed USDC to the seller after confirming delivery");

export const DisputeEscrowSchema = z
  .object({
    escrow_id: z.string().describe("The numeric escrow ID to dispute"),
    reason: z
      .string()
      .describe(
        "Brief reason for the dispute (e.g., 'API returned error 500', 'response was empty')",
      ),
  })
  .strip()
  .describe("Dispute an escrow and lock funds for arbiter review");

export const EscrowStatusSchema = z
  .object({
    escrow_id: z.string().describe("The numeric escrow ID to check"),
  })
  .strip()
  .describe("Check the current state of an escrow");

export const TrustScoreSchema = z
  .object({
    address: z
      .string()
      .regex(EthAddressRegex, "Invalid Ethereum address format")
      .describe("Ethereum address to look up the on-chain trust score for"),
  })
  .strip()
  .describe("Look up the on-chain trust score of an agent address");

export const ProtectedCallSchema = z
  .object({
    url: z.string().url().describe("URL of the API endpoint to call"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .default("GET")
      .describe("HTTP method for the API call"),
    headers: z.record(z.string()).optional().describe("Optional HTTP headers"),
    body: z.string().optional().describe("Optional request body for POST/PUT/PATCH requests"),
    seller_address: z
      .string()
      .regex(EthAddressRegex, "Invalid Ethereum address format")
      .describe("Ethereum address of the API provider/seller"),
    amount_usdc: z
      .number()
      .positive()
      .describe(
        "USDC amount to escrow, in whole units (e.g., 0.50 for $0.50). Do not convert to wei.",
      ),
    timelock_minutes: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Escrow expiry in minutes (default: 30)"),
    verification_schema: z
      .string()
      .describe(
        "JSON Schema string to validate the API response against. " +
          'Example: \'{"type":"object","required":["data","status"]}\'. ' +
          "If the response matches, payment is auto-released. If not, it is auto-disputed.",
      ),
  })
  .strip()
  .describe("Make an API call with automatic escrow protection and response verification");
