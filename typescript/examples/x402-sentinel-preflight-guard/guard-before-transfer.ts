import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  x402ActionProvider,
} from "@coinbase/agentkit";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Example: gate an on-chain transfer behind a pre-execution safety check.
 *
 * This does NOT require an LLM in the loop for the safety decision itself --
 * the check is deterministic and should run every time, regardless of what
 * the agent's language model decided. The pattern:
 *
 *   1. Build the transfer you intend to send (to, value, data).
 *   2. Ask a third-party x402 safety oracle to evaluate it BEFORE signing.
 *   3. Only proceed if the oracle returns a SAFE verdict.
 *
 * The oracle used here is SENTINEL (https://sentinel-agent.dev), an
 * independent x402 service -- not a Coinbase product, not affiliated with
 * AgentKit. It is used purely as a worked example of the x402ActionProvider
 * "call any x402 service" pattern applied to pre-execution risk checking.
 * Swap in any x402-compatible guard service that fits your use case.
 *
 * Cost: SENTINEL charges a small tiered USDC fee per check (from $0.005),
 * paid automatically via x402ActionProvider. Set MAX_GUARD_PAYMENT_USDC to
 * cap what this example is willing to spend on a single check.
 */

/**
 * Validates required environment variables are present.
 *
 * @throws {Error} if a required variable is missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const required = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
}

validateEnvironment();

const GUARD_URL = "https://sentinel-agent.dev/v1/guard";
const MAX_GUARD_PAYMENT_USDC = Number(process.env.MAX_GUARD_PAYMENT_USDC ?? "0.05");

/**
 * Result shape returned by SENTINEL's /v1/guard endpoint.
 */
interface GuardVerdict {
  verdict: "SAFE" | "UNSAFE" | "UNKNOWN";
  risks?: string[];
  score?: number;
  grade?: string;
  signature?: string;
  [key: string]: unknown;
}

/**
 * Asks SENTINEL whether a transaction looks safe to sign, paying the small
 * x402 fee automatically via the AgentKit x402ActionProvider instance.
 *
 * @param guard - A configured x402ActionProvider instance with sentinel-agent.dev registered
 * @param walletProvider - The wallet that would sign the transaction being checked
 * @param tx - The transaction under consideration
 * @returns The parsed guard verdict, or null if the check itself failed (fail-closed by caller)
 */
async function checkTransactionSafety(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guard: any,
  walletProvider: CdpEvmWalletProvider,
  tx: { to: string; data?: string; value?: string },
): Promise<GuardVerdict | null> {
  const raw = await guard.makeHttpRequestWithX402(walletProvider, {
    url: GUARD_URL,
    method: "POST",
    headers: null,
    queryParams: null,
    body: {
      chain: "base",
      from_addr: await walletProvider.getAddress(),
      tx: {
        to: tx.to,
        data: tx.data ?? "0x",
        value: tx.value ?? "0x0",
      },
    },
  });

  const parsed = JSON.parse(raw);

  if (!parsed.success) {
    console.error("Guard check failed (fail-closed -- treat as not-safe):", parsed);
    return null;
  }

  return parsed.data as GuardVerdict;
}

/**
 * Entry point: builds a sample native transfer, checks it with SENTINEL,
 * and only executes it if the verdict is SAFE.
 *
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: process.env.NETWORK_ID ?? "base-mainnet",
  });

  const guard = x402ActionProvider({
    registeredServices: ["https://sentinel-agent.dev"],
    maxPaymentUsdc: MAX_GUARD_PAYMENT_USDC,
  });

  const wallet = walletActionProvider();

  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [guard, wallet],
  });
  void agentKit; // available for LLM-driven actions elsewhere in a real agent; unused directly here

  // Replace with the transfer your agent actually intends to make.
  const intendedTx = {
    to: "0x0000000000000000000000000000000000dEaD",
    value: "0x0",
    data: "0x",
  };

  console.log("Checking transaction safety with SENTINEL before signing...");
  const verdict = await checkTransactionSafety(guard, walletProvider, intendedTx);

  if (!verdict || verdict.verdict !== "SAFE") {
    console.log(
      "Refusing to sign -- verdict was",
      verdict?.verdict ?? "UNAVAILABLE",
      verdict?.risks ? `(risks: ${verdict.risks.join(", ")})` : "",
    );
    return;
  }

  console.log("Verdict SAFE (score:", verdict.score, "grade:", verdict.grade, ") -- proceeding.");

  // At this point, execute the actual transfer via the wallet action provider
  // (or hand off to your agent loop). Left as a comment rather than executed
  // automatically, since this is a documentation example.
  //
  // const result = await wallet.nativeTransfer(walletProvider, {
  //   to: intendedTx.to,
  //   value: intendedTx.value,
  // });
  // console.log(result);
}

main().catch(error => {
  console.error("Example failed:", error);
  process.exit(1);
});
