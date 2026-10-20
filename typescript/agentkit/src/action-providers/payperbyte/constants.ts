/**
 * BYTE Library PayloadAttestation — EIP-712 domain and struct, matching the PayPerByte
 * gateway's X-BYTE-Attestation format exactly.
 *
 * INTEROP CONTRACT: ALL FOUR domain fields (name, version, chainId, verifyingContract) are
 * consensus-critical and are pinned to the constants below during verification — never taken
 * from the attestation's own claimed `domain` object. EIP-712 domain separation is the entire
 * security mechanism of a typed-data signature: if a verifier lets the signed data supply its
 * own domain, an attacker can sign under ANY domain with their own key, set `publisher` to
 * their own address, and pass a naive "recovered === publisher" check — a self-referential
 * forgery that never touches the real BYTE Library domain at all. `PayperbyteConfig.attestationDomain`
 * exists ONLY for a future coordinated migration of chainId/verifyingContract; the domain name
 * and version are never overridable, by design.
 *
 * The attestation domain stays anchored on chainId 421614 (Arbitrum Sepolia) regardless of
 * which network the underlying x402 payment settles on (Base) — attestation domain and payment
 * rail are deliberately decoupled; see the "attestation domain vs. payment rail" note in the
 * provider README.
 */
export const BYTE_ATTESTATION_DOMAIN_NAME = "BYTE Library" as const;
export const BYTE_ATTESTATION_DOMAIN_VERSION = "1" as const;
export const BYTE_ATTESTATION_CHAIN_ID = 421614;
export const BYTE_ATTESTATION_VERIFYING_CONTRACT =
  "0x44729bB148F46d8Db509E47b0453edc271e06e95" as const;

/**
 * The pinned, trusted attestation domain — used for verification unless
 * `PayperbyteConfig.attestationDomain` overrides chainId/verifyingContract (name and version
 * are never overridable). See the INTEROP CONTRACT note above for why this must never be built
 * from an attestation's own claimed `domain` field.
 */
export const PINNED_ATTESTATION_DOMAIN = {
  name: BYTE_ATTESTATION_DOMAIN_NAME,
  version: BYTE_ATTESTATION_DOMAIN_VERSION,
  chainId: BYTE_ATTESTATION_CHAIN_ID,
  verifyingContract: BYTE_ATTESTATION_VERIFYING_CONTRACT,
} as const;

/** The EIP-712 struct — identical across contract, gateway, MCP server, and SDK. */
export const PAYLOAD_ATTESTATION_TYPES = {
  PayloadAttestation: [
    { name: "publisher", type: "address" },
    { name: "payloadHash", type: "bytes32" },
    { name: "payloadLength", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const DEFAULT_BASE_URL = "https://x402.payperbyte.io";
export const DEFAULT_MAX_PAYMENT_USDC = 1.0;

/** Only Base networks are supported — PayPerByte feeds settle in USDC on Base. */
export const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"] as const;

/**
 * CAIP-2 network id -> canonical USDC contract address, for the x402 client's payment
 * policy (which only sees the raw x402 protocol network string, e.g. "eip155:8453", not the
 * AgentKit wallet-provider network id "base-mainnet"). CAIP-2 strings match
 * `NETWORK_MAPPINGS` in the built-in x402 provider's constants.ts. Addresses are the same
 * `TOKEN_ADDRESSES_BY_SYMBOLS[...].USDC` entries the rest of AgentKit uses (imported directly
 * in payperbyteActionProvider.ts, not duplicated here) — this map only pins the network-id
 * translation.
 */
export const USDC_BY_CAIP2_NETWORK: Record<string, "base-mainnet" | "base-sepolia"> = {
  "eip155:8453": "base-mainnet",
  "eip155:84532": "base-sepolia",
};
