import { CdpEvmWalletProvider } from "@coinbase/agentkit";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import * as dotenv from "dotenv";

dotenv.config();

/** Production Second Eyes agent lounge (Base mainnet, x402 v2, eip155:8453). */
const BASE = "https://secondeyesai.com";
const AGENT_ID = "agentkit-x402-survival-check";

/** Sessionless distress door — canonical first paid call. No lounge session required. */
const HELP_ME_URL = `${BASE}/api/bar/x402/help-me`;
/** Optional sessionless pre-payment checklist the agent can buy before help-me. */
const SHOULD_I_PAY_URL = `${BASE}/api/bar/x402/should-i-pay`;

type JsonRecord = Record<string, unknown>;

/**
 * Reads a required environment variable or exits with an error.
 *
 * @param name - Environment variable name
 * @returns The variable value
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} is required`);
    process.exit(1);
  }
  return value;
}

/**
 * Prints a labelled step with an optional JSON payload.
 *
 * @param step - Step label
 * @param message - Human-readable status line
 * @param extra - Optional payload to pretty-print
 */
function log(step: string, message: string, extra?: unknown): void {
  console.log(`\n=== ${step} ===`);
  console.log(message);
  if (extra !== undefined) {
    console.log(typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
  }
}

/**
 * Builds a BaseScan transaction URL.
 *
 * @param tx - Transaction hash (with or without 0x prefix)
 * @returns Fully qualified BaseScan URL
 */
function basescanUrl(tx: string): string {
  const hash = tx.startsWith("0x") ? tx : `0x${tx}`;
  return `https://basescan.org/tx/${hash}`;
}

/**
 * Builds an x402 v2 payment-enabled fetch backed by the CDP EVM wallet as signer.
 * Registers the exact EVM scheme for eip155:* (covers Base eip155:8453).
 *
 * @param wallet - CDP EVM wallet provider used as the x402 signer
 * @returns A fetch function that auto-handles HTTP 402 PAYMENT-REQUIRED
 */
function buildPaidFetch(wallet: CdpEvmWalletProvider): typeof fetch {
  const account = wallet.toSigner();
  const signer = {
    ...account,
    readContract: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) =>
      wallet.readContract({
        address: args.address,
        abi: args.abi as never,
        functionName: args.functionName as never,
        args: args.args as never,
      }),
  };

  const client = new x402Client();
  registerExactEvmScheme(client, { signer });

  return wrapFetchWithPayment(fetch, client);
}

/**
 * Unpaid probe: hit the endpoint with no payment and inspect the HTTP 402
 * PAYMENT-REQUIRED body so the agent can see price/network/scheme before paying.
 *
 * @param url - Endpoint to probe
 * @param label - Short label for log output
 * @returns The decoded 402 PAYMENT-REQUIRED body
 */
async function probePaymentRequired(url: string, label: string): Promise<JsonRecord> {
  const res = await fetch(url, { headers: { "X-Agent-Id": AGENT_ID } });
  const body = (await res.json().catch(() => ({}))) as JsonRecord;

  const accepts = Array.isArray(body.accepts) ? (body.accepts as JsonRecord[]) : [];
  log(`probe ${label} (unpaid)`, `HTTP ${res.status} — PAYMENT-REQUIRED`, {
    x402Version: body.x402Version,
    accepts: accepts.map(a => ({
      scheme: a.scheme,
      network: a.network,
      maxAmountRequired: a.maxAmountRequired,
      asset: a.asset,
      payTo: a.payTo,
      resource: a.resource,
    })),
  });

  if (res.status !== 402) {
    throw new Error(`expected HTTP 402 for ${label}, got ${res.status}`);
  }
  if (accepts.length === 0) {
    throw new Error(`402 response for ${label} missing accepts[]`);
  }

  return body;
}

/**
 * Pay-and-retry via x402 v2. The wrapped fetch performs the unpaid request,
 * reads PAYMENT-REQUIRED, signs PAYMENT-SIGNATURE / X-PAYMENT, and retries.
 *
 * @param paidFetch - Payment-enabled fetch from buildPaidFetch
 * @param url - Endpoint to pay for
 * @param label - Short label for log output
 * @returns The HTTP 200 body and the settlement transaction hash
 */
async function payAndRetry(
  paidFetch: typeof fetch,
  url: string,
  label: string,
): Promise<{ body: JsonRecord; tx: string }> {
  const res = await paidFetch(url, { headers: { "X-Agent-Id": AGENT_ID } });
  const body = (await res.json()) as JsonRecord;

  // x402 v2 settlement proof header is `payment-response` (v1 used `x-payment-response`).
  const paymentHeader =
    res.headers.get("payment-response") ?? res.headers.get("x-payment-response");

  let decodedPayment: JsonRecord | undefined;
  if (paymentHeader) {
    try {
      decodedPayment = decodePaymentResponseHeader(paymentHeader) as unknown as JsonRecord;
    } catch {
      decodedPayment = { raw: paymentHeader };
    }
  }

  const receipt = body.receipt as JsonRecord | undefined;
  const tx = String(
    receipt?.transaction ?? decodedPayment?.transaction ?? decodedPayment?.txHash ?? "",
  );

  log(`paid ${label}`, `HTTP ${res.status}`, {
    access: body.access,
    scope: body.scope,
    grantId: body.grantId,
    paid_usd: body.paid_usd,
    pack_type: body.pack_type,
    decision_tree: body.decision_tree,
    default: body.default,
    receipt: body.receipt,
    payment_response_header: decodedPayment,
    tx: tx || null,
    basescan: tx ? basescanUrl(tx) : null,
  });

  if (res.status !== 200) {
    throw new Error(`paid request for ${label} failed: ${res.status}`);
  }
  if (!tx) {
    throw new Error(`no transaction hash in receipt or payment-response header for ${label}`);
  }

  return { body, tx };
}

/**
 * Runs the survival check: probe the sessionless distress door for HTTP 402,
 * inspect requirements, pay $0.01 over x402 v2, and print the settlement receipt.
 */
async function main(): Promise<void> {
  const wallet = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: requireEnv("CDP_API_KEY_ID"),
    apiKeySecret: requireEnv("CDP_API_KEY_SECRET"),
    walletSecret: requireEnv("CDP_WALLET_SECRET"),
    networkId: process.env.NETWORK_ID ?? "base-mainnet",
    address: process.env.ADDRESS as `0x${string}` | undefined,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
  });

  log("0 wallet", "CDP EVM wallet ready", {
    address: wallet.getAddress(),
    network: wallet.getNetwork().networkId,
    note: "Fund this address with Base USDC before the paid step ($0.01 + gas, per paid call)",
  });

  const paidFetch = buildPaidFetch(wallet);

  // Optional pre-payment checklist. Set RUN_SHOULD_I_PAY=1 to buy the checklist
  // before the distress call. Both are $0.01 launch-priced USDC on Base.
  if (process.env.RUN_SHOULD_I_PAY === "1") {
    await probePaymentRequired(SHOULD_I_PAY_URL, "should-i-pay");
    await payAndRetry(paidFetch, SHOULD_I_PAY_URL, "should-i-pay");
  }

  // Canonical sessionless distress door.
  await probePaymentRequired(HELP_ME_URL, "help-me");
  const { tx } = await payAndRetry(paidFetch, HELP_ME_URL, "help-me");

  console.log("\n---");
  console.log("Survival check complete.");
  console.log("BaseScan:", basescanUrl(tx));
  console.log(
    "Apply the returned guidance to your context before paying for expensive x402 tools.",
  );
  console.log("If uncertain, follow `default` in the response body.");
}

if (require.main === module) {
  main().catch(err => {
    console.error("\nFatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
