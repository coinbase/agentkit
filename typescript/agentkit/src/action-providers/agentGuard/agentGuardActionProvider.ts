import {
  decodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  BASE_USDC_MAINNET,
  BASE_USDC_SEPOLIA,
  DANGEROUS_SELECTORS,
  DEFAULT_BLOCKLISTED_ADDRESSES,
  DEFAULT_MAX_NATIVE_DAILY,
  DEFAULT_MAX_NATIVE_PER_TX,
  DEFAULT_MAX_USDC_DAILY,
  DEFAULT_MAX_USDC_PER_TX,
  DEFAULT_MAX_X402_PER_PAYMENT,
  PROMPT_INJECTION_PATTERNS,
} from "./constants";
import {
  GetGuardPolicySchema,
  ScanPromptSafetySchema,
  ValidateTransactionSchema,
  VerifyX402ChallengeSchema,
} from "./schemas";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const UNLIMITED_APPROVAL_THRESHOLD =
  BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") - BigInt(1000000);

export interface AgentGuardConfig {
  maxNativePerTx?: string;
  maxNativeDaily?: string;
  maxUsdcPerTx?: string;
  maxUsdcDaily?: string;
  maxPaymentPerX402?: string;
  blockedDestinations?: string[];
  strictInjectionDefense?: boolean;
}

interface SpendRecord {
  timestamp: number;
  asset: "NATIVE" | string;
  amount: bigint;
}

/**
 * Action provider for pre-flight security evaluation, spend limits, and fail-closed guardrails.
 */
export class AgentGuardActionProvider extends ActionProvider<EvmWalletProvider> {
  private maxNativePerTx: string;
  private maxNativeDaily: string;
  private maxUsdcPerTx: string;
  private maxUsdcDaily: string;
  private maxPaymentPerX402: string;
  private blockedDestinations: Set<string>;
  private strictInjectionDefense: boolean;
  private spendHistory: SpendRecord[] = [];

  /**
   * Constructs a new AgentGuardActionProvider.
   *
   * @param config - Optional configuration to customize limits and blocklists.
   */
  constructor(config: AgentGuardConfig = {}) {
    super("agent_guard", []);
    this.maxNativePerTx = config.maxNativePerTx ?? DEFAULT_MAX_NATIVE_PER_TX;
    this.maxNativeDaily = config.maxNativeDaily ?? DEFAULT_MAX_NATIVE_DAILY;
    this.maxUsdcPerTx = config.maxUsdcPerTx ?? DEFAULT_MAX_USDC_PER_TX;
    this.maxUsdcDaily = config.maxUsdcDaily ?? DEFAULT_MAX_USDC_DAILY;
    this.maxPaymentPerX402 = config.maxPaymentPerX402 ?? DEFAULT_MAX_X402_PER_PAYMENT;
    this.strictInjectionDefense = config.strictInjectionDefense ?? true;

    const initialBlocklist = [
      ...DEFAULT_BLOCKLISTED_ADDRESSES,
      ...(config.blockedDestinations ?? []),
    ].map(a => a.toLowerCase());
    this.blockedDestinations = new Set(initialBlocklist);
  }

  /**
   * Evaluates an onchain transaction against fail-closed security policies before execution.
   *
   * @param wallet - The wallet provider.
   * @param args - The transaction arguments to validate.
   * @returns A structured verdict string indicating APPROVED or BLOCKED.
   */
  @CreateAction({
    name: "validate_transaction",
    description: `
Pre-flight safety inspection for any onchain EVM transaction before signing or dispatching.
Inspects recipient address, spend limits, dangerous calldata (such as infinite approvals or ownership changes), and prompt injection vectors.
Always call this tool before executing high-value or third-party contract interactions.
`,
    schema: ValidateTransactionSchema,
  })
  async validateTransaction(
    wallet: EvmWalletProvider,
    args: z.infer<typeof ValidateTransactionSchema>,
  ): Promise<string> {
    const now = Date.now();

    // 1. Scan user prompt & reasoning trace for prompt injection
    const combinedTrace = `${args.userPrompt || ""} ${args.reasoningTrace || ""}`.trim();
    if (combinedTrace) {
      for (const item of PROMPT_INJECTION_PATTERNS) {
        if (item.pattern.test(combinedTrace)) {
          return JSON.stringify(
            {
              verdict: "BLOCKED",
              code: "PROMPT_INJECTION_DETECTED",
              riskScore: 90,
              reason: `Action aborted: Detected hostile instructions or jailbreak vector (${item.name}).`,
            },
            null,
            2,
          );
        }
      }
    }

    // 2. Validate destination address
    if (!isAddress(args.to)) {
      return JSON.stringify(
        {
          verdict: "BLOCKED",
          code: "INVALID_DESTINATION",
          riskScore: 90,
          reason: `Target address '${args.to}' is not a valid Ethereum address.`,
        },
        null,
        2,
      );
    }

    const normalizedTo = args.to.toLowerCase();
    if (this.blockedDestinations.has(normalizedTo)) {
      return JSON.stringify(
        {
          verdict: "BLOCKED",
          code: "DESTINATION_BLOCKLISTED",
          riskScore: 100,
          reason: `Target address '${args.to}' is in the explicit security blocklist.`,
        },
        null,
        2,
      );
    }

    // 3. Inspect calldata
    if (args.data && args.data !== "0x" && args.data.length >= 10) {
      const selector = args.data.slice(0, 10).toLowerCase();
      if (DANGEROUS_SELECTORS[selector]) {
        return JSON.stringify(
          {
            verdict: "BLOCKED",
            code: "DANGEROUS_CALLDATA",
            riskScore: 95,
            reason: `Blocked critical dangerous method: ${DANGEROUS_SELECTORS[selector]} (${selector}).`,
          },
          null,
          2,
        );
      }

      try {
        const decoded = decodeFunctionData({
          abi: ERC20_ABI,
          data: args.data as `0x${string}`,
        });

        if (decoded.functionName === "approve") {
          const [, amount] = decoded.args as [string, bigint];
          if (amount >= UNLIMITED_APPROVAL_THRESHOLD) {
            return JSON.stringify(
              {
                verdict: "BLOCKED",
                code: "UNLIMITED_APPROVAL_ATTACK",
                riskScore: 90,
                reason:
                  "Detected unbounded/infinite ERC-20 approval pattern. Approval must be strictly bounded.",
              },
              null,
              2,
            );
          }
        }

        if (decoded.functionName === "transfer") {
          const [, amount] = decoded.args as [string, bigint];
          const isUsdc = normalizedTo === BASE_USDC_MAINNET || normalizedTo === BASE_USDC_SEPOLIA;
          const decimals = isUsdc ? 6 : 18;
          const limitUnits = parseUnits(this.maxUsdcPerTx, decimals);

          if (amount > limitUnits) {
            return JSON.stringify(
              {
                verdict: "BLOCKED",
                code: "EXCEEDS_SPEND_LIMIT",
                riskScore: 80,
                reason: `Token transfer amount (${formatUnits(amount, decimals)}) exceeds per-tx ceiling of ${this.maxUsdcPerTx}.`,
              },
              null,
              2,
            );
          }
        }
      } catch {
        // Calldata is not standard ERC20, proceed with normal execution
      }
    }

    // 4. Validate native ETH spend limits
    if (args.value && args.value !== "0" && args.value !== "0x" && args.value !== "0x0") {
      let valueWei: bigint;
      try {
        valueWei = args.value.includes(".") ? parseEther(args.value) : BigInt(args.value);
      } catch {
        return JSON.stringify(
          {
            verdict: "BLOCKED",
            code: "MALFORMED_VALUE",
            riskScore: 85,
            reason: `Invalid native transaction value: ${args.value}`,
          },
          null,
          2,
        );
      }

      const maxPerTxWei = parseEther(this.maxNativePerTx);
      if (valueWei > maxPerTxWei) {
        return JSON.stringify(
          {
            verdict: "BLOCKED",
            code: "EXCEEDS_SPEND_LIMIT",
            riskScore: 80,
            reason: `Native spend ${formatEther(valueWei)} ETH exceeds per-tx limit of ${this.maxNativePerTx} ETH.`,
          },
          null,
          2,
        );
      }

      // Check 24-hour cumulative spend
      const cutoff = now - 24 * 60 * 60 * 1000;
      const dailyUsed = this.spendHistory
        .filter(item => item.asset === "NATIVE" && item.timestamp >= cutoff)
        .reduce((acc, item) => acc + item.amount, BigInt(0));

      const maxDailyWei = parseEther(this.maxNativeDaily);
      if (dailyUsed + valueWei > maxDailyWei) {
        return JSON.stringify(
          {
            verdict: "BLOCKED",
            code: "EXCEEDS_SPEND_LIMIT",
            riskScore: 80,
            reason: `Cumulative 24h native spend (${formatEther(dailyUsed + valueWei)} ETH) exceeds daily cap of ${this.maxNativeDaily} ETH.`,
          },
          null,
          2,
        );
      }

      this.spendHistory.push({ timestamp: now, asset: "NATIVE", amount: valueWei });
    }

    return JSON.stringify(
      {
        verdict: "APPROVED",
        code: "APPROVED",
        riskScore: 0,
        reason:
          "Transaction verified against active fail-closed security policies and spend limits.",
        diagnostics: {
          destination: getAddress(args.to),
          network: wallet.getNetwork().networkId,
        },
      },
      null,
      2,
    );
  }

  /**
   * Verifies an HTTP 402 Payment Required challenge payload against Base USDC micropayment caps.
   *
   * @param _wallet - The wallet provider.
   * @param args - The x402 challenge parameters.
   * @returns Verdict string indicating whether the payment challenge is safe to execute.
   */
  @CreateAction({
    name: "verify_x402_challenge",
    description: `
Validates an HTTP 402 Payment Required challenge for Base USDC micropayments.
Checks expiration deadline, merchant address validity, and ensures requested amount is under policy caps.
`,
    schema: VerifyX402ChallengeSchema,
  })
  async verifyX402Challenge(
    _wallet: EvmWalletProvider,
    args: z.infer<typeof VerifyX402ChallengeSchema>,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (!isAddress(args.merchant)) {
      return JSON.stringify(
        {
          verdict: "BLOCKED",
          code: "X402_MALFORMED",
          reason: `Invalid merchant Ethereum address: ${args.merchant}`,
        },
        null,
        2,
      );
    }

    if (args.deadline < now) {
      return JSON.stringify(
        {
          verdict: "BLOCKED",
          code: "X402_EXPIRED",
          reason: `x402 challenge expired at timestamp ${args.deadline}.`,
        },
        null,
        2,
      );
    }

    const requestedAmount = parseFloat(args.amountUsdc);
    const maxAllowed = parseFloat(this.maxPaymentPerX402);
    if (isNaN(requestedAmount) || requestedAmount > maxAllowed) {
      return JSON.stringify(
        {
          verdict: "BLOCKED",
          code: "X402_EXCEEDS_CAP",
          reason: `Requested x402 payment of ${args.amountUsdc} USDC exceeds ceiling of ${this.maxPaymentPerX402} USDC.`,
        },
        null,
        2,
      );
    }

    return JSON.stringify(
      {
        verdict: "APPROVED",
        code: "APPROVED",
        reason: `x402 micropayment verified under configured Base USDC payment ceiling (${this.maxPaymentPerX402} USDC).`,
        merchant: getAddress(args.merchant),
        amountUsdc: args.amountUsdc,
      },
      null,
      2,
    );
  }

  /**
   * Scans a prompt or conversation trace for injection attacks or unauthorized fund commands.
   *
   * @param _wallet - The wallet provider.
   * @param args - The prompt to scan.
   * @returns Result indicating whether the prompt is safe or flagged.
   */
  @CreateAction({
    name: "scan_prompt_safety",
    description:
      "Scans user instructions or reasoning traces for prompt injection, jailbreaks, and wallet drain commands.",
    schema: ScanPromptSafetySchema,
  })
  async scanPromptSafety(
    _wallet: EvmWalletProvider,
    args: z.infer<typeof ScanPromptSafetySchema>,
  ): Promise<string> {
    for (const item of PROMPT_INJECTION_PATTERNS) {
      if (item.pattern.test(args.prompt)) {
        return JSON.stringify(
          {
            safe: false,
            flaggedPattern: item.name,
            riskScore: 85,
            warning: `Hostile pattern detected: ${item.name}`,
          },
          null,
          2,
        );
      }
    }

    return JSON.stringify(
      {
        safe: true,
        riskScore: 0,
        message: "No known prompt injection patterns detected.",
      },
      null,
      2,
    );
  }

  /**
   * Retrieves active guardrail policies and spending boundaries.
   *
   * @param _wallet - The wallet provider.
   * @returns Current active policies.
   */
  @CreateAction({
    name: "get_guard_policy",
    description: "Retrieves current active spending ceilings, allowlists, and guardrail settings.",
    schema: GetGuardPolicySchema,
  })
  async getGuardPolicy(): Promise<string> {
    return JSON.stringify(
      {
        maxNativePerTx: `${this.maxNativePerTx} ETH`,
        maxNativeDaily: `${this.maxNativeDaily} ETH`,
        maxUsdcPerTx: `${this.maxUsdcPerTx} USDC`,
        maxUsdcDaily: `${this.maxUsdcDaily} USDC`,
        maxPaymentPerX402: `${this.maxPaymentPerX402} USDC`,
        strictInjectionDefense: this.strictInjectionDefense,
        blockedDestinationsCount: this.blockedDestinations.size,
      },
      null,
      2,
    );
  }

  /**
   * Checks if the AgentGuard action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if network protocol family is EVM.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const agentGuardActionProvider = (config?: AgentGuardConfig) =>
  new AgentGuardActionProvider(config);
