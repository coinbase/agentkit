import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { WalletProvider } from "../../wallet-providers";
import {
  CreateIdentityProofSchema,
  VerifyIdentityProofSchema,
} from "./schemas";

/**
 * Valid permission strings for the 8-bit cumulative bitmask.
 * Higher tiers imply lower: financial_medium implies financial_small.
 */
const VALID_PERMISSIONS = [
  "read_data",
  "write_data",
  "financial_small",
  "financial_medium",
  "financial_unlimited",
  "sign_on_behalf",
  "sub_delegate",
  "access_pii",
] as const;

/**
 * Configuration options for the Bolyra Action Provider.
 */
export interface BolyraActionProviderConfig {
  /**
   * Operator secret for credential issuance. Must be a non-zero bigint or
   * hex string. Load from a secure store (env var, HSM, secrets manager).
   * The provider throws at construction time if this is missing.
   */
  operatorSecret: bigint | string;
}

/**
 * BolyraActionProvider gives AgentKit agents the ability to create and verify
 * ZKP-based identity proofs with scoped permissions.
 *
 * Actions:
 * - create_identity_proof: Generate a credential proving this agent's identity and permissions
 * - verify_identity_proof: Verify another agent's proof envelope
 *
 * Complements the ERC-8004 provider: ERC-8004 handles on-chain registry identity,
 * Bolyra handles off-chain ZKP portable identity with privacy-preserving proofs.
 *
 * Uses WalletProvider (generic, not EVM-specific) because Bolyra proofs are
 * off-chain ZKP and network-agnostic.
 *
 * Requires: @bolyra/sdk (npm install @bolyra/sdk)
 */
export class BolyraActionProvider extends ActionProvider<WalletProvider> {
  private operatorSecret: bigint;

  constructor(config: BolyraActionProviderConfig) {
    super("bolyra", []);
    if (!config?.operatorSecret) {
      throw new Error(
        "BolyraActionProvider requires operatorSecret. " +
          "Load from env: bolyraActionProvider({ operatorSecret: BigInt(process.env.OPERATOR_SECRET!) })",
      );
    }
    this.operatorSecret =
      typeof config.operatorSecret === "string"
        ? BigInt(config.operatorSecret)
        : BigInt(config.operatorSecret);
  }

  /**
   * Lazily load @bolyra/sdk to keep it an optional peer dependency.
   */
  private async getSDK() {
    try {
      return await import("@bolyra/sdk");
    } catch {
      throw new Error(
        "@bolyra/sdk is required for Bolyra identity actions. Install with: npm install @bolyra/sdk",
      );
    }
  }

  /**
   * Validate that all permission strings are recognized.
   */
  private validatePermissions(permissions: string[]): void {
    const invalid = permissions.filter(
      p => !VALID_PERMISSIONS.includes(p as (typeof VALID_PERMISSIONS)[number]),
    );
    if (invalid.length > 0) {
      throw new Error(
        `Invalid permissions: ${invalid.join(", ")}. Valid: ${VALID_PERMISSIONS.join(", ")}`,
      );
    }
  }

  @CreateAction({
    name: "create_identity_proof",
    description: `Creates a ZKP identity proof for this agent with scoped permissions.
The proof demonstrates that this agent holds a valid operator-signed credential
with specific permissions, without revealing the operator's secret.

Permissions use an 8-bit cumulative encoding:
- read_data, write_data: data access
- financial_small (<$100), financial_medium (<$10K), financial_unlimited: spending authority
- sign_on_behalf, sub_delegate, access_pii: elevated privileges

Higher tiers imply lower: financial_medium automatically includes financial_small.`,
    schema: CreateIdentityProofSchema,
  })
  async createIdentityProof(
    walletProvider: WalletProvider,
    args: z.infer<typeof CreateIdentityProofSchema>,
  ): Promise<string> {
    this.validatePermissions(args.permissions);

    try {
      const sdk = await this.getSDK();
      const address = await walletProvider.getAddress();

      const human = sdk.createHumanIdentity(this.operatorSecret);
      const expiry = Math.floor(Date.now() / 1000) + args.expirySeconds;

      const agent = sdk.createAgentCredential(
        BigInt("0x" + address.slice(2, 18)),
        this.operatorSecret,
        args.permissions,
        expiry,
      );

      const handshake = sdk.proveHandshake(human, agent);
      const envelope = sdk.serializeEnvelope(handshake);

      return [
        `Identity proof created for agent ${address}.`,
        `Permissions: ${args.permissions.join(", ")}`,
        `Expires: ${new Date(expiry * 1000).toISOString()}`,
        `Proof envelope (${envelope.length} bytes) ready for verification.`,
        `Envelope: ${envelope}`,
      ].join("\n");
    } catch (error) {
      return `Failed to create identity proof: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  @CreateAction({
    name: "verify_identity_proof",
    description: `Verifies another agent's Bolyra identity proof envelope.
Checks that the proof is cryptographically valid, not expired, and optionally
that the agent holds specific required permissions.

The proof envelope format is application/vnd.bolyra.proof+json.`,
    schema: VerifyIdentityProofSchema,
  })
  async verifyIdentityProof(
    _walletProvider: WalletProvider,
    args: z.infer<typeof VerifyIdentityProofSchema>,
  ): Promise<string> {
    try {
      const sdk = await this.getSDK();
      const envelope = sdk.deserializeEnvelope(args.proofEnvelope);
      const result = sdk.verifyHandshake(
        envelope.humanProof,
        envelope.agentProof,
        envelope.sessionNonce,
      );

      if (!result.verified) {
        return "Verification FAILED: proof is invalid or expired.";
      }

      const lines = [
        "Verification PASSED.",
        `Agent nullifier: ${result.agentNullifier}`,
        `Human nullifier: ${result.humanNullifier}`,
      ];

      if (args.requiredPermissions && args.requiredPermissions.length > 0) {
        // Decode the scope commitment to extract proven permissions and check
        // that all required permissions are present.
        const provenPermissions = result.provenPermissions ?? [];
        const missing = args.requiredPermissions.filter(
          p => !provenPermissions.includes(p),
        );
        if (missing.length > 0) {
          return [
            "Verification PASSED (proof is valid) but INSUFFICIENT PERMISSIONS.",
            `Required: ${args.requiredPermissions.join(", ")}`,
            `Proven: ${provenPermissions.join(", ") || "(none decoded)"}`,
            `Missing: ${missing.join(", ")}`,
          ].join("\n");
        }
        lines.push(`Required permissions verified: ${args.requiredPermissions.join(", ")}`);
      }

      return lines.join("\n");
    } catch (error) {
      return `Verification error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Check if this provider supports the given network.
   * Bolyra proofs are network-agnostic (off-chain ZKP), so all networks are supported.
   */
  supportsNetwork(_network: unknown): boolean {
    return true;
  }
}

/**
 * Factory function for the Bolyra action provider.
 *
 * @param config - Optional configuration
 * @returns A new BolyraActionProvider instance
 */
export const bolyraActionProvider = (config: BolyraActionProviderConfig) =>
  new BolyraActionProvider(config);
