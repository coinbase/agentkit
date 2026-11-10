import { z } from "zod";

export interface HcrbConfig {
  apiUrl?: string;
  apiKey?: string;
}

export const VerifyIbanSchema = z
  .object({
    iban: z.string().describe("International Bank Account Number (IBAN) to validate with ISO 7064 Mod 97-10 checksum math"),
  })
  .strip()
  .describe("Parameters for IBAN verification");

export const VerifyLeiSchema = z
  .object({
    lei: z.string().describe("20-character Legal Entity Identifier (ISO 17442) to validate with Mod 97 check digits"),
  })
  .strip()
  .describe("Parameters for LEI corporate identifier verification");

export const VerifyVatSchema = z
  .object({
    vat: z.string().describe("VAT tax number with country prefix (e.g. BE0123456749, FR, GB) to validate checksum"),
  })
  .strip()
  .describe("Parameters for VAT identifier verification");

export const CheckCounterpartyHistorySchema = z
  .object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 20-byte EVM address").describe("Counterparty Ethereum / Base address to audit for onchain USDC settlement history"),
  })
  .strip()
  .describe("Parameters for counterparty history check");

export const VerifyCoinbaseEasSchema = z
  .object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 20-byte EVM address").describe("Ethereum / Base address to verify for Coinbase Verified Account EAS attestation"),
  })
  .strip()
  .describe("Parameters for Coinbase EAS attestation verification");

export const CreateB2bInvoiceSchema = z
  .object({
    amountUsdc: z.number().positive().describe("Invoice amount in USDC"),
    clientName: z.string().describe("Client organisation name"),
    memo: z.string().optional().describe("Description of goods, deliverables, or agent engineering services"),
    recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("Beneficiary wallet address on Base (defaults to agent's own wallet)"),
  })
  .strip()
  .describe("Parameters for creating a B2B invoice on Base");
