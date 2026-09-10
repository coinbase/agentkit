import { z } from "zod";

export const UcpDiscoverSchema = z.object({
  domain: z.string().describe("Merchant domain or base URL to discover UCP capabilities for (e.g. 'merchant.example.com')"),
});

export const UcpQuoteSchema = z.object({
  domain: z.string().describe("Merchant domain or base URL"),
  sku: z.string().describe("Identifier of the item, API, or compute resource to quote"),
  quantity: z.number().int().positive().default(1).describe("Number of units requested"),
});

export const UcpCompileSchema = z.object({
  domain: z.string().describe("Merchant domain"),
  sku: z.string().describe("Item SKU"),
  quantity: z.number().int().positive().default(1),
  totalMinor: z.string().describe("Total price in USDC minor units (6 decimals) from quote"),
  merchantAddress: z.string().describe("Merchant settlement wallet address (0x...)"),
  maxPerOrderMinor: z.string().optional().describe("Maximum allowed USDC minor units per single order"),
  budgetCapMinor: z.string().optional().describe("Remaining budget cap in USDC minor units"),
});

export const UcpPaySchema = z.object({
  domain: z.string().describe("Merchant domain"),
  sessionId: z.string().describe("Checkout session ID from quote"),
  escrowAddress: z.string().optional().describe("Escrow contract address on Base"),
  tokenAddress: z.string().optional().describe("USDC token contract address"),
  merchantAddress: z.string().describe("Merchant settlement wallet address"),
  totalMinor: z.string().describe("Total price in USDC minor units"),
  nonce: z.string().describe("Payee-binding commitment nonce (bytes32 hex)"),
  validUntil: z.number().describe("Unix timestamp until which authorization is valid"),
});

export const UcpVerifyReceiptSchema = z.object({
  receipt: z.record(z.string(), z.any()).describe("The XDR-1 Execution Delivery Receipt object returned by the merchant"),
  trustedSignerAddress: z.string().optional().describe("Expected Ethereum address of the receipt signer"),
});

export interface UcpConfig {
  defaultEscrowAddress?: string;
  defaultNetwork?: string;
}
