import { z } from "zod";

export const EmptySchema = z.object({}).describe("No parameters required");

export const ReceiptSchema = z.object({
  id: z.string().min(8).max(128).describe("Unique id for the receipt (uuid recommended)"),
  occurredAt: z.string().describe("ISO 8601 time of the purchase"),
  network: z.string().describe("CAIP-2 network the purchase was paid on, e.g. eip155:8453"),
  resource: z.string().describe("URL that was bought"),
  method: z.string().default("GET").describe("HTTP method of the purchase"),
  requestHash: z.string().regex(/^[0-9a-f]{64}$/i).describe("sha256 hex of method + url + body"),
  delivered: z.boolean().describe("Whether the purchase returned a successful response"),
  payer: z.string().nullable().optional(),
  payee: z.string().nullable().optional().describe("The seller's payTo address"),
  amountAtomic: z.string().nullable().optional().describe("Amount in the asset's smallest unit (4000 = 0.004 USDC)"),
  asset: z.string().nullable().optional().describe("Asset address, e.g. USDC on Base"),
  txRef: z.string().nullable().optional().describe("Settlement transaction hash/signature"),
  responseHash: z.string().nullable().optional(),
  responseStatus: z.number().int().nullable().optional(),
  sellerReceipt: z.unknown().optional().describe("The seller's signed x402 offer-receipt, when issued"),
});

export const RecordReceiptsSchema = z
  .object({ receipts: z.array(ReceiptSchema).min(1).max(500).describe("The purchases to record") })
  .describe("Record x402 purchases as receipts on x402receipts (USD 1 per wallet per month, paid by this wallet over x402)");

export const VerifyReceiptSchema = z
  .object({ id: z.string().describe("The receipt id") })
  .describe("Fetch the public verification material for one receipt");
