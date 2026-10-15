import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { VerifyPatchSchema } from "./schemas";
import { authenticateDelivery } from "./receiptVerification";

export const BASE_USDC_MAINNET_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;
export const GLEE_PRICE_ATOMIC = "50000";

/** Operator-approved trust anchors, never taken from an HTTP response. */
export interface GleeVerifierConfig {
  endpoint?: string;
  trustedPayTo?: string;
  trustedReceiptPublicKeyHex?: string;
}

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const ChallengeSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({ url: z.string() }),
  accepts: z.tuple([
    z
      .object({
        scheme: z.literal("exact"),
        network: z.literal("eip155:8453"),
        amount: z.literal(GLEE_PRICE_ATOMIC),
        asset: AddressSchema,
        payTo: AddressSchema,
        maxTimeoutSeconds: z.number().int().positive().max(3600),
        extra: z.object({ name: z.literal("USD Coin"), version: z.literal("2") }).passthrough(),
      })
      .passthrough(),
  ]),
});

export const GLEE_VERIFIER_URL = "https://gleephoenix.com/api/x402/verify/patch";

/**
 * GleeVerifierActionProvider enables autonomous coding agents to gate code submissions
 * and verify git unified diffs against path rules, security boundaries, and assertions
 * using GLEE's live x402 acceptance verifier ($0.05 USDC on Base mainnet).
 */
export class GleeVerifierActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly endpoint: string;
  private readonly trustedPayTo?: string;
  private readonly trustedReceiptPublicKeyHex?: string;

  /**
   * Constructs a new GleeVerifierActionProvider.
   *
   * @param config - Endpoint and operator-trusted recipient/public key; legacy endpoint strings lack trust anchors
   */
  constructor(config: GleeVerifierConfig | string = {}) {
    super("glee-verifier", []);
    const options = typeof config === "string" ? { endpoint: config } : config;
    this.endpoint = options.endpoint || GLEE_VERIFIER_URL;
    this.trustedPayTo = options.trustedPayTo;
    this.trustedReceiptPublicKeyHex = options.trustedReceiptPublicKeyHex;
  }

  /**
   * Validates a git patch diff against security boundaries, path policies, and syntax assertions.
   *
   * @param wallet - The EVM wallet provider supporting signTypedData for EIP-3009 payment
   * @param args - Arguments matching VerifyPatchSchema
   * @returns Detailed verification results including verdict (PASS/FAIL), score, diff stats, and Ed25519 receipt
   */
  @CreateAction({
    name: "verify_patch",
    description: `Validates a git unified diff patch against declared path policies, security rules, and regex assertions via GLEE Acceptance Verifier ($0.05 USDC on Base mainnet).

Inputs:
- patch: The git diff or patch content to verify (required)
- path_policy: Optional allowed_paths and banned_paths lists
- assertions: Optional semantic assertion checks (contains / prohibits)
- job_id: Optional tracking reference echoed in the cryptographic receipt

Returns:
- JSON string with verdict (PASS/FAIL), score, modified_files, stats, and signed cryptographic Ed25519 receipt.`,
    schema: VerifyPatchSchema,
  })
  async verifyPatch(
    wallet: EvmWalletProvider,
    args: z.infer<typeof VerifyPatchSchema>,
  ): Promise<string> {
    try {
      if (
        !AddressSchema.safeParse(this.trustedPayTo).success ||
        !this.trustedReceiptPublicKeyHex ||
        !/^[a-fA-F0-9]{64}$/.test(this.trustedReceiptPublicKeyHex)
      ) {
        throw new Error(
          "Verification unavailable: configure trustedPayTo and trustedReceiptPublicKeyHex before payment",
        );
      }
      const trustedPayTo = AddressSchema.parse(this.trustedPayTo);
      const endpoint = new URL(this.endpoint);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.username ||
        endpoint.password ||
        endpoint.hash
      ) {
        throw new Error("Verifier endpoint must be an HTTPS URL without credentials or fragment");
      }
      if (!this.supportsNetwork(wallet.getNetwork())) {
        throw new Error("Payment requires a wallet on Base mainnet (chainId 8453)");
      }
      // Serialize once so mutation during an HTTP call cannot change the paid request.
      const requestBody = JSON.stringify(VerifyPatchSchema.parse(args));
      const request = JSON.parse(requestBody) as z.infer<typeof VerifyPatchSchema>;
      const challengeRes = await fetch(this.endpoint, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (challengeRes.status !== 402) {
        throw new Error(`Expected HTTP 402 payment challenge, received ${challengeRes.status}`);
      }
      const challenge = ChallengeSchema.safeParse(await challengeRes.json());
      if (!challenge.success) throw new Error("Unapproved or malformed payment terms");
      const terms = challenge.data.accepts[0];
      if (
        terms.payTo.toLowerCase() !== trustedPayTo.toLowerCase() ||
        terms.asset.toLowerCase() !== BASE_USDC_MAINNET_ADDRESS.toLowerCase() ||
        challenge.data.resource.url !== this.endpoint
      ) {
        throw new Error("Unapproved payment recipient, asset, or resource");
      }
      const payerAddress = AddressSchema.parse(await wallet.getAddress()) as `0x${string}`;
      const now = Math.floor(Date.now() / 1000);
      const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

      const authorization = {
        from: payerAddress,
        to: trustedPayTo as `0x${string}`,
        value: GLEE_PRICE_ATOMIC,
        validAfter: 0,
        validBefore: now + terms.maxTimeoutSeconds,
        nonce,
      };

      const typedData = {
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: BASE_CHAIN_ID,
          verifyingContract: BASE_USDC_MAINNET_ADDRESS as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: authorization,
      };

      // Recheck after the asynchronous address lookup, immediately before signing.
      if (!this.supportsNetwork(wallet.getNetwork())) throw new Error("Wallet network changed");
      const signature = await wallet.signTypedData(typedData);

      const paymentPayload = {
        x402Version: 2,
        accepted: terms,
        payload: {
          signature,
          authorization,
        },
      };

      const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

      // Submit only after all terms and trust anchors have been checked.
      const paidRes = await fetch(this.endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": paymentHeader,
        },
        body: requestBody,
      });

      if (!paidRes.ok || paidRes.status !== 200) {
        throw new Error(
          `Paid verifier request failed with HTTP ${paidRes.status}; no authenticated verdict`,
        );
      }
      return JSON.stringify(
        authenticateDelivery(
          await paidRes.json(),
          request,
          this.trustedReceiptPublicKeyHex,
          trustedPayTo,
          payerAddress,
        ),
      );
    } catch (error) {
      return JSON.stringify({
        error: `GLEE patch verification failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the GLEE verifier action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if network is Base mainnet
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" && network.chainId === String(BASE_CHAIN_ID);
}

export const gleeVerifierActionProvider = (config?: GleeVerifierConfig | string) =>
  new GleeVerifierActionProvider(config);
