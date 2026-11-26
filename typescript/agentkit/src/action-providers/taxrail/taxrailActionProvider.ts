import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  Br35kStatusSchema,
  CheckTaxImpactSchema,
  ClassifyExpenseSchema,
  CompareBorrowVsSellSchema,
  TaxRailActionProviderConfig,
} from "./schemas";

const DEFAULT_TAXRAIL_BASE_URL = "https://api.taxrail.online";

/**
 * TaxRailActionProvider enables AI agents to simulate US (IRS 1099-DA, HIFO/SpecID, TLH)
 * and Brazil (Lei 14.754, R$35k rule, Lucro Real) crypto & DeFi tax impact before executing swaps.
 */
export class TaxRailActionProvider extends ActionProvider {
  private readonly baseUrl: string;
  private readonly referrerWallet?: string;

  /**
   * Constructor for TaxRailActionProvider.
   *
   * @param config - Optional TaxRail baseUrl and 20% affiliate referrerWallet address.
   */
  constructor(config: TaxRailActionProviderConfig = {}) {
    super("taxrail", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_TAXRAIL_BASE_URL).replace(/\/$/, "");
    this.referrerWallet = config.referrerWallet;
  }

  /**
   * Checks pre-trade capital gains tax impact and HIFO/SpecID savings for a planned disposal.
   *
   * @param args - Wallet, asset, quantity, chain, and jurisdiction parameters.
   * @returns A JSON string containing baseline vs optimized tax, savings, and unlockable planId.
   */
  @CreateAction({
    name: "check_tax_impact",
    description: `Simulate crypto capital gains tax BEFORE executing any swap or sell (FREE).
Compares naive FIFO vs TaxRail SpecID/HIFO lot selection and Tax-Loss Harvesting across US (IRS 1099-DA / Form 8949) and Brazil (Lei 14.754 / R$35k rule).
Returns baselineTaxUsd, optimizedTaxUsd, taxSavedUsd, agentGuidance, and an unlockable planId for /api/v1/unlock-plan (10% of verified savings, $0 if $0 saved).`,
    schema: CheckTaxImpactSchema,
  })
  async checkTaxImpact(args: z.infer<typeof CheckTaxImpactSchema>): Promise<string> {
    try {
      const payload = {
        jurisdiction: args.jurisdiction,
        regime: args.jurisdiction === "BR" ? "PF_LEI_14754" : "INDIVIDUAL",
        chain: args.chain,
        targetAsset: args.targetAsset,
        sellQuantity: args.sellQuantity,
        walletAddress: args.walletAddress,
        ...(this.referrerWallet ? { referrerWallet: this.referrerWallet } : {}),
      };

      const response = await fetch(`${this.baseUrl}/api/v1/check-tax-impact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.referrerWallet ? { "X-TaxRail-Referrer": this.referrerWallet } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status} body: ${text}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error checking TaxRail tax impact: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Compares selling appreciated crypto vs borrowing USDC on Aave v3 before execution.
   *
   * @param args - Collateral asset, cost basis, liquidity needed, and chain parameters.
   * @returns A JSON string with borrow vs sell net comparison and unlockable Aave calldata planId.
   */
  @CreateAction({
    name: "compare_borrow_vs_sell",
    description: `Compare paying capital gains tax from selling appreciated crypto vs borrowing USDC on Aave v3 (FREE).
Factors LTV liquidation risk, borrow APR, corporate interest shields, and returns an unlockable planId with unsigned Aave v3 calldata.`,
    schema: CompareBorrowVsSellSchema,
  })
  async compareBorrowVsSell(args: z.infer<typeof CompareBorrowVsSellSchema>): Promise<string> {
    try {
      const payload = {
        ...args,
        regime: args.jurisdiction === "BR" ? "PF_LEI_14754" : "INDIVIDUAL",
        ...(this.referrerWallet ? { referrerWallet: this.referrerWallet } : {}),
      };

      const response = await fetch(`${this.baseUrl}/api/v1/borrow-vs-sell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.referrerWallet ? { "X-TaxRail-Referrer": this.referrerWallet } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status} body: ${text}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error comparing borrow vs sell on TaxRail: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Classifies corporate AI/cloud/SaaS expenses for US & Brazil corporate tax shields.
   *
   * @param args - Jurisdiction, regime, vendor, description, and amount parameters.
   * @returns A JSON string with deductible tax shield breakdown and compliance checklist.
   */
  @CreateAction({
    name: "classify_deductible_expense",
    description: `Classify an AI, cloud, SaaS, or contractor invoice for corporate tax deductions (FREE).
Supports US C-Corp/LLC and Brazil Lucro Real (34% IRPJ/CSLL + PIS/COFINS + IBS/CBS readiness).`,
    schema: ClassifyExpenseSchema,
  })
  async classifyDeductibleExpense(args: z.infer<typeof ClassifyExpenseSchema>): Promise<string> {
    try {
      const payload = {
        ...args,
        ...(this.referrerWallet ? { referrerWallet: this.referrerWallet } : {}),
      };

      const response = await fetch(`${this.baseUrl}/api/v1/classify-expense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.referrerWallet ? { "X-TaxRail-Referrer": this.referrerWallet } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status} body: ${text}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error classifying TaxRail expense: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Queries Brazil R$35,000 monthly exemption headroom & Lei 14.754 status ($0.005 USDC x402).
   *
   * @param args - Monthly BRL sales, planned sale in USD, custody location, and optional x402 signature.
   * @returns JSON status result or HTTP 402 x402 PaymentRequired instructions for AgentKit x402 signers.
   */
  @CreateAction({
    name: "check_br_35k_status",
    description: `Check Brazil R$35,000 monthly crypto tax-exemption headroom vs Lei 14.754 15% flat tax ($0.005 USDC via x402 on Base).
If paymentSignature is omitted, returns the parsed x402 v2 challenge so an x402 wallet provider can settle it.`,
    schema: Br35kStatusSchema,
  })
  async checkBr35kStatus(args: z.infer<typeof Br35kStatusSchema>): Promise<string> {
    try {
      const query = new URLSearchParams({
        monthlySalesBrl: String(args.monthlySalesBrl),
        plannedSaleUsd: String(args.plannedSaleUsd),
        custodyLocation: args.custodyLocation,
      });

      const response = await fetch(
        `${this.baseUrl}/api/v1/x402/br-35k-status?${query.toString()}`,
        {
          method: "GET",
          headers: {
            ...(args.paymentSignature ? { "PAYMENT-SIGNATURE": args.paymentSignature } : {}),
            ...(this.referrerWallet ? { "X-TaxRail-Referrer": this.referrerWallet } : {}),
          },
        }
      );

      const data = await response.json();
      if (response.status === 402) {
        return JSON.stringify({ status: 402, paymentRequired: data }, null, 2);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error checking Brazil R$35k status on TaxRail: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * TaxRail supports Base, Ethereum, Arbitrum, and Solana workflows across EVM/SVM agents.
   *
   * @param _network - Network object (unused).
   * @returns True for all networks.
   */
  supportsNetwork = (_network: Network) => true;
}

/**
 * Factory function creating a TaxRailActionProvider instance.
 *
 * @param config - Optional TaxRail configuration (baseUrl, referrerWallet).
 * @returns A new TaxRailActionProvider instance.
 */
export const taxrailActionProvider = (config: TaxRailActionProviderConfig = {}) =>
  new TaxRailActionProvider(config);
