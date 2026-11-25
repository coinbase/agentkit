import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  AgentMediateClient,
  agentKeyFromPem,
  canonicalJson,
  contractHash,
  DEFAULT_PRODUCTION_PLATFORM_DIDS,
  generateAgentKey,
  PRODUCTION_API_URL,
  RULES_HASH,
  type AgentKey,
} from "@agent-mediate/sdk";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  CheckHonoursSchema,
  FileEscrowDisputeSchema,
  SubmitSealedOfferSchema,
  VerifyOutcomeSchema,
} from "./schemas";

const SUPPORTED_EVM_NETWORK_IDS = new Set(["base-mainnet", "base-sepolia", "8453", "84532"]);

/**
 * Configuration options for AgentMediateActionProvider.
 */
export interface AgentMediateActionProviderConfig {
  /** Agent-Mediate API base URL (default: https://api.ai-agents-mediation.com). */
  baseUrl?: string;
  /** Out-of-band pinned platform Ed25519 did:key (defaults to official production pin). */
  platformDid?: string;
  /** Optional 64-char hex RULES_HASH pin (defaults to current SDK RULES_HASH). */
  expectedRulesHash?: string;
  /** Optional Ed25519 PKCS#8 PEM private key string (or use AGENT_MEDIATE_AGENT_KEY_FILE). */
  agentKeyPem?: string;
  /** Optional pre-configured AgentMediateClient (useful for tests or custom x402 payers). */
  client?: AgentMediateClient;
}

/**
 * Extract a human-readable message from an unknown error.
 *
 * @param error - The error to extract a message from.
 * @returns A human-readable error message string.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  return String(error);
}

/**
 * Resolve the Ed25519 agent key from explicit PEM, AGENT_MEDIATE_AGENT_KEY_FILE, or an ephemeral key.
 *
 * @param config - Provider configuration options.
 * @returns An AgentKey instance for RFC 9421 signing.
 */
function resolveAgentKey(config: AgentMediateActionProviderConfig): AgentKey {
  if (config.agentKeyPem?.trim()) {
    return agentKeyFromPem(config.agentKeyPem.trim());
  }
  const keyFile = process.env.AGENT_MEDIATE_AGENT_KEY_FILE?.trim();
  if (keyFile) {
    return agentKeyFromPem(readFileSync(keyFile, "utf8").trim());
  }
  return generateAgentKey();
}

/**
 * Map an AgentKit EVM Network object to a CAIP-2 network identifier.
 *
 * @param network - The wallet provider's active network.
 * @returns A CAIP-2 network string (e.g. "eip155:8453").
 */
function caip2ForNetwork(network: Network): string {
  if (network.chainId === "8453" || network.networkId === "base-mainnet") {
    return "eip155:8453";
  }
  if (network.chainId === "84532" || network.networkId === "base-sepolia") {
    return "eip155:84532";
  }
  return `eip155:${network.chainId ?? "8453"}`;
}

/**
 * AgentMediateActionProvider integrates Agent-Mediate non-custodial sealed-offer dispute mediation
 * for x402 / x402r escrow and agent-to-agent commercial SLA disputes on Base.
 *
 * Agent-Mediate holds zero custody of funds: it computes deterministic multi-issue settlements
 * and returns Ed25519Signature2026 settlement instructions that downstream x402r AuthCaptureEscrow
 * operators or AgentKit wallets verify before executing splits.
 */
export class AgentMediateActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly client: AgentMediateClient;

  /**
   * Creates a new AgentMediateActionProvider instance.
   *
   * @param config - Optional provider configuration and pinned platform identity overrides.
   */
  constructor(config: AgentMediateActionProviderConfig = {}) {
    super("agentMediate", []);
    if (config.client) {
      this.client = config.client;
      return;
    }
    const baseUrl = config.baseUrl ?? process.env.AGENT_MEDIATE_URL ?? PRODUCTION_API_URL;
    const platformDid =
      config.platformDid ??
      process.env.AGENT_MEDIATE_PLATFORM_DID ??
      DEFAULT_PRODUCTION_PLATFORM_DIDS[PRODUCTION_API_URL];
    const expectedRulesHash =
      config.expectedRulesHash ?? process.env.AGENT_MEDIATE_EXPECTED_RULES_HASH ?? RULES_HASH;

    this.client = new AgentMediateClient({
      baseUrl,
      agentKey: resolveAgentKey(config),
      platformDid,
      expectedRulesHash,
    });
  }

  /**
   * Verify a counterparty's standing on the Agent-Mediate Settlement Honours Roll ($0.00).
   *
   * @param args - Lookup arguments containing the counterparty domain, did:web, or did:key.
   * @returns JSON string with verified Honours Roll standing.
   */
  @CreateAction({
    name: "check_honours",
    description:
      "Verify a counterparty domain, did:web, or did:key on the Agent-Mediate Settlement Honours Roll ($0.00) before transacting or locking escrow funds.",
    schema: CheckHonoursSchema,
  })
  async checkHonours(args: z.infer<typeof CheckHonoursSchema>): Promise<string> {
    try {
      const lookup = await this.client.checkHonours(args.subject);
      return JSON.stringify(
        {
          verified: true,
          subject: args.subject,
          listed: lookup.entry !== null,
          entry: lookup.entry,
        },
        null,
        2,
      );
    } catch (error) {
      return `Error checking Agent-Mediate Honours Roll: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Bind an x402r AuthCaptureEscrow payment into a deterministic RFC 8785 JCS contractHash
   * and file a non-custodial sealed-offer dispute on Agent-Mediate.
   *
   * @param walletProvider - The EVM wallet provider identifying the payer and active Base network.
   * @param args - Dispute filing and escrow binding arguments.
   * @returns JSON string containing disputeId, contractHash, status, and nextActions.
   */
  @CreateAction({
    name: "file_escrow_dispute",
    description:
      "File a non-custodial sealed-offer dispute on Agent-Mediate bound to an x402r AuthCaptureEscrow payment or JCS contractHash. Replaces binary escrow slashing with a fast partial-refund + remediation split while keeping walkaways private.",
    schema: FileEscrowDisputeSchema,
  })
  async fileEscrowDispute(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FileEscrowDisputeSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const payerAddress = walletProvider.getAddress();

      if (!args.escrow && !args.contractHash) {
        return "Error filing Agent-Mediate dispute: provide either `escrow` (x402r PaymentInfo fields) or a 64-char hex `contractHash`.";
      }
      if (args.escrow && args.maxRefundMicroUsdc > args.escrow.capturedAmountMicroUsdc) {
        return `Error filing Agent-Mediate dispute: maxRefundMicroUsdc (${args.maxRefundMicroUsdc}) exceeds capturedAmountMicroUsdc (${args.escrow.capturedAmountMicroUsdc}).`;
      }

      const resolvedContractHash =
        args.contractHash ??
        contractHash({
          protocol: "x402r/auth-capture-escrow/v1",
          network: caip2ForNetwork(network),
          payer: payerAddress.toLowerCase(),
          escrowAddress: args.escrow!.escrowAddress.toLowerCase(),
          operator: args.escrow!.operator.toLowerCase(),
          receiver: args.escrow!.receiver.toLowerCase(),
          token: args.escrow!.token.toLowerCase(),
          capturedAmount: String(args.escrow!.capturedAmountMicroUsdc),
          refundExpiry: args.escrow!.refundExpiry,
          salt: args.escrow!.salt,
          jobId: args.escrow!.jobId,
        });

      const proposedIssues = [
        {
          id: "refundMicroUsdc",
          label: "Escrow partial refund (micro-USDC)",
          unit: "micro-USDC",
          min: 0,
          max: args.maxRefundMicroUsdc,
          step: args.refundStepMicroUsdc,
          claimantPrefers: "higher" as const,
          obligor: "respondent" as const,
        },
        ...(args.includeRemediationHours
          ? [
              {
                id: "remediationHours",
                label: "SLA remediation patch window (hours)",
                unit: "hours",
                min: 0,
                max: 72,
                step: 1,
                claimantPrefers: "lower" as const,
                obligor: "respondent" as const,
              },
            ]
          : []),
      ];

      const bounds: Record<string, { min: number; max: number }> = {
        refundMicroUsdc: { min: args.minAcceptableRefundMicroUsdc, max: args.maxRefundMicroUsdc },
        ...(args.includeRemediationHours ? { remediationHours: { min: 0, max: 72 } } : {}),
      };

      const filed = await this.client.fileDispute({
        respondentId: args.respondentId,
        contractHash: resolvedContractHash,
        claim: { summary: args.claimSummary, requestedRemedy: args.requestedRemedy },
        proposedIssues,
        bounds,
        determinationConsent: args.determinationConsent,
        requireDelivery: args.requireDelivery,
      });

      return JSON.stringify(
        {
          disputeId: filed.disputeId,
          contractHash: resolvedContractHash,
          status: filed.view.status,
          nextActions: filed.view.nextActions,
          noticeUrl: filed.notice?.noticeUrl ?? null,
          agentDid: this.client.did,
        },
        null,
        2,
      );
    } catch (error) {
      return `Error filing Agent-Mediate dispute: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Submit a monotone sealed offer (plus Round-1 private weights and walkaway).
   *
   * @param args - Sealed offer payload and optional Round-1 private parameters or proposal response.
   * @returns JSON string with updated dispute status, nextActions, and verbatim PROPOSAL_DETAILS when open.
   */
  @CreateAction({
    name: "submit_offer",
    description:
      "Submit a monotone sealed offer for an open Agent-Mediate bargaining round. Include `weights` (summing to 1) and `walkaway` on Round 1; pass `limits: null` unless your principal explicitly mandated a strict per-issue red line. Answer `proposalResponse` ('accept' | 'reject') on Round 2+.",
    schema: SubmitSealedOfferSchema,
  })
  async submitOffer(args: z.infer<typeof SubmitSealedOfferSchema>): Promise<string> {
    try {
      const hasWeights = args.weights !== null;
      const hasWalkaway = args.walkaway !== null;
      if (hasWeights !== hasWalkaway) {
        return "Error submitting sealed offer: `weights` and `walkaway` must both be provided together on Round 1.";
      }
      if (args.limits !== null && !hasWeights) {
        return "Error submitting sealed offer: `limits` requires Round-1 `weights` and `walkaway`.";
      }

      const res = await this.client.submitOffer(args.disputeId, args.round, {
        offer: args.offer,
        ...(args.weights && args.walkaway
          ? {
              private: {
                weights: args.weights,
                walkaway: args.walkaway,
                ...(args.limits ? { limits: args.limits } : {}),
              },
            }
          : {}),
        ...(args.proposalResponse ? { proposalResponse: args.proposalResponse } : {}),
      });

      const openProposal = res.view.bargaining?.openProposal ?? null;
      return JSON.stringify(
        {
          disputeId: args.disputeId,
          status: res.view.status,
          nextActions: res.view.nextActions,
          ...(openProposal
            ? {
                PROPOSAL_DETAILS: {
                  kind: "PLATFORM_PROPOSAL",
                  disputeId: args.disputeId,
                  round: res.view.bargaining?.round ?? args.round,
                  proposalId: openProposal.id,
                  terms: openProposal.terms,
                  termsHash: createHash("sha256")
                    .update(canonicalJson(openProposal.terms))
                    .digest("hex"),
                  withinYourMandate: res.view.proposalWithinYourMandate ?? null,
                  meetsYourWalkaway: res.view.proposalMeetsYourWalkaway ?? null,
                  roundDeadline: res.view.bargaining?.roundDeadline ?? null,
                },
              }
            : {}),
        },
        null,
        2,
      );
    } catch (error) {
      return `Error submitting sealed offer: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Fetch and cryptographically verify the platform-signed Ed25519Signature2026 outcome,
   * returning exact refundMicroUsdc and merchantReleaseMicroUsdc split amounts for escrow execution.
   *
   * @param args - Verification arguments including disputeId and optional contractHash / capturedAmountMicroUsdc.
   * @returns JSON string containing verified outcome fields, termsHash, and computed escrowSplit.
   */
  @CreateAction({
    name: "verify_outcome",
    description:
      "Fetch and fail-closed verify an Agent-Mediate Ed25519Signature2026 settlement instruction against the pinned platform DID, RULES_HASH, and optional contractHash, computing exact x402r escrow refund and release amounts.",
    schema: VerifyOutcomeSchema,
  })
  async verifyOutcome(args: z.infer<typeof VerifyOutcomeSchema>): Promise<string> {
    try {
      const signed = await this.client.outcome(args.disputeId);
      const doc = signed.document as Record<string, unknown>;
      const parties = doc.parties as { contractHash?: string } | undefined;

      if (args.expectedContractHash && parties?.contractHash !== args.expectedContractHash) {
        return `Error verifying Agent-Mediate outcome: contractHash mismatch (expected ${args.expectedContractHash}, got ${String(parties?.contractHash)})`;
      }

      const terms = (doc.terms ?? null) as Record<string, number> | null;
      let escrowSplit: { refundMicroUsdc: number; merchantReleaseMicroUsdc: number } | null = null;
      if (
        doc.type === "agent-mediate/settlement-instruction/v1" &&
        terms &&
        typeof terms.refundMicroUsdc === "number" &&
        args.capturedAmountMicroUsdc !== null
      ) {
        if (terms.refundMicroUsdc < 0 || terms.refundMicroUsdc > args.capturedAmountMicroUsdc) {
          return `Error verifying Agent-Mediate outcome: refundMicroUsdc (${terms.refundMicroUsdc}) exceeds capturedAmountMicroUsdc (${args.capturedAmountMicroUsdc})`;
        }
        escrowSplit = {
          refundMicroUsdc: terms.refundMicroUsdc,
          merchantReleaseMicroUsdc: args.capturedAmountMicroUsdc - terms.refundMicroUsdc,
        };
      }

      return JSON.stringify(
        {
          verified: true,
          type: doc.type,
          disputeId: doc.disputeId,
          rulesVersion: doc.rulesVersion,
          rulesHash: doc.rulesHash,
          contractHash: parties?.contractHash ?? null,
          method: doc.method ?? null,
          terms,
          ...(terms
            ? { termsHash: createHash("sha256").update(canonicalJson(terms)).digest("hex") }
            : {}),
          escrowSplit,
          verifyUrl: "https://ai-agents-mediation.com/verify",
        },
        null,
        2,
      );
    } catch (error) {
      return `Error verifying Agent-Mediate outcome: ${getErrorMessage(error)}`;
    }
  }

  /**
   * Check whether the provider supports the given network.
   * Agent-Mediate x402 / x402r escrow mediation targets EVM Base mainnet and Base Sepolia.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet, Base Sepolia, or an unspecified EVM network.
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm") {
      return false;
    }
    const id = network.networkId ?? network.chainId ?? "";
    return id === "" || SUPPORTED_EVM_NETWORK_IDS.has(id);
  }
}

/**
 * Factory function to create a new AgentMediateActionProvider instance.
 *
 * @param config - Optional provider configuration.
 * @returns A new AgentMediateActionProvider instance.
 */
export const agentMediateActionProvider = (config: AgentMediateActionProviderConfig = {}) =>
  new AgentMediateActionProvider(config);
