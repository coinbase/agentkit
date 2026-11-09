import { z } from "zod";

/**
 * Input schema for Grid402 CNPJ query.
 */
export const Grid402CnpjSchema = z
  .object({
    cnpj: z
      .string()
      .describe("The 14-digit Brazilian company tax ID (CNPJ), formatted or unformatted digits"),
  })
  .strict();

/**
 * Input schema for Grid402 CEP query.
 */
export const Grid402CepSchema = z
  .object({
    code: z
      .string()
      .describe("The 8-digit Brazilian postal code (CEP), formatted or unformatted digits"),
  })
  .strict();

/**
 * Input schema for Grid402 Forex query.
 */
export const Grid402ForexSchema = z
  .object({})
  .strict()
  .describe("No parameters required to fetch official foreign exchange rates to BRL");

/**
 * Input schema for Grid402 Crypto query.
 */
export const Grid402CryptoSchema = z
  .object({})
  .strict()
  .describe("No parameters required to fetch market crypto spot prices in BRL");

/**
 * Input schema for Grid402 DNS lookup query.
 */
export const Grid402DnsSchema = z
  .object({
    domain: z.string().describe("The domain name to inspect authoritative DNS records for"),
  })
  .strict();

/**
 * Input schema for Grid402 SSL inspection query.
 */
export const Grid402SslSchema = z
  .object({
    host: z.string().describe("The hostname or domain to inspect TLS or SSL certificate for"),
  })
  .strict();

/**
 * Input schema for Grid402 ASN lookup query.
 */
export const Grid402AsnSchema = z
  .object({
    ip: z
      .string()
      .describe("The IPv4 or IPv6 address to look up autonomous system routing data for"),
  })
  .strict();

/**
 * Input schema for Grid402 macroeconomic indicators query.
 */
export const Grid402IndicatorsSchema = z
  .object({})
  .strict()
  .describe("No parameters required to fetch official SELIC, CDI, IPCA, and IGP-M rates");

/**
 * Input schema for Grid402 holidays query.
 */
export const Grid402HolidaysSchema = z
  .object({
    year: z
      .number()
      .optional()
      .describe("Calendar year for national and banking holidays (defaults to current year)"),
  })
  .strict();

/**
 * Input schema for Grid402 workdays calculation query.
 */
export const Grid402WorkdaysSchema = z
  .object({
    startDate: z.string().describe("Starting date formatted as YYYY-MM-DD"),
    endDate: z
      .string()
      .optional()
      .describe("Ending date formatted as YYYY-MM-DD to count working days between"),
    days: z
      .number()
      .optional()
      .describe("Number of business days to add or subtract from startDate"),
  })
  .strict();

/**
 * Input schema for Grid402 cryptographic proof verification.
 */
export const Grid402VerifyProofSchema = z
  .object({
    payload: z
      .union([z.string(), z.record(z.string(), z.any())])
      .describe("The response object or JSON string containing the _oracle_proof field to verify"),
  })
  .strict();

/**
 * Input schema for Grid402 summary status query.
 */
export const Grid402SummarySchema = z
  .object({})
  .strict()
  .describe("No parameters required to fetch API capabilities and operational status");
