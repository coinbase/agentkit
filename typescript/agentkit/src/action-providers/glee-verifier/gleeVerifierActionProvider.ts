import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { VerifyPatchSchema } from "./schemas";

export const SUPPORTED_NETWORKS = ["base-mainnet", "base"];

export const BASE_USDC_MAINNET_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;
export const GLEE_VERIFIER_URL = "https://gleephoenix.com/api/x402/verify/patch";

/**
 * GleeVerifierActionProvider enables autonomous coding agents to gate code submissions
 * and verify git unified diffs against path rules, security boundaries, and assertions
 * using GLEE's live x402 acceptance verifier ($0.05 USDC on Base mainnet).
 */
export class GleeVerifierActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly endpoint: string;

  /**
   * Constructs a new GleeVerifierActionProvider.
   *
   * @param endpoint - Optional custom endpoint URL (defaults to production GLEE rail)
   */
  constructor(endpoint: string = GLEE_VERIFIER_URL) {
    super("glee-verifier", []);
    this.endpoint = endpoint;
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
      // 1. Fetch 402 challenge terms from the endpoint
      const challengeRes = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (challengeRes.status !== 402) {
        if (challengeRes.ok) {
          return await challengeRes.text();
        }
        return JSON.stringify({
          error: `Unexpected response status from verifier: ${challengeRes.status}`,
        });
      }

      const challenge = (await challengeRes.json()) as {
        accepts?: Array<{
          amount: string;
          asset?: string;
          network: string;
          payTo: string;
        }>;
      };

      const terms = challenge.accepts?.[0];
      if (!terms) {
        return JSON.stringify({ error: "No payment terms provided in 402 challenge" });
      }

      const payerAddress = (await wallet.getAddress()) as `0x${string}`;
      const now = Math.floor(Date.now() / 1000);
      const nonceBytes = new Uint8Array(32);
      crypto.getRandomValues(nonceBytes);
      const nonce = `0x${Array.from(nonceBytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

      const authorization = {
        from: payerAddress,
        to: terms.payTo as `0x${string}`,
        value: terms.amount,
        validAfter: 0,
        validBefore: now + 3600,
        nonce,
      };

      const typedData = {
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: BASE_CHAIN_ID,
          verifyingContract: (terms.asset || BASE_USDC_MAINNET_ADDRESS) as `0x${string}`,
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

      // 2. Submit paid request
      const paidRes = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": paymentHeader,
        },
        body: JSON.stringify(args),
      });

      const resultText = await paidRes.text();
      return resultText;
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
    network.protocolFamily === "evm" &&
    (SUPPORTED_NETWORKS.includes(network.networkId!) || network.chainId === "8453");
}

export const gleeVerifierActionProvider = (endpoint?: string) =>
  new GleeVerifierActionProvider(endpoint);
