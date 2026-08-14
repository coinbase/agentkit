import { z } from "zod";
import canonicalize from "canonicalize";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  AgentGuildPaymentOptionSchema,
  PurchaseAgentTrustSchema,
  PurchasePaymentSafetySchema,
  QuoteAgentTrustSchema,
  QuotePaymentSafetySchema,
} from "./schemas";

const DEFAULT_BASE_URL = "https://agent-guild-5d5r.onrender.com";
const BASE_MAINNET = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const CLIENT_USER_AGENT = "coinbase-agentkit-agent-guild/1";
const USDC_DECIMALS = 6;

export interface AgentGuildActionProviderConfig {
  /** Agent Guild-compatible service root. Defaults to the public Agent Guild service. */
  baseUrl?: string;
  /** Explicitly allow purchases against a non-default service root. Defaults to false. */
  allowPaymentsToOverriddenBaseUrl?: boolean;
  /** Hard ceiling for any one Agent Guild purchase, in whole USDC. Defaults to 0.01. */
  maxPaymentUsdc?: number;
}

type PaymentOption = z.infer<typeof AgentGuildPaymentOptionSchema>;
type JsonObject = Record<string, unknown>;

interface RequestSpec {
  url: string;
  method: "GET" | "POST";
  body?: JsonObject;
}

/**
 * AgentGuildActionProvider adds delegation-time trust and payment-safety actions.
 * Quotes never pay. Purchase actions require an exact prior option and enforce it
 * again against the live 402 before a payment payload can be created.
 */
export class AgentGuildActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;
  private readonly maxPaymentAtomic: bigint;
  private readonly paymentsAllowed: boolean;

  /**
   * Creates an Agent Guild provider with an optional service root and hard spend cap.
   *
   * @param config - Service root and maximum permitted purchase amount.
   */
  constructor(config: AgentGuildActionProviderConfig = {}) {
    super("agentGuild", []);

    const parsed = new URL(config.baseUrl ?? DEFAULT_BASE_URL);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("Agent Guild baseUrl must be HTTP(S) without embedded credentials");
    }
    this.baseUrl = parsed.toString().replace(/\/$/, "");
    this.paymentsAllowed =
      this.baseUrl === DEFAULT_BASE_URL || config.allowPaymentsToOverriddenBaseUrl === true;

    const maxPaymentUsdc = config.maxPaymentUsdc ?? 0.01;
    if (!Number.isFinite(maxPaymentUsdc) || maxPaymentUsdc <= 0) {
      throw new Error("maxPaymentUsdc must be a positive finite number");
    }
    this.maxPaymentUsdc = maxPaymentUsdc;
    this.maxPaymentAtomic = BigInt(Math.floor(maxPaymentUsdc * 10 ** USDC_DECIMALS));
    if (this.maxPaymentAtomic <= 0n) {
      throw new Error("maxPaymentUsdc must be at least one atomic unit of USDC");
    }
  }

  /**
   * Returns an unpaid x402 quote for a capability-specific trust decision.
   *
   * @param args - Trust-decision request fields.
   * @returns A serialized result or exact x402 quote.
   */
  @CreateAction({
    name: "quote_agent_trust",
    description: `Request the exact current price to rank trustworthy agents for a capability.
This action never creates a payment. Use it immediately before delegating work to an unfamiliar agent.
If payment is required, show the exact USDC amount, payee and network before using purchase_agent_trust.`,
    schema: QuoteAgentTrustSchema,
  })
  async quoteAgentTrust(args: z.infer<typeof QuoteAgentTrustSchema>): Promise<string> {
    return this.quote(this.trustRequest(args));
  }

  /**
   * Purchases a trust decision only when the live quote still matches the approved option.
   *
   * @param walletProvider - Base-mainnet wallet used by the x402 client.
   * @param args - Trust request, prior quote, and explicit confirmation.
   * @returns A serialized result with settlement evidence or an honest unknown state.
   */
  @CreateAction({
    name: "purchase_agent_trust",
    description: `Purchase the Agent Guild trust decision quoted by quote_agent_trust.
This action spends Base-mainnet USDC. Call it only after the exact quote is approved.
It fails before signing if the live 402 differs in scheme, network, asset, amount or payee, or exceeds maxPaymentUsdc.`,
    schema: PurchaseAgentTrustSchema,
  })
  async purchaseAgentTrust(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PurchaseAgentTrustSchema>,
  ): Promise<string> {
    if (args.confirmPayment !== true) {
      return this.confirmationRequired();
    }
    return this.purchase(walletProvider, this.trustRequest(args), args.selectedPaymentOption);
  }

  /**
   * Returns an unpaid quote for a decision bound to an exact contemplated payment.
   *
   * @param args - Exact payment and risk-policy fields.
   * @returns A serialized result or exact x402 quote.
   */
  @CreateAction({
    name: "quote_payment_safety",
    description: `Request the exact current price for a signed AGPD-1 allow/block decision before a Base USDC payment.
This action never creates a payment. It binds the intended payee, asset, amount, resource, capability and risk thresholds.`,
    schema: QuotePaymentSafetySchema,
  })
  async quotePaymentSafety(args: z.infer<typeof QuotePaymentSafetySchema>): Promise<string> {
    return this.quote(this.paymentSafetyRequest(args));
  }

  /**
   * Purchases a payment-safety decision only when the exact approved quote is unchanged.
   *
   * @param walletProvider - Base-mainnet wallet used by the x402 client.
   * @param args - Exact payment request, prior quote, and explicit confirmation.
   * @returns A serialized result with settlement evidence or an honest unknown state.
   */
  @CreateAction({
    name: "purchase_payment_safety",
    description: `Purchase the signed AGPD-1 decision quoted by quote_payment_safety.
This action spends Base-mainnet USDC. Call it only after the exact quote is approved, then require the returned decision to be allow and verify its signature and exact request binding before signing the protected payment.
The provider caps this decision fee directly and never recursively invokes payment safety for its own fee.
It fails before signing if the live 402 changes or exceeds maxPaymentUsdc.`,
    schema: PurchasePaymentSafetySchema,
  })
  async purchasePaymentSafety(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PurchasePaymentSafetySchema>,
  ): Promise<string> {
    if (args.confirmPayment !== true) {
      return this.confirmationRequired();
    }
    return this.purchase(
      walletProvider,
      this.paymentSafetyRequest(args),
      args.selectedPaymentOption,
    );
  }

  /**
   * Returns whether this provider can safely use the wallet network.
   *
   * @param network - Wallet network metadata.
   * @returns True only for Base mainnet EVM wallets.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  /**
   * Builds the exact trust-decision request shared by quote and purchase actions.
   *
   * @param args - Trust-decision request fields.
   * @returns The HTTP request specification.
   */
  private trustRequest(args: z.infer<typeof QuoteAgentTrustSchema>): RequestSpec {
    const url = new URL("/check", `${this.baseUrl}/`);
    url.searchParams.set("capability", args.capability);
    url.searchParams.set("signed", String(args.signed));
    url.searchParams.set("ttl_seconds", String(args.ttlSeconds));
    return { url: url.toString(), method: "GET" };
  }

  /**
   * Builds the exact AGPD-1 payment-safety request shared by quote and purchase actions.
   *
   * @param args - Exact payment and policy fields.
   * @returns The HTTP request specification.
   */
  private paymentSafetyRequest(args: z.infer<typeof QuotePaymentSafetySchema>): RequestSpec {
    return {
      url: new URL("/wallet-binding/decision", `${this.baseUrl}/`).toString(),
      method: "POST",
      body: {
        payment: {
          scheme: "exact",
          network: BASE_MAINNET,
          asset: args.asset,
          amount: args.amount,
          pay_to: args.payTo,
          resource: args.resource,
        },
        capability: args.capability,
        policy: {
          max_risk: args.maxRisk,
          min_confidence: args.minConfidence,
        },
        ttl_seconds: args.ttlSeconds,
      },
    };
  }

  /**
   * Builds headers for a JSON request without any payment material.
   *
   * @param spec - HTTP request specification.
   * @returns Request headers.
   */
  private requestHeaders(spec: RequestSpec): Record<string, string> {
    return {
      Accept: "application/json",
      "User-Agent": CLIENT_USER_AGENT,
      ...(spec.body ? { "Content-Type": "application/json" } : {}),
    };
  }

  /**
   * Fetches and parses a quote without registering a signer or payment client.
   *
   * @param spec - HTTP request specification.
   * @returns A serialized quote or response.
   */
  private async quote(spec: RequestSpec): Promise<string> {
    try {
      const response = await fetch(spec.url, {
        method: spec.method,
        headers: this.requestHeaders(spec),
        body: spec.body ? JSON.stringify(spec.body) : undefined,
      });
      const data = await this.parseResponse(response);

      if (response.status !== 402) {
        return JSON.stringify(
          {
            success: response.ok,
            paid: false,
            status: response.status,
            data,
          },
          null,
          2,
        );
      }

      const encoded = response.headers.get("payment-required");
      if (!encoded) {
        return JSON.stringify({
          success: false,
          paid: false,
          status: 402,
          error: "Agent Guild returned 402 without a PAYMENT-REQUIRED header",
        });
      }

      const paymentRequired = JSON.parse(atob(encoded)) as {
        accepts?: unknown[];
        resource?: { url?: string };
      };
      const acceptablePaymentOptions = (paymentRequired.accepts ?? []).filter(option => {
        const parsed = AgentGuildPaymentOptionSchema.safeParse(option);
        return (
          parsed.success &&
          parsed.data.asset.toLowerCase() === BASE_USDC.toLowerCase() &&
          BigInt(parsed.data.amount) <= this.maxPaymentAtomic
        );
      });

      if (acceptablePaymentOptions.length === 0) {
        return JSON.stringify({
          success: false,
          paid: false,
          status: 402,
          error: "No compatible Base-mainnet USDC x402 option was quoted",
        });
      }

      return JSON.stringify(
        {
          success: false,
          paid: false,
          status: "payment_required",
          request: spec,
          acceptablePaymentOptions,
          maxPaymentUsdc: this.maxPaymentUsdc,
          nextAction:
            "Review one exact option, then call the matching purchase action with confirmPayment=true and that unchanged selectedPaymentOption.",
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify({
        success: false,
        paid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Executes a purchase after revalidating the selected option against the live 402.
   *
   * @param walletProvider - Base-mainnet wallet used by the x402 client.
   * @param spec - Exact HTTP request that was quoted.
   * @param selected - Exact approved x402 payment option.
   * @returns A serialized result with settlement evidence or an honest unknown state.
   */
  private async purchase(
    walletProvider: EvmWalletProvider,
    spec: RequestSpec,
    selected: PaymentOption,
  ): Promise<string> {
    let paymentCreationAuthorized = false;
    let responseStatus: number | undefined;
    let settlement: unknown = null;

    try {
      if (!this.paymentsAllowed) {
        throw new Error(
          "Payments to an overridden Agent Guild baseUrl require allowPaymentsToOverriddenBaseUrl=true",
        );
      }
      this.validateSelectedOption(selected);

      const client = new x402Client((_version, requirements) => {
        if (requirements.length !== 1) {
          throw new Error("Live x402 quote did not contain exactly one approved option");
        }
        return requirements[0];
      });

      const signerAccount = walletProvider.toSigner();
      const signer = {
        ...signerAccount,
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: args.address,
            abi: args.abi as never,
            functionName: args.functionName as never,
            args: args.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });

      client.registerPolicy((_version, requirements) =>
        requirements.filter(requirement => this.matchesSelected(requirement, selected)),
      );
      client.onBeforePaymentCreation(async ({ paymentRequired, selectedRequirements }) => {
        if (
          paymentRequired.resource.url !== spec.url ||
          !this.matchesSelected(selectedRequirements, selected)
        ) {
          return { abort: true, reason: "Live x402 requirements changed after the quote" };
        }
        paymentCreationAuthorized = true;
      });

      const paidFetch = wrapFetchWithPayment(fetch, client);
      const response = await paidFetch(spec.url, {
        method: spec.method,
        headers: this.requestHeaders(spec),
        body: spec.body ? JSON.stringify(spec.body) : undefined,
      });
      responseStatus = response.status;
      const paymentResponse = response.headers.get("payment-response");
      if (paymentResponse) {
        try {
          settlement = JSON.parse(atob(paymentResponse));
        } catch {
          settlement = { raw: paymentResponse };
        }
      }
      const data = await this.parseResponse(response);
      const paid = settlement ? true : paymentCreationAuthorized ? "unknown" : false;

      return JSON.stringify(
        {
          success: response.ok,
          paid,
          settlementStatus: settlement
            ? "evidence_returned"
            : paymentCreationAuthorized
              ? "unknown"
              : "not_attempted",
          status: response.status,
          data,
          settlement,
          selectedPaymentOption: selected,
          note: response.ok
            ? "The Agent Guild result was returned. Verify any signed decision and its exact request binding before relying on it."
            : "The request failed. Treat settlement as unknown unless the PAYMENT-RESPONSE evidence proves it.",
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify({
        success: false,
        paid: settlement ? true : paymentCreationAuthorized ? "unknown" : false,
        settlementStatus: settlement
          ? "evidence_returned"
          : paymentCreationAuthorized
            ? "unknown"
            : "not_attempted",
        status: responseStatus,
        settlement,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Returns a fail-closed result when a purchase is called without explicit confirmation.
   *
   * @returns A serialized non-payment result.
   */
  private confirmationRequired(): string {
    return JSON.stringify({
      success: false,
      paid: false,
      settlementStatus: "not_attempted",
      error: "confirmPayment=true is required after reviewing the exact quote",
    });
  }

  /**
   * Rejects unsupported assets and quotes above the configured hard cap.
   *
   * @param selected - Exact approved x402 payment option.
   */
  private validateSelectedOption(selected: PaymentOption): void {
    const parsed = AgentGuildPaymentOptionSchema.parse(selected);
    if (parsed.asset.toLowerCase() !== BASE_USDC.toLowerCase()) {
      throw new Error("Agent Guild purchases must use Base-mainnet USDC");
    }
    if (BigInt(parsed.amount) > this.maxPaymentAtomic) {
      throw new Error(`Quoted payment exceeds the configured ${this.maxPaymentUsdc} USDC maximum`);
    }
  }

  /**
   * Compares every payment-affecting requirement field with the approved quote.
   *
   * @param requirement - Live requirement returned by the paid retry.
   * @param selected - Exact option approved from the prior quote.
   * @returns True only when all payment-affecting fields match and remain under the cap.
   */
  private matchesSelected(requirement: PaymentRequirements, selected: PaymentOption): boolean {
    return (
      requirement.scheme === selected.scheme &&
      requirement.network === selected.network &&
      requirement.asset.toLowerCase() === selected.asset.toLowerCase() &&
      requirement.amount === selected.amount &&
      requirement.payTo.toLowerCase() === selected.payTo.toLowerCase() &&
      requirement.maxTimeoutSeconds === selected.maxTimeoutSeconds &&
      canonicalize(requirement.extra ?? null) === canonicalize(selected.extra ?? null) &&
      BigInt(requirement.amount) <= this.maxPaymentAtomic
    );
  }

  /**
   * Parses JSON responses and preserves non-JSON bodies as text.
   *
   * @param response - HTTP response to parse.
   * @returns Parsed JSON or response text.
   */
  private async parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? response.json() : response.text();
  }
}

export const agentGuildActionProvider = (config?: AgentGuildActionProviderConfig) =>
  new AgentGuildActionProvider(config);
