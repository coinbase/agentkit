import { z } from "zod";

/**
 * Schema for searching available travel eSIM data plans.
 */
export const SearchEsimSchema = z
  .object({
    country: z
      .string()
      .min(2, "Country name or ISO code must be at least 2 characters")
      .describe("The destination country name (e.g. 'Japan', 'France', 'United States') or ISO code"),
  })
  .strip()
  .describe("Parameters for searching available travel eSIM data packages");

/**
 * Schema for purchasing an eSIM via non-custodial USDT settlement invoice.
 */
export const PurchaseEsimSchema = z
  .object({
    packageCode: z
      .string()
      .min(1, "Package code is required")
      .describe("The unique package code identifier of the selected eSIM plan (e.g. 'P4XU0X3CX')"),
    customerEmail: z
      .string()
      .email("A valid email address is required for eSIM profile delivery")
      .describe("The delivery email address where eSIM installation credentials and receipt will be sent"),
    network: z
      .enum(["base", "polygon", "arbitrum", "tron"])
      .default("base")
      .describe("The blockchain network to settle the payment on ('base', 'polygon', 'arbitrum', or 'tron'). Defaults to 'base'"),
    currency: z
      .enum(["USDC", "USDT"])
      .default("USDC")
      .describe("Payment stablecoin currency, 'USDC' or 'USDT'. Defaults to 'USDC'"),
  })
  .strip()
  .describe("Parameters for initiating an eSIM purchase and generating a payment invoice");

/**
 * Schema for checking the status and retrieving eSIM QR code/LPA string.
 */
export const CheckOrderStatusSchema = z
  .object({
    invoiceId: z
      .string()
      .min(1, "Invoice ID is required")
      .describe("The ConnectMeGuru invoice ID returned from purchase_esim (e.g. 'CMG-INV-1718000000-001')"),
  })
  .strip()
  .describe("Parameters for polling settlement status and downloading the eSIM profile");
