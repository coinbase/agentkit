import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { SimulateAndGuardInputSchema } from "./schemas";

/** Default endpoint of the Automaton Pre-Flight AI Firewall. */
export const AUTOMATON_FIREWALL_URL = "https://api.automaton-sovereign.workers.dev";
/** The only network, asset and payee this provider will ever sign for. A hostile 402 cannot widen them. */
export const AUTOMATON_FIREWALL_NETWORK = "eip155:8453";
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const AUTOMATON_PAY_TO = "0x71DEAc098914A009E3720524642A6bE6F65EE528";
/** Default per-call signing cap in USDC base units (20000 = 0.02 USDC, the advertised price). */
export const DEFAULT_MAX_AMOUNT_UNITS = 20000;

const SIMULATE_PATH = "/v2/firewall/simulate-tx";

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/**
 * Configuration for the Automaton Firewall action provider.
 */
export interface AutomatonFirewallConfig {
  /** Base URL of the firewall service. Defaults to AUTOMATON_FIREWALL_URL. */
  baseUrl?: string;
  /** Maximum USDC base units the provider will sign for per call. Defaults to 20000 (0.02 USDC). */
  maxAmountUnits?: number;
}

/** One x402 `accepts[]` entry, as far as this provider reads it. */
interface PaymentRequirement {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  maxAmountRequired?: string;
  payTo?: string;
}

/**
 * A 402 challenge that failed one of the guards. Carries a stable code for the agent.
 */
class PaymentGuardError extends Error {
  /**
   * Creates a new PaymentGuardError.
   *
   * @param code - Stable machine-readable reason.
   * @param message - Human-readable detail.
   */
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Selects the payment requirement this provider is willing to sign, or throws before anything is signed.
 * It must be `exact` on Base, in native USDC, for a positive amount at or below the cap, paid to the
 * Automaton treasury.
 *
 * @param challenge - The decoded x402 402 challenge.
 * @param maxAmountUnits - The signing cap in USDC base units.
 * @returns The selected requirement and its amount.
 */
export function pickRequirement(
  challenge: unknown,
  maxAmountUnits: number,
): { requirement: PaymentRequirement; amount: bigint } {
  const accepts = (challenge as { accepts?: unknown })?.accepts;
  const list: PaymentRequirement[] = Array.isArray(accepts) ? accepts : [];
  const requirement = list.find(
    a =>
      !!a &&
      a.scheme === "exact" &&
      a.network === AUTOMATON_FIREWALL_NETWORK &&
      String(a.asset).toLowerCase() === USDC_BASE.toLowerCase(),
  );
  if (!requirement) {
    throw new PaymentGuardError(
      "no_supported_requirement",
      "challenge has no exact / eip155:8453 / USDC requirement",
    );
  }

  let amount: bigint;
  try {
    amount = BigInt(requirement.amount || requirement.maxAmountRequired || "0");
  } catch {
    throw new PaymentGuardError("bad_amount", "requirement amount is not an integer");
  }
  if (amount <= 0n) {
    throw new PaymentGuardError("bad_amount", "requirement amount is not positive");
  }
  if (!Number.isSafeInteger(maxAmountUnits) || maxAmountUnits <= 0) {
    throw new PaymentGuardError("bad_cap", "maxAmountUnits must be a positive integer");
  }
  if (amount > BigInt(maxAmountUnits)) {
    throw new PaymentGuardError(
      "amount_above_cap",
      `requirement ${amount} units exceeds cap ${maxAmountUnits}`,
    );
  }
  if (String(requirement.payTo || "").toLowerCase() !== AUTOMATON_PAY_TO.toLowerCase()) {
    throw new PaymentGuardError(
      "payto_not_allowed",
      `payTo ${requirement.payTo} is not the Automaton treasury`,
    );
  }
  return { requirement, amount };
}

/**
 * Reads the x402 challenge from the `payment-required` header, falling back to the response body.
 *
 * @param response - The 402 response.
 * @returns The decoded challenge, or null.
 */
async function readChallenge(response: Response): Promise<unknown> {
  const header = response.headers.get("payment-required");
  if (header) {
    try {
      return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    } catch {
      // fall through to the body
    }
  }
  return response.json().catch(() => null);
}

/**
 * AutomatonFirewallActionProvider provides a pre-flight check an agent runs before it sends a
 * transaction on Base: revert simulation, token honeypot / transfer-tax checks and a safe-slippage
 * bound, from the Automaton Pre-Flight AI Firewall, paid per call via x402.
 */
export class AutomatonFirewallActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxAmountUnits: number;

  /**
   * Constructs a new AutomatonFirewallActionProvider.
   *
   * @param config - Optional endpoint and signing cap.
   */
  constructor(config: AutomatonFirewallConfig = {}) {
    super("automaton_firewall", []);
    this.baseUrl = (config.baseUrl || AUTOMATON_FIREWALL_URL).replace(/\/+$/, "");
    this.maxAmountUnits = config.maxAmountUnits ?? DEFAULT_MAX_AMOUNT_UNITS;
  }

  /**
   * Simulates a transaction before the agent sends it and returns the firewall verdict.
   *
   * @param walletProvider - The wallet that pays for the call (EIP-3009, no gas needed).
   * @param args - The transaction to check.
   * @returns The verdict, or an explicit refused / unavailable state, as stringified JSON.
   */
  @CreateAction({
    name: "simulate_and_guard_transaction",
    description: `
This tool simulates an Ethereum transaction on Base BEFORE the agent sends it, using the Automaton Pre-Flight AI Firewall.
It checks whether the call would revert, estimates gas, scans the target and token bytecode for honeypot traps and transfer taxes, and returns a safe slippage bound.
Call it before any swap, trade or contract interaction.

It takes:
- targetContract: the contract the transaction calls
- calldata: the exact calldata the agent is about to send
- fromAddress, valueWei, tokenAddress: optional

It returns a verdict of SAFE, WARNING or REJECT with a risk score, simulation result, token safety and execution protection.
Each call costs 0.02 USDC on Base, paid with an EIP-3009 signature from the agent wallet (no ETH needed). The provider refuses to sign above its configured cap, or for any network, asset or recipient other than USDC on Base to the Automaton treasury.
If the result has status "payment_refused" or "unavailable", no verdict was produced: do not treat it as SAFE or as REJECT.
`,
    schema: SimulateAndGuardInputSchema,
  })
  async simulateAndGuardTransaction(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SimulateAndGuardInputSchema>,
  ): Promise<string> {
    const endpoint = this.baseUrl + SIMULATE_PATH;
    const body = JSON.stringify({
      targetContract: args.targetContract,
      calldata: args.calldata ?? "0x",
      valueWei: args.valueWei ?? "0",
      ...(args.fromAddress ? { fromAddress: args.fromAddress } : {}),
      ...(args.tokenAddress ? { tokenAddress: args.tokenAddress } : {}),
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.status !== 402) {
        return JSON.stringify(await response.json());
      }

      const challenge = await readChallenge(response);
      let picked: { requirement: PaymentRequirement; amount: bigint };
      try {
        picked = pickRequirement(challenge, this.maxAmountUnits);
      } catch (error) {
        if (!(error instanceof PaymentGuardError)) throw error;
        // Refusing to pay is not a verdict on the transaction: no verdict, no risk number.
        return JSON.stringify({
          status: "payment_refused",
          verdict: null,
          riskScore: null,
          error: error.code,
          message: error.message,
        });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const nonce = ("0x" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")) as `0x${string}`;
      const authorization = {
        from: walletProvider.getAddress(),
        to: picked.requirement.payTo as string,
        value: picked.amount.toString(),
        validAfter: String(nowSec - 60),
        validBefore: String(nowSec + 3600),
        nonce,
      };

      const signature = await walletProvider.signTypedData({
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: 8453,
          verifyingContract: picked.requirement.asset as `0x${string}`,
        },
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: "TransferWithAuthorization",
        message: authorization,
      });

      // FLAT envelope: the six authorization fields in `payload`, the signature on top. This is the shape
      // the service verifies on X-PAYMENT-AUTH; the same value also goes in X-PAYMENT.
      const paymentHeader = Buffer.from(
        JSON.stringify({
          x402Version: 2,
          scheme: "exact",
          network: picked.requirement.network,
          payload: authorization,
          signature,
        }),
      ).toString("base64");

      const paidResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-AUTH": paymentHeader,
          "X-PAYMENT": paymentHeader,
        },
        body,
      });
      return JSON.stringify(await paidResponse.json());
    } catch (error) {
      // The firewall did not run: report unavailability, never a REJECT or an invented risk score.
      return JSON.stringify({
        status: "unavailable",
        verdict: null,
        riskScore: null,
        error: "firewall_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks if the action provider supports the given network. The service only settles on Base mainnet.
   *
   * @param network - The network to check.
   * @returns True for Base mainnet (EVM), false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";
}

export const automatonFirewallActionProvider = (config?: AutomatonFirewallConfig) =>
  new AutomatonFirewallActionProvider(config);
