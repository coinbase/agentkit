/**
 * Constants for the SAID Protocol action provider.
 */

/**
 * The SAID Protocol program ID on Solana mainnet.
 */
export const SAID_PROGRAM_ID = "5dpw6KEQPn248pnkkaYyWfHwu2nfb3LUMbTucb6LaA8G";

/**
 * Default base URL for the SAID Protocol API.
 */
export const DEFAULT_SAID_API_URL = "https://api.saidprotocol.com";

/**
 * One-time verification fee transferred to the SAID treasury by `get_verified` (0.01 SOL).
 */
export const VERIFICATION_FEE_LAMPORTS = 10_000_000;

/**
 * Approximate rent for the agent identity PDA created by `register_agent` (~0.003 SOL).
 */
export const REGISTRATION_RENT_LAMPORTS = 3_500_000;

/**
 * Headroom for transaction fees.
 */
export const TX_FEE_HEADROOM_LAMPORTS = 500_000;

/**
 * Minimum balance required to register + verify in one transaction.
 */
export const MIN_REGISTER_AND_VERIFY_LAMPORTS =
  VERIFICATION_FEE_LAMPORTS + REGISTRATION_RENT_LAMPORTS + TX_FEE_HEADROOM_LAMPORTS;

/**
 * Minimum balance required to verify an already-registered agent.
 */
export const MIN_VERIFY_ONLY_LAMPORTS = VERIFICATION_FEE_LAMPORTS + TX_FEE_HEADROOM_LAMPORTS;
