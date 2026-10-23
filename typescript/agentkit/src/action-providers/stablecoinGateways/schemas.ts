import { z } from "zod";

/**
 * Configuration for {@link StablecoinGatewaysActionProvider}.
 */
export interface StablecoinGatewaysConfig {
  /**
   * API origin. Defaults to https://api.stablecoingateways.com.
   */
  baseUrl?: string;

  /**
   * Maximum USDC, in whole units, spent on a single call. Defaults to 0.05.
   * A 402 whose USDC amount is above this cap is refused before the wallet signs.
   */
  maxPaymentUsdc?: number;
}

const ADDRESS_MIN = 20;
const ADDRESS_MAX = 120;
const NAME_MIN = 2;
const NAME_MAX = 120;

/**
 * Crypto address accepted by the sanctions lookup (length contract from the API).
 */
const addressSchema = z
  .string()
  .min(ADDRESS_MIN)
  .max(ADDRESS_MAX)
  .describe("Crypto wallet address to check (20-120 characters; 0x or bech32)");

/**
 * Business or merchant name.
 */
const nameSchema = z
  .string()
  .min(NAME_MIN)
  .max(NAME_MAX)
  .describe("Company legal or trading name (2-120 characters). Individuals are not screened.");

/**
 * Hostname. Pattern is the API's domain contract.
 */
const domainSchema = z
  .string()
  .regex(/^[A-Za-z0-9.-]{3,253}$/)
  .describe("Domain name, for example example.com");

/**
 * 20-character LEI: 18 alphanumeric characters and a 2-digit check pair.
 */
const leiSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{18}[0-9]{2}$/)
  .describe("20-character Legal Entity Identifier");

/**
 * EU VAT number with a 2-letter country prefix. Format check only.
 */
const vatSchema = z
  .string()
  .regex(/^[A-Z]{2}[A-Za-z0-9+*]{2,13}$/)
  .describe("EU VAT number with a 2-letter country prefix, for example DE129274202");

/**
 * ISO 3166 alpha-2 country code. Letters only; case is not restricted.
 */
const countrySchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .describe("ISO 3166 alpha-2 country code used to filter LEI matches");

/**
 * Optional US ticker for the SEC match. Pattern matches the live merchant-check schema.
 */
const tickerSchema = z
  .string()
  .regex(/^[A-Za-z0-9.-]{1,10}$/)
  .describe("Optional US stock ticker for the SEC match");

/**
 * Input for `screen_crypto_address`.
 */
export const ScreenCryptoAddressSchema = z
  .object({
    address: addressSchema,
  })
  .describe(
    "Wallet address to check against OFAC's published list of sanctioned digital currency addresses",
  );

/**
 * Input for `counterparty_check`.
 * At least one of name, domain, lei, or address is required. VAT and country are filters, not identifiers.
 */
export const CounterpartyCheckSchema = z
  .object({
    name: nameSchema.nullish().describe("Company name to screen and match. Optional."),
    domain: domainSchema.nullish().describe("Company domain. Optional."),
    lei: leiSchema.nullish().describe("LEI to look up directly. Optional."),
    vat: vatSchema.nullish().describe("EU VAT number for a format check. Optional."),
    country: countrySchema.nullish().describe("Country filter for LEI matches. Optional."),
    address: addressSchema
      .nullish()
      .describe("Crypto wallet address to check against OFAC. Optional."),
  })
  .refine(
    value => [value.name, value.domain, value.lei, value.address].some(field => Boolean(field)),
    {
      message: "At least one of name, domain, lei, or address is required",
    },
  )
  .describe(
    "KYB preflight for a business counterparty. Provide at least one of name, domain, lei, or address.",
  );

/**
 * Input for `merchant_check`. Domain is required by the live endpoint.
 */
export const MerchantCheckSchema = z
  .object({
    domain: domainSchema.describe("Merchant domain or hostname (required)"),
    name: nameSchema
      .nullish()
      .describe("Company name. Optional. Screens OFAC and matches LEI and SEC."),
    ticker: tickerSchema.nullish().describe("US stock ticker for the SEC match. Optional."),
    lei: leiSchema.nullish().describe("LEI to look up directly. Optional."),
    country: countrySchema.nullish().describe("Country filter for LEI matches. Optional."),
  })
  .describe("Neutral facts about a merchant before paying it. Domain is required.");
