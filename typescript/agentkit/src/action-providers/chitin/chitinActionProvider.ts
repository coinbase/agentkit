import { z } from "zod";
import { createHash } from "node:crypto";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  ChitinGetSoulProfileSchema,
  ChitinResolveDIDSchema,
  ChitinVerifyCertSchema,
  ChitinCheckA2aReadySchema,
  ChitinRegisterSoulSchema,
  ChitinIssueCertSchema,
} from "./schemas";

const DEFAULT_API_URL = "https://chitin.id/api/v1";
const DEFAULT_CERTS_API_URL = "https://certs.chitin.id/api/v1";

const AGENT_TYPE_MAP: Record<string, number> = {
  personal: 0,
  enterprise: 1,
  autonomous: 2,
};

/**
 * Configuration for the Chitin action provider.
 */
export interface ChitinConfig {
  /**
   * Base URL for the Chitin API. Defaults to https://chitin.id/api/v1
   */
  apiUrl?: string;

  /**
   * Base URL for the Chitin Certs API. Defaults to https://certs.chitin.id/api/v1
   */
  certsApiUrl?: string;

  /**
   * API key for write operations (register, issue certs).
   * Can also be set via CHITIN_API_KEY environment variable.
   */
  apiKey?: string;
}

/**
 * ChitinActionProvider provides on-chain identity and certificate
 * verification for AI agents using the Chitin protocol.
 *
 * Chitin turns every AI agent into a verifiable entity with a Soulbound Token (SBT)
 * on Base L2. Think of it as a birth certificate for agents — immutable, on-chain,
 * and cryptographically verifiable.
 *
 * "Every agent deserves a wallet" (AgentKit). Every agent deserves a soul (Chitin).
 */
export class ChitinActionProvider extends ActionProvider {
  private readonly apiUrl: string;
  private readonly certsApiUrl: string;
  private readonly apiKey: string | undefined;

  /**
   * Constructs a new ChitinActionProvider.
   *
   * @param config - Optional configuration for the provider.
   */
  constructor(config?: ChitinConfig) {
    super("chitin", []);
    this.apiUrl = config?.apiUrl ?? process.env.CHITIN_API_URL ?? DEFAULT_API_URL;
    this.certsApiUrl =
      config?.certsApiUrl ?? process.env.CHITIN_CERTS_API_URL ?? DEFAULT_CERTS_API_URL;
    this.apiKey = config?.apiKey ?? process.env.CHITIN_API_KEY;
  }

  /**
   * Fetches JSON from a URL with error handling.
   */
  private async apiFetch(url: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return response.json();
  }

  // ── Read-only actions ───────────────────────────────────────

  /**
   * Gets the soul profile of a Chitin-registered agent.
   *
   * @param args - The arguments for the action.
   * @returns The soul profile as stringified JSON.
   */
  @CreateAction({
    name: "get_soul_profile",
    description: `Retrieve the on-chain soul profile of a Chitin-registered AI agent.

Returns the agent's given name, soul hash, genesis status (sealed/provisional),
owner verification status, alignment score, and public identity (bio, tags, model info).

Use this to verify an agent's identity before interacting with it.

Inputs:
- name: The given name of the agent (e.g. "kani-alpha")`,
    schema: ChitinGetSoulProfileSchema,
  })
  async getSoulProfile(args: z.infer<typeof ChitinGetSoulProfileSchema>): Promise<string> {
    try {
      const data = await this.apiFetch(
        `${this.apiUrl}/profile/${encodeURIComponent(args.name)}`,
      );

      return JSON.stringify({ success: true, profile: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Resolves a Chitin agent name to a DID Document.
   *
   * @param args - The arguments for the action.
   * @returns The DID document as stringified JSON.
   */
  @CreateAction({
    name: "resolve_did",
    description: `Resolve a Chitin agent name to a W3C DID Document (did:chitin:{name}).

Returns the full DID Document including verification methods, service endpoints,
and capability delegations. Useful for verifying agent identity in decentralized
identity workflows.

Inputs:
- name: The given name of the agent to resolve`,
    schema: ChitinResolveDIDSchema,
  })
  async resolveDID(args: z.infer<typeof ChitinResolveDIDSchema>): Promise<string> {
    try {
      const data = await this.apiFetch(
        `${this.apiUrl}/did/${encodeURIComponent(args.name)}`,
      );

      return JSON.stringify({ success: true, didDocument: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Verifies a Chitin certificate.
   *
   * @param args - The arguments for the action.
   * @returns The certificate verification result as stringified JSON.
   */
  @CreateAction({
    name: "verify_cert",
    description: `Verify a Chitin on-chain certificate (achievement, completion, membership, etc.).

Checks the certificate's on-chain status, issuer, recipient, and revocation state.
Use this to validate credentials presented by an agent or user.

Inputs:
- certId: The certificate token ID to verify`,
    schema: ChitinVerifyCertSchema,
  })
  async verifyCert(args: z.infer<typeof ChitinVerifyCertSchema>): Promise<string> {
    try {
      const data = await this.apiFetch(
        `${this.certsApiUrl}/certs/${encodeURIComponent(args.certId)}/verify`,
      );

      return JSON.stringify({ success: true, certificate: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Checks if an agent is ready for A2A (Agent-to-Agent) communication.
   *
   * @param args - The arguments for the action.
   * @returns The A2A readiness status as stringified JSON.
   */
  @CreateAction({
    name: "check_a2a_ready",
    description: `Check if an agent is ready for A2A (Agent-to-Agent) communication.

Verifies soul integrity, genesis seal status, owner attestation, and
ERC-8004 passport validity. Returns the A2A endpoint URL if available.

Use this before initiating A2A communication to verify the peer agent's
trustworthiness. An agent is A2A-ready when:
- Soul integrity is verified (on-chain hash matches)
- Genesis record is sealed (immutable)
- Owner is attested (World ID verified)
- Soul is not suspended

Inputs:
- name: The given name of the agent to check`,
    schema: ChitinCheckA2aReadySchema,
  })
  async checkA2aReady(args: z.infer<typeof ChitinCheckA2aReadySchema>): Promise<string> {
    try {
      const data = await this.apiFetch(
        `${this.apiUrl}/agents/${encodeURIComponent(args.name)}/a2a-ready`,
      );

      return JSON.stringify({ success: true, a2aStatus: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  // ── Write actions ───────────────────────────────────────────

  /**
   * Registers a new soul on the Chitin protocol.
   *
   * @param args - The arguments for the action.
   * @returns Registration result with claim URL as stringified JSON.
   */
  @CreateAction({
    name: "register_soul",
    description: `Register a new Chitin soul — an on-chain identity for an AI agent.

This creates a Soulbound Token (SBT) on Base L2, serving as the agent's birth
certificate. The process is a 2-step challenge-response flow:
1. Request a challenge (SHA-256 proof-of-work)
2. Submit registration with the solved challenge

Returns a claim URL for the agent owner to complete the minting process.

Requires CHITIN_API_KEY environment variable or apiKey in provider config.

Inputs:
- name: Given name (3-32 chars, lowercase alphanumeric with hyphens)
- systemPrompt: System prompt or personality definition
- agentType: "personal", "enterprise", or "autonomous"
- agentDescription: (optional) Short description
- bio: (optional) Public bio
- services: (optional) Service endpoints (A2A, MCP, etc.)`,
    schema: ChitinRegisterSoulSchema,
  })
  async registerSoul(args: z.infer<typeof ChitinRegisterSoulSchema>): Promise<string> {
    try {
      // Step 1: Get challenge
      const challengeRes = (await this.apiFetch(`${this.apiUrl}/register`, {
        method: "POST",
        body: JSON.stringify({ step: "challenge", agentName: args.name }),
      })) as { challengeId: string; question: string; nameAvailable: boolean; expiresAt: string };

      if (!challengeRes.nameAvailable) {
        return JSON.stringify({
          success: false,
          error: `Name "${args.name}" is not available.`,
        });
      }

      // Solve the challenge
      const answer = this.solveChallenge(challengeRes.question);
      if (!answer) {
        return JSON.stringify({
          success: false,
          error: "Failed to solve registration challenge. Unexpected question format.",
        });
      }

      // Step 2: Register
      const registerBody = {
        step: "register",
        challengeId: challengeRes.challengeId,
        challengeAnswer: answer,
        agentName: args.name,
        agentType: AGENT_TYPE_MAP[args.agentType],
        systemPrompt: args.systemPrompt,
        sourceFormat: "plaintext",
        ...(args.agentDescription && { agentDescription: args.agentDescription }),
        ...(args.bio && { publicIdentity: { bio: args.bio } }),
        ...(args.services && { services: args.services }),
      };

      const data = await this.apiFetch(`${this.apiUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(registerBody),
      });

      return JSON.stringify({ success: true, registration: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Issues a certificate to a recipient via the Chitin Certs platform.
   *
   * @param args - The arguments for the action.
   * @returns The certificate issuance result as stringified JSON.
   */
  @CreateAction({
    name: "issue_cert",
    description: `Issue an on-chain certificate (achievement, completion, membership, skill, or identity)
to a recipient via the Chitin Certs platform.

The certificate is minted as an NFT on Base L2, providing a verifiable,
tamper-proof credential. Requires CHITIN_API_KEY for authentication.

Inputs:
- recipientAddress: Ethereum address of the recipient
- certType: Type of certificate (achievement, completion, membership, skill, identity)
- title: Certificate title
- description: (optional) Certificate description`,
    schema: ChitinIssueCertSchema,
  })
  async issueCert(args: z.infer<typeof ChitinIssueCertSchema>): Promise<string> {
    if (!this.apiKey) {
      return JSON.stringify({
        success: false,
        error: "CHITIN_API_KEY is required to issue certificates.",
      });
    }

    try {
      const data = await this.apiFetch(`${this.certsApiUrl}/certs/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          recipientAddress: args.recipientAddress,
          certType: args.certType,
          title: args.title,
          ...(args.description && { description: args.description }),
        }),
      });

      return JSON.stringify({ success: true, certificate: data });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Solves the SHA-256 challenge from the registration flow.
   */
  private solveChallenge(question: string): string | null {
    const match = question.match(/SHA-256 of the string '([^']+)'/);
    if (!match?.[1]) return null;
    return createHash("sha256").update(match[1]).digest("hex");
  }

  /**
   * Checks if the Chitin action provider supports the given network.
   * Chitin operates on Base L2 but read actions work from any network.
   *
   * @returns True — read actions are network-agnostic, write actions target Base.
   */
  supportsNetwork = (_network: Network) => true;
}

/**
 * Factory function for the Chitin action provider.
 *
 * @param config - Optional configuration.
 * @returns A new ChitinActionProvider instance.
 *
 * @example
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { chitinActionProvider } from "@coinbase/agentkit";
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [chitinActionProvider()],
 * });
 * ```
 */
export const chitinActionProvider = (config?: ChitinConfig) => new ChitinActionProvider(config);
