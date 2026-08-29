import { AgentKit, ViemWalletProvider, x402ActionProvider } from "@coinbase/agentkit";
import { createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

type PreflightResult = {
  ok?: boolean;
  warnings?: string[];
  risk_score?: number;
  recommended_action?: string;
  metadata?: Record<string, unknown>;
};

const BLOCKING_WARNINGS = new Set([
  "dead",
  "zombie",
  "decoy_price_extreme",
  "never_paid_zombie",
  "dead_7d",
  "mostly_dead",
]);

/**
 * Reads a required environment variable.
 *
 * @param name - Environment variable name.
 * @returns The configured value.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Parses the maximum x402 payment limit.
 *
 * @returns Maximum payment limit in USDC.
 */
function parseMaxPayment(): number {
  const raw = process.env.MAX_X402_PAYMENT_USDC ?? "1";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("MAX_X402_PAYMENT_USDC must be a positive number");
  }
  return value;
}

/**
 * Resolves the viem chain used by the local wallet provider.
 *
 * @param networkId - Coinbase network ID.
 * @returns The matching viem chain.
 */
function getChain(networkId: string): Chain {
  if (networkId === "base-mainnet") {
    return base;
  }

  if (networkId === "base-sepolia") {
    return baseSepolia;
  }

  throw new Error("NETWORK_ID must be base-mainnet or base-sepolia for this example");
}

/**
 * Calls x402station before any x402 payment is signed.
 *
 * @param url - Candidate x402 endpoint.
 * @returns Machine-readable preflight result.
 */
async function preflightEndpoint(url: string): Promise<PreflightResult> {
  const preflightUrl =
    process.env.X402STATION_PREFLIGHT_URL ?? "https://x402station.io/api/v1/preflight-trial";

  const response = await fetch(preflightUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`x402station preflight failed with HTTP ${response.status}`);
  }

  return (await response.json()) as PreflightResult;
}

/**
 * Fails closed for hard risk signals.
 *
 * @param result - x402station preflight response.
 */
function assertPreflightAllowed(result: PreflightResult): void {
  const warnings = result.warnings ?? [];
  const blocking = warnings.filter(warning => BLOCKING_WARNINGS.has(warning));

  if (blocking.length > 0 || result.ok === false || result.recommended_action === "block") {
    throw new Error(
      [
        "Blocked before PAYMENT-SIGNATURE.",
        `warnings=${JSON.stringify(warnings)}`,
        `risk_score=${result.risk_score ?? "unknown"}`,
        `recommended_action=${result.recommended_action ?? "unknown"}`,
      ].join(" "),
    );
  }
}

/**
 * Runs the end-to-end preflight-before-payment flow.
 */
async function main() {
  const targetUrl = requiredEnv("TARGET_X402_URL");
  const privateKey = requiredEnv("AGENT_PRIVATE_KEY") as `0x${string}`;
  const networkId = process.env.NETWORK_ID ?? "base-mainnet";
  const maxPaymentUsdc = parseMaxPayment();

  const account = privateKeyToAccount(privateKey);
  const chain = getChain(networkId);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(process.env.RPC_URL),
  });
  const walletProvider = new ViemWalletProvider(walletClient, { rpcUrl: process.env.RPC_URL });

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      x402ActionProvider({
        registeredServices: [targetUrl],
        maxPaymentUsdc,
      }),
    ],
  });

  console.log(`AgentKit initialized with ${agentkit.getActions().length} actions.`);
  console.log(`Preflighting ${targetUrl}`);

  const preflight = await preflightEndpoint(targetUrl);
  assertPreflightAllowed(preflight);

  console.log("Preflight passed. Signing is now allowed for this request.");

  const paidRequest = agentkit
    .getActions()
    .find(action => action.name === "X402ActionProvider_make_http_request_with_x402");

  if (!paidRequest) {
    throw new Error("AgentKit x402 payment action is unavailable for this wallet network");
  }

  const result = await paidRequest.invoke({
    url: targetUrl,
    method: "GET",
    headers: {
      accept: "application/json",
      "x-agentkit-example": "x402station-preflight",
      "x-agentkit-network": networkId,
    },
    queryParams: null,
    body: null,
  });

  console.log(result);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
