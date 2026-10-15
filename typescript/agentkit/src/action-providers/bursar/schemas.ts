import { z } from "zod";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const CAPABILITY = /^(?:(?:service|hire|rwa):)?[^\s:]+:[^\s:]+$/;
const DIGITS = /^(?:0|[1-9][0-9]*)$/;

const AMOUNT =
  'USDG in six-decimal units, digits only: "1000000" is 1.00 USDG and "250000" is 0.25 USDG. A decimal point is not accepted.';

const provider = z
  .string()
  .regex(ADDRESS, "provider must be a 0x-prefixed 20-byte address")
  .describe("The provider being paid, as a 0x address.");

const capability = z
  .string()
  .regex(CAPABILITY, 'capability must be named and versioned, like "gpu.render:1"')
  .describe(
    'What is being bought, named and versioned: "gpu.render:1". The mandate allows each one by name.',
  );

const amount = z.string().regex(DIGITS, `amount must be ${AMOUNT}`).describe(AMOUNT);

/**
 * Input schema for the inspect action. It takes nothing.
 */
export const InspectSchema = z.object({}).strip().describe("Read the mandate. No inputs.");

/**
 * Input schema for the quote action.
 */
export const QuoteSchema = z
  .object({ provider, capability, amount })
  .strip()
  .describe("Instructions for quoting one spend against the mandate");

/**
 * Input schema for the pay action.
 */
export const PaySchema = z
  .object({
    provider,
    capability,
    amount,
    input: z
      .string()
      .optional()
      .describe(
        "What the provider is being paid to do. Plain text, or a JSON object. It is committed with the payment, so both sides can prove what was asked.",
      ),
    deliverWithinSeconds: z
      .string()
      .regex(DIGITS, "deliverWithinSeconds must be a whole number of seconds")
      .optional()
      .describe(
        "How long the provider has to deliver before the funds return to the mandate. Defaults to 600. The escrow bounds it, and inspect reports the range.",
      ),
  })
  .strip()
  .describe("Instructions for paying a provider from the mandate");

/**
 * Input schema for the settlements action.
 */
export const SettlementsSchema = z
  .object({
    settlementId: z
      .string()
      .regex(/^[1-9][0-9]*$/, "settlementId must be a positive whole number")
      .optional()
      .describe("The settlement id from pay. Leave it out to list this agent's payments."),
  })
  .strip()
  .describe("Instructions for reading settlements");
