import { z } from "zod";

import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

import { SignDigestSchema, SignSafeTransactionSchema, GetPublicKeySchema } from "./schemas";

/**
 * MultisigActionProvider enables agents to participate in external multisig coordination.
 *
 * Use cases:
 * - Multi-agent treasuries (2-of-3, 3-of-5, etc.)
 * - Cross-provider coordination (AgentKit + aibtc + Claw Cash agents sharing a multisig)
 * - Safe (Gnosis Safe) multisig participation
 * - External coordination protocols
 *
 * Security note: These actions sign digests/hashes directly. The calling agent is responsible
 * for validating what they're signing (e.g., verifying PSBT contents, Safe transaction details)
 * before requesting a signature. The coordination protocol should provide full transaction
 * visibility before signing.
 */
export class MultisigActionProvider extends ActionProvider {
  /**
   * Constructor for the MultisigActionProvider.
   */
  constructor() {
    super("multisig", []);
  }

  /**
   * Signs a raw 32-byte digest using the wallet's private key.
   *
   * This is the primitive for external multisig coordination. The coordinator provides
   * a digest (e.g., BIP-341 sighash for Taproot, or keccak256 hash for EVM), and the
   * agent signs it.
   *
   * SECURITY: Only sign digests from trusted coordination protocols that have shown
   * you the full transaction details. Never sign arbitrary digests from unknown sources.
   *
   * @param walletProvider - The wallet provider to sign with.
   * @param args - The digest to sign.
   * @returns The signature and public key.
   */
  @CreateAction({
    name: "sign_digest",
    description: `
Signs a raw 32-byte digest (hash) for external multisig coordination.

Use this when:
- Participating in a multi-agent multisig (2-of-3, 3-of-5, etc.)
- A coordination protocol provides a sighash/digest to sign
- You've validated the underlying transaction and want to authorize it

Input:
- digest: 32-byte hash as hex string (64 chars, with or without 0x prefix)

Returns:
- signature: The ECDSA signature (hex)
- publicKey: Your public key for the coordinator to assemble the multisig

SECURITY: Only sign digests after validating the full transaction from the coordinator.
`,
    schema: SignDigestSchema,
  })
  async signDigest(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SignDigestSchema>,
  ): Promise<string> {
    // Normalize digest: ensure 0x prefix, lowercase
    let digest = args.digest.toLowerCase();
    if (!digest.startsWith("0x")) {
      digest = `0x${digest}`;
    }

    // Validate length (should be 32 bytes = 64 hex chars + 2 for 0x)
    if (digest.length !== 66) {
      return `Error: Digest must be exactly 32 bytes (64 hex characters). Got ${digest.length - 2} characters.`;
    }

    try {
      const signature = await walletProvider.sign(digest as `0x${string}`);
      const address = walletProvider.getAddress();

      return [
        "Digest signed successfully!",
        "",
        "Signature Details:",
        `- Digest: ${digest}`,
        `- Signature: ${signature}`,
        `- Signer Address: ${address}`,
        "",
        "The coordinator can now include this signature in the multisig transaction.",
      ].join("\n");
    } catch (error) {
      return `Error signing digest: ${error}`;
    }
  }

  /**
   * Signs a Safe (Gnosis Safe) transaction hash for multisig approval.
   *
   * Safe multisigs use EIP-712 typed data signing. This action signs the safeTxHash
   * which can then be submitted to the Safe Transaction Service or used to execute
   * the transaction on-chain.
   *
   * @param walletProvider - The wallet provider to sign with.
   * @param args - The Safe address and transaction hash.
   * @returns The signature for the Safe transaction.
   */
  @CreateAction({
    name: "sign_safe_transaction",
    description: `
Signs a Safe (Gnosis Safe) multisig transaction hash.

Use this when:
- You're a signer on a Safe multisig
- A transaction has been proposed and you want to approve it
- You have the safeTxHash from the Safe Transaction Service or coordinator

Input:
- safeAddress: The Safe contract address
- safeTxHash: The Safe transaction hash to sign (32 bytes hex)

Returns:
- signature: The EIP-712 signature for the Safe
- Signer address for verification

After signing, the signature can be submitted to the Safe Transaction Service
or used to execute the transaction directly.
`,
    schema: SignSafeTransactionSchema,
  })
  async signSafeTransaction(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SignSafeTransactionSchema>,
  ): Promise<string> {
    // Normalize safeTxHash
    let safeTxHash = args.safeTxHash.toLowerCase();
    if (!safeTxHash.startsWith("0x")) {
      safeTxHash = `0x${safeTxHash}`;
    }

    if (safeTxHash.length !== 66) {
      return `Error: safeTxHash must be exactly 32 bytes (64 hex characters). Got ${safeTxHash.length - 2} characters.`;
    }

    try {
      // For Safe, we sign the safeTxHash directly (it's already the EIP-712 hash)
      const signature = await walletProvider.sign(safeTxHash as `0x${string}`);
      const address = walletProvider.getAddress();

      return [
        "Safe transaction signed successfully!",
        "",
        "Signature Details:",
        `- Safe Address: ${args.safeAddress}`,
        `- Safe TX Hash: ${safeTxHash}`,
        `- Signature: ${signature}`,
        `- Signer: ${address}`,
        "",
        "Submit this signature to the Safe Transaction Service or use it to execute.",
      ].join("\n");
    } catch (error) {
      return `Error signing Safe transaction: ${error}`;
    }
  }

  /**
   * Gets the wallet's public key/address for multisig registration.
   *
   * When joining a multisig, the coordinator needs each signer's public key
   * to generate the multisig address. This returns the address that can be
   * used for that purpose.
   *
   * @param walletProvider - The wallet provider.
   * @param _ - Empty args object.
   * @returns The wallet's address for multisig registration.
   */
  @CreateAction({
    name: "get_multisig_pubkey",
    description: `
Gets your public key/address for registering with a multisig coordinator.

Use this when:
- Joining a new multi-agent multisig
- A coordinator asks for your public key to generate the multisig address
- Setting up a new Safe or other multisig wallet

Returns:
- Your wallet address (which can be used as your public identifier in multisigs)
- Network information
`,
    schema: GetPublicKeySchema,
  })
  async getMultisigPubkey(
    walletProvider: EvmWalletProvider,
    _: z.infer<typeof GetPublicKeySchema>,
  ): Promise<string> {
    try {
      const address = walletProvider.getAddress();
      const network = walletProvider.getNetwork();

      return [
        "Multisig Public Key Info:",
        "",
        `- Address: ${address}`,
        `- Network: ${network.networkId || network.chainId}`,
        `- Protocol: ${network.protocolFamily}`,
        "",
        "Share this address with the multisig coordinator to register as a signer.",
      ].join("\n");
    } catch (error) {
      return `Error getting public key: ${error}`;
    }
  }

  /**
   * Checks if the multisig action provider supports the given network.
   * Currently supports EVM networks only.
   *
   * @param network - The network to check.
   * @returns True if the network is EVM-based.
   */
  supportsNetwork = (network: Network): boolean => {
    return network.protocolFamily === "evm";
  };
}

/**
 * Factory function to create a new MultisigActionProvider instance.
 *
 * @returns A new MultisigActionProvider instance.
 */
export const multisigActionProvider = () => new MultisigActionProvider();
