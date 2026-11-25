/**
 * Where TAP Labs answers.
 */
export const TAP_LABS_BASE_URL = "https://labs.theatlasproject.dev";

/**
 * The paid endpoints of the two TAP Labs agents this provider calls.
 */
export const SAFETY_CHECK_PATH = "/agents/safety-check/run";
export const WALLET_FIREWALL_PATH = "/agents/wallet-firewall/run";

/**
 * TAP's wallet that receives TAP Labs payments. A payment request to any other address is refused.
 */
export const TAP_LABS_PAY_TO = "0x6409a21A5c77a31e2BF55f6F00C62baB2A5a7e59";

/**
 * Base mainnet, as x402 v2 names it.
 */
export const BASE_MAINNET_X402 = "eip155:8453";

/**
 * USDC on Base mainnet: the only asset this provider pays with.
 */
export const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * The most one check may cost by default, in USDC (Safety Check is $0.01, Wallet Firewall $0.02).
 */
export const DEFAULT_MAX_PAYMENT_USDC = 0.03;

/**
 * The highest per-check cap a configuration may set, in USDC.
 */
export const MAX_PAYMENT_CAP_USDC = 1;

/**
 * The most one provider instance may sign for in total by default, in USDC.
 */
export const DEFAULT_MAX_TOTAL_USDC = 1;

/**
 * The highest total budget a configuration may set, in USDC.
 */
export const MAX_TOTAL_CAP_USDC = 100;

/**
 * The longest a signed payment authorization may stay valid, in seconds.
 */
export const MAX_AUTHORIZATION_SECONDS = 600;

/**
 * How long one request to TAP Labs may take.
 */
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * The largest request this provider sends, in characters of JSON.
 */
export const MAX_REQUEST_CHARS = 70_000;

/**
 * The largest answer this provider reads, in bytes.
 */
export const MAX_RESPONSE_BYTES = 1_000_000;

/**
 * The most text this provider passes back to the model, in characters of JSON.
 */
export const MAX_OUTPUT_CHARS = 12_000;

/**
 * How many findings and "not checked" lines are passed back to the model.
 */
export const MAX_FINDINGS_RETURNED = 10;
export const MAX_NOT_CHECKED_RETURNED = 10;
