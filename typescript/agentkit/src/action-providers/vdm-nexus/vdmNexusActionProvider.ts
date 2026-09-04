import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { SvmWalletProvider } from "../../wallet-providers";
import { x402Client } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { toClientSvmSigner } from "@x402/svm";
import {
  verifyReceipt,
  type NexusReceipt,
  type ChatMessage,
  type OpenAIChatCompletion,
  type PaymentPayload,
  type PaymentRequired,
  type X402PaymentResponse,
} from "@vdm-nexus/x402";
import { NexusChatSchema, NexusVerifyReceiptSchema, NexusGetDepositAddressSchema } from "./schemas";

const DEFAULT_ENDPOINT = "https://nexus.vdmnexus.com/api/v1";

const PAYMENT_HEADER = "x-payment";
const PAYMENT_REQUIRED_HEADER = "x-payment-required";
const PAYMENT_RESPONSE_HEADER = "x-payment-response";
const RECEIPT_HEADER = "x-nexus-receipt";

/**
 * Configuration options for the VDM Nexus action provider.
 */
export interface VdmNexusActionProviderConfig {
  /**
   * Base URL of the Nexus deployment to target, including the version
   * prefix. Defaults to the public production endpoint.
   *
   * @default "https://nexus.vdmnexus.com/api/v1"
   */
  endpoint?: string;

  /**
   * Optional base58 Ed25519 operator public key to pin for offline receipt
   * verification. When omitted, the verifier fetches it from
   * `${endpoint}/operator-key` on first use. Pinning is recommended for
   * production audit pipelines so a compromised endpoint cannot serve a
   * forged operator key.
   */
  operatorKey?: string;
}

/**
 * Decode a base64-encoded JSON header value into a typed object.
 *
 * @param value - The raw header string, or null if absent.
 * @returns The parsed object, or null if the header was absent or unparseable.
 */
function decodeHeader<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Encode an arbitrary object as a base64-encoded JSON header value.
 *
 * @param obj - The object to serialize.
 * @returns The base64-encoded JSON string suitable for an HTTP header.
 */
function encodeHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

/**
 * VdmNexusActionProvider — pay-per-call signed inference with verifiable
 * cryptographic receipts.
 *
 * VDM Nexus is an x402-gated inference rail: every paid `/chat/completions`
 * call settles a USDC payment inline and returns the OpenAI response plus
 * an Ed25519-signed receipt (SIR v2) anchored to the on-chain settlement
 * transaction. Receipts are independently verifiable — third parties can
 * confirm what the model returned without trusting the caller or the
 * service operator.
 *
 * Three actions are exposed:
 * - `nexus_chat` — paid inference, returns OpenAI response + receipt
 * - `nexus_verify_receipt` — five-check SIR v2 verification
 * - `nexus_get_deposit_address` — destination for off-band USDC top-ups
 *
 * The AgentKit-managed wallet IS the agent identity: its keypair signs
 * the SPL USDC transfer carried in the x402 `X-Payment` header. No
 * separate agent secret env var is required.
 *
 * Spec: https://docs.vdmnexus.com/docs/spec/sir-v2
 */
export class VdmNexusActionProvider extends ActionProvider<SvmWalletProvider> {
  private readonly endpoint: string;
  private readonly operatorKey: string | undefined;

  /**
   * Constructor for the VdmNexusActionProvider.
   *
   * @param config - Optional endpoint + operator-key overrides.
   */
  constructor(config?: VdmNexusActionProviderConfig) {
    super("vdm_nexus", []);
    this.endpoint = (config?.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
    this.operatorKey = config?.operatorKey;
  }

  /**
   * Run a paid inference call against VDM Nexus.
   *
   * Performs the standard x402 two-roundtrip handshake — an initial unpaid
   * POST returns a 402 with the payment challenge, the AgentKit-managed
   * wallet signs the SPL USDC transfer, and the paid retry returns the
   * OpenAI chat completion plus a signed receipt.
   *
   * @param walletProvider - The Solana wallet the agent runs on. Its
   *   keypair signs the payment.
   * @param args - Validated `NexusChatSchema` arguments.
   * @returns Stringified JSON `{ ok, openai, receipt, payment }` on
   *   success; `{ ok: false, error, … }` on failure.
   */
  @CreateAction({
    name: "nexus_chat",
    description: `
Run a paid inference call against VDM Nexus, the signed-inference rail.
Settles a USDC payment inline via x402 from the agent's wallet, runs the
inference upstream, and returns the OpenAI chat completion alongside a
Signed Inference Receipt (SIR v2) anchored to the on-chain settlement
transaction.

Inputs:
- model: OpenRouter-style model slug (e.g. "openai/gpt-4o-mini",
  "anthropic/claude-3-haiku").
- messages: OpenAI-shape chat messages array.
- network (optional): Override the settlement chain. Must be a network the
  agent's wallet can sign for. For a Solana wallet, valid values are
  "solana:mainnet" and "solana:devnet". Omit to use the server default.

The wallet attached to AgentKit IS the agent identity. No separate
agent secret is required. Cost is reported per call by the upstream
provider and passed through 1:1; expect ~$0.01-$0.05 per call depending
on the model and prompt size.
`,
    schema: NexusChatSchema,
  })
  async nexusChat(
    walletProvider: SvmWalletProvider,
    args: z.infer<typeof NexusChatSchema>,
  ): Promise<string> {
    const url = `${this.endpoint}/chat/completions`;
    const requestBody = JSON.stringify({
      model: args.model,
      messages: args.messages,
      ...(args.network ? { network: args.network } : {}),
    });

    // 1. Probe — unpaid POST returns 402 with the x402 challenge.
    const probe = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (probe.status !== 402) {
      const text = await probe.text();
      return JSON.stringify({
        ok: false,
        error: "x402_probe_failed",
        detail: `expected 402, got ${probe.status}: ${text.slice(0, 200)}`,
      });
    }

    const challenge = decodeHeader<PaymentRequired>(probe.headers.get(PAYMENT_REQUIRED_HEADER));
    if (!challenge) {
      return JSON.stringify({
        ok: false,
        error: "x402_missing_challenge",
        detail: "402 response had no X-Payment-Required header carrying the payment options",
      });
    }

    // 2. Sign the payment with the AgentKit-managed wallet.
    const kitSigner = await walletProvider.getKeyPairSigner();
    const signer = toClientSvmSigner(kitSigner);
    const client = new x402Client();
    client.register("solana:*", new ExactSvmScheme(signer, {}));
    const payment: PaymentPayload = await client.createPaymentPayload(challenge);

    // 3. Paid retry — facilitator settles inline, route runs inference,
    //    response carries the signed receipt.
    const paid = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PAYMENT_HEADER]: encodeHeader(payment),
      },
      body: requestBody,
    });

    if (paid.status === 409) {
      return JSON.stringify({
        ok: false,
        error: "x402_payment_replay",
        detail:
          "this tx_signature was already credited — re-issue the request to obtain a fresh challenge",
      });
    }
    if (!paid.ok) {
      const errBody = (await paid.json().catch(() => ({}))) as { detail?: string };
      return JSON.stringify({
        ok: false,
        error: "x402_upstream_error",
        status: paid.status,
        detail: errBody.detail ?? `HTTP ${paid.status}`,
      });
    }

    const openai = (await paid.json()) as OpenAIChatCompletion;
    const receipt = decodeHeader<NexusReceipt>(paid.headers.get(RECEIPT_HEADER));
    const settlement = decodeHeader<X402PaymentResponse>(paid.headers.get(PAYMENT_RESPONSE_HEADER));

    return JSON.stringify({
      ok: true,
      openai,
      receipt,
      payment: settlement,
    });
  }

  /**
   * Verify a Signed Inference Receipt end-to-end.
   *
   * Delegates to `verifyReceipt` from `@vdm-nexus/x402`, which runs five
   * checks: prompt hash recompute, response hash recompute, operator
   * Ed25519 signature, on-chain settlement transaction lookup, and payer
   * identity match. Returns the full breakdown so the agent can decide
   * what to do on partial failure.
   *
   * @param args - Validated `NexusVerifyReceiptSchema` arguments.
   * @returns Stringified JSON `{ ok, checks: { … } }` or
   *   `{ ok: false, error, … }` on failure.
   */
  @CreateAction({
    name: "nexus_verify_receipt",
    description: `
Verify a VDM Nexus Signed Inference Receipt (SIR v2) end-to-end. Runs five
independent checks against the receipt, the original prompt/response, and
the on-chain settlement record:
- prompt_hash_ok: sha256 of the prompt matches receipt.prompt_hash
- response_hash_ok: sha256 of the response matches receipt.response_hash
- nexus_signature_ok: operator Ed25519 signature is valid
- payment_on_chain_ok: settlement tx landed at the recipient
- payer_matches: tx payer equals receipt.agent_pubkey

Pass the receipt as it was returned by nexus_chat (the receipt field),
the prompt as the messages array you sent, and the response as the
OpenAI response body. Returns the full check breakdown so the agent can
act on partial failures (e.g. ignore vacuous payment checks on prepaid
receipts).

Spec: https://docs.vdmnexus.com/docs/spec/sir-v2
`,
    schema: NexusVerifyReceiptSchema,
  })
  async nexusVerifyReceipt(args: z.infer<typeof NexusVerifyReceiptSchema>): Promise<string> {
    try {
      const result = await verifyReceipt({
        receipt: args.receipt as NexusReceipt,
        prompt: args.prompt as ChatMessage[] | string,
        response: args.response as OpenAIChatCompletion | string,
        endpoint: args.endpoint ?? this.endpoint,
        operatorKey: args.operatorKey ?? this.operatorKey,
        rpc: args.rpc,
      });
      return JSON.stringify({ ok: result.ok, checks: result.checks });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: "verify_failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetch the on-chain USDC deposit address for prepaid credit top-ups.
   *
   * Per-call x402 settlement via `nexus_chat` does NOT require this — it
   * settles inline. Use this when batching deposits across many calls is
   * cheaper than per-call settlement.
   *
   * @param args - Validated `NexusGetDepositAddressSchema` arguments.
   * @returns Stringified JSON `{ ok, address, mint, network }` on success;
   *   `{ ok: false, error, … }` on failure.
   */
  @CreateAction({
    name: "nexus_get_deposit_address",
    description: `
Fetch the on-chain USDC deposit address for topping up an agent's prepaid
credit balance on a VDM Nexus deployment.

Per-call x402 settlement (nexus_chat) settles inline and does NOT require
a deposit; this action is for agents that prefer to batch many calls
against a prepaid balance to amortize RPC + facilitator overhead.

Returns the address, the USDC mint, and the network the address lives on.
`,
    schema: NexusGetDepositAddressSchema,
  })
  async nexusGetDepositAddress(
    args: z.infer<typeof NexusGetDepositAddressSchema>,
  ): Promise<string> {
    const qs = args.network ? `?network=${encodeURIComponent(args.network)}` : "";
    const url = `${this.endpoint}/deposit-address${qs}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        return JSON.stringify({
          ok: false,
          error: "deposit_address_fetch_failed",
          status: r.status,
        });
      }
      const body = (await r.json()) as {
        address: string;
        mint: string;
        network: string;
      };
      return JSON.stringify({
        ok: true,
        address: body.address,
        mint: body.mint,
        network: body.network,
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: "deposit_address_fetch_failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks if the provider supports the given network. VDM Nexus settles
   * USDC payments on Solana via SPL transfer; the wallet must be an SVM
   * wallet. Base / EVM settlement is on the roadmap as a sibling provider
   * bound to `EvmWalletProvider`.
   *
   * @param network - The network descriptor from the wallet provider.
   * @returns True iff the network's protocol family is `"svm"`.
   */
  supportsNetwork = (network: Network): boolean => network.protocolFamily === "svm";
}

/**
 * Factory function for the VDM Nexus action provider.
 *
 * @param config - Optional endpoint + operator-key overrides.
 * @returns A fresh `VdmNexusActionProvider` instance.
 */
export const vdmNexusActionProvider = (
  config?: VdmNexusActionProviderConfig,
): VdmNexusActionProvider => new VdmNexusActionProvider(config);
