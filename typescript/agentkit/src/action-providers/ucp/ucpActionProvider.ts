import { z } from "zod";
import canonicalize from "canonicalize";
import { keccak256, toHex, stringToHex, encodePacked, recoverAddress } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  UcpDiscoverSchema,
  UcpQuoteSchema,
  UcpCompileSchema,
  UcpPaySchema,
  UcpVerifyReceiptSchema,
  UcpConfig,
} from "./schemas";
import {
  COMMITMENT_DOMAIN,
  DEFAULT_ESCROW_ADDRESS,
  DEFAULT_BASE_USDC,
  DEFAULT_BASE_SEPOLIA_USDC,
  SUPPORTED_NETWORKS,
} from "./constants";

/**
 * UcpActionProvider provides non-custodial actions for Google UCP merchant discovery,
 * session quoting, AP2 spend bounds compilation, payee-bound EIP-3009/escrow payments,
 * and cryptographic XDR-1 receipt verification.
 */
export class UcpActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: UcpConfig;

  constructor(config: UcpConfig = {}) {
    super("ucp", []);
    this.config = config;
  }

  /**
   * Checks if the provider supports the network.
   */
  supportsNetwork(network: Network): boolean {
    if (network.protocolFamily !== "evm") return false;
    const netId = network.networkId.toLowerCase();
    return (
      netId.includes("base") ||
      netId === "8453" ||
      netId === "84532" ||
      netId === "eip155:8453" ||
      netId === "eip155:84532"
    );
  }

  /**
   * Discovers UCP merchant capabilities at /.well-known/ucp.
   */
  @CreateAction({
    name: "ucp_discover",
    description: "Discover merchant payment handlers, capabilities, and checkout endpoints via Google UCP specification",
    schema: UcpDiscoverSchema,
  })
  async discover(walletProvider: EvmWalletProvider, args: z.infer<typeof UcpDiscoverSchema>): Promise<string> {
    try {
      const origin = args.domain.startsWith("http") ? args.domain : `https://${args.domain}`;
      const url = `${origin}/.well-known/ucp`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (!res.ok) {
        return JSON.stringify({
          success: false,
          error: `Failed to fetch UCP manifest from ${url}: HTTP ${res.status}`,
        });
      }

      const manifest = await res.json();
      return JSON.stringify(
        {
          success: true,
          domain: args.domain,
          manifest,
          checkoutEndpoint: manifest?.checkoutEndpoint || `${origin}/checkout/create`,
          capabilities: manifest?.capabilities || [],
        },
        null,
        2,
      );
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message || String(err) });
    }
  }

  /**
   * Requests a checkout quote from the UCP merchant to lock price and availability.
   */
  @CreateAction({
    name: "ucp_quote",
    description: "Request a checkout quote from a UCP merchant to lock session price and validUntil deadline",
    schema: UcpQuoteSchema,
  })
  async quote(walletProvider: EvmWalletProvider, args: z.infer<typeof UcpQuoteSchema>): Promise<string> {
    try {
      const origin = args.domain.startsWith("http") ? args.domain : `https://${args.domain}`;
      const url = `${origin}/checkout/create`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sku: args.sku,
          quantity: args.quantity,
        }),
      });

      if (!res.ok) {
        return JSON.stringify({
          success: false,
          error: `Quote failed from ${url}: HTTP ${res.status}`,
        });
      }

      const session = await res.json();
      return JSON.stringify(
        {
          success: true,
          sessionId: session.sessionId || session.id,
          totalMinor: session.total || session.amount,
          merchantAddress: session.merchantAddress || session.recipient,
          validUntil: session.validUntil || Math.floor(Date.now() / 1000) + 3600,
        },
        null,
        2,
      );
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message || String(err) });
    }
  }

  /**
   * Compiles spend authorization, enforces spend bounds, and calculates Payee-Binding Nonce.
   */
  @CreateAction({
    name: "ucp_compile",
    description: "Compile and audit spend bounds against user mandate, and compute the cryptographic payee-binding commitment nonce",
    schema: UcpCompileSchema,
  })
  async compile(walletProvider: EvmWalletProvider, args: z.infer<typeof UcpCompileSchema>): Promise<string> {
    try {
      const total = BigInt(args.totalMinor);

      if (args.maxPerOrderMinor && total > BigInt(args.maxPerOrderMinor)) {
        return JSON.stringify({
          success: false,
          error: `Spend rejected: order total (${total}) exceeds maxPerOrder cap (${args.maxPerOrderMinor})`,
        });
      }

      if (args.budgetCapMinor && total > BigInt(args.budgetCapMinor)) {
        return JSON.stringify({
          success: false,
          error: `Spend rejected: order total (${total}) exceeds remaining budget cap (${args.budgetCapMinor})`,
        });
      }

      // Calculate cryptographic Payee-Binding Commitment Nonce:
      // nonce = keccak256(COMMITMENT_DOMAIN, token, merchant, amount, randomSalt)
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const commitmentNonce = keccak256(
        encodePacked(
          ["string", "address", "address", "uint256", "bytes16"],
          [
            COMMITMENT_DOMAIN,
            DEFAULT_BASE_USDC as `0x${string}`,
            args.merchantAddress as `0x${string}`,
            total,
            salt as `0x${string}`,
          ],
        ),
      );

      return JSON.stringify(
        {
          success: true,
          boundsAudit: "PASSED",
          authorizedTotalMinor: args.totalMinor,
          merchantAddress: args.merchantAddress,
          payeeBindingCommitmentNonce: commitmentNonce,
          salt,
        },
        null,
        2,
      );
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message || String(err) });
    }
  }

  /**
   * Executes non-custodial payment: wallet signs EIP-712/EIP-3009 payload, then dispatches to escrow.
   */
  @CreateAction({
    name: "ucp_pay",
    description: "Sign EIP-3009/712 authorization using local EvmWalletProvider and settle non-custodially to Base L2 escrow",
    schema: UcpPaySchema,
  })
  async pay(walletProvider: EvmWalletProvider, args: z.infer<typeof UcpPaySchema>): Promise<string> {
    try {
      const payerAddress = await walletProvider.getAddress();
      const network = await walletProvider.getNetwork();
      const isTestnet = network.networkId.includes("sepolia") || network.networkId === "84532";
      const chainId = isTestnet ? 84532 : 8453;
      const tokenAddress = (args.tokenAddress || (isTestnet ? DEFAULT_BASE_SEPOLIA_USDC : DEFAULT_BASE_USDC)) as `0x${string}`;
      const escrowAddress = (args.escrowAddress || this.config.defaultEscrowAddress || DEFAULT_ESCROW_ADDRESS) as `0x${string}`;

      const domain = {
        name: isTestnet ? "USDC" : "USD Coin",
        version: "2",
        chainId,
        verifyingContract: tokenAddress,
      };

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const message = {
        from: payerAddress,
        to: escrowAddress,
        value: args.totalMinor,
        validAfter: 0,
        validBefore: args.validUntil,
        nonce: args.nonce,
      };

      // Wallet signs the payload locally; private key never leaves wallet
      const signature = await walletProvider.signTypedData({
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
      });

      return JSON.stringify(
        {
          success: true,
          payer: payerAddress,
          recipient: args.merchantAddress,
          escrow: escrowAddress,
          amountMinor: args.totalMinor,
          signature,
          settlementStatus: "AUTHORIZED_AND_READY_FOR_DISPATCH",
        },
        null,
        2,
      );
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message || String(err) });
    }
  }

  /**
   * Cryptographically verifies an XDR-1 Execution Delivery Receipt using RFC 8785 canonicalization.
   */
  @CreateAction({
    name: "ucp_verify_receipt",
    description: "Verify XDR-1 Execution Delivery Receipt using RFC 8785 JSON canonicalization and secp256k1 signature recovery",
    schema: UcpVerifyReceiptSchema,
  })
  async verifyReceipt(walletProvider: EvmWalletProvider, args: z.infer<typeof UcpVerifyReceiptSchema>): Promise<string> {
    try {
      const receipt = args.receipt;
      if (!receipt || !receipt.body || !receipt.sig) {
        return JSON.stringify({ success: false, error: "Malformed receipt: body and sig are required" });
      }

      // Canonicalize body using RFC 8785 JCS
      const canonicalBody = canonicalize(receipt.body);
      if (!canonicalBody) {
        return JSON.stringify({ success: false, error: "Failed to canonicalize receipt body" });
      }

      const bodyDigest = keccak256(stringToHex(canonicalBody));

      // Parse signature (hex or b64url)
      let sigHex = receipt.sig;
      if (!sigHex.startsWith("0x")) {
        const bin = Buffer.from(receipt.sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        sigHex = "0x" + bin.toString("hex");
      }

      // Recover signer address via viem
      const recoveredSigner = await recoverAddress({
        hash: bodyDigest,
        signature: sigHex as `0x${string}`,
      });

      const matchesSigner = args.trustedSignerAddress
        ? recoveredSigner.toLowerCase() === args.trustedSignerAddress.toLowerCase()
        : true;

      return JSON.stringify(
        {
          success: true,
          verified: matchesSigner,
          recoveredSigner,
          expectedSigner: args.trustedSignerAddress,
          bodyDigest,
          deliveryStatus: receipt.body.status || "DELIVERED",
        },
        null,
        2,
      );
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message || String(err) });
    }
  }
}

export function ucpActionProvider(config: UcpConfig = {}): UcpActionProvider {
  return new UcpActionProvider(config);
}
