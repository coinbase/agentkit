import { z } from "zod";
import { encodeFunctionData, parseUnits, type Address } from "viem";

import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SUPPORTED_NETWORKS,
  LENDING_MATCHER_ADDRESSES,
  LENDING_MATCHER_ABI,
  FACILITATOR_API,
  FACILITATOR_ADDRESSES,
  USDC_DECIMALS,
} from "./constants";
import {
  FloeGetMarketsSchema,
  FloeInstantBorrowSchema,
  FloeRepaySchema,
  FloeCheckStatusSchema,
  FloeGetBalanceSchema,
  FloeCheckHealthSchema,
  FloeGrantDelegationSchema,
  FloeFetchSchema,
} from "./schemas";

/**
 * FloeActionProvider provides working capital for AI agents on Base via the Floe protocol.
 *
 * Unlike variable-rate pool-based protocols (Compound, Morpho, Aave), Floe uses
 * intent-based matching with per-loan isolated escrow. Rates are fixed at match
 * time and never change. Agents can also delegate credit to the Floe facilitator
 * for gas-free x402 API payments.
 */
export class FloeActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly facilitatorApi: string;

  /**
   * Constructs a new FloeActionProvider instance.
   *
   * @param facilitatorApi - Override the default Floe Credit API URL.
   */
  constructor(facilitatorApi: string = FACILITATOR_API) {
    super("floe", []);
    this.facilitatorApi = facilitatorApi;
  }

  /**
   * Checks if the given network is supported by this provider.
   *
   * @param network - The network to check.
   * @returns true if the network is supported.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId ?? "");
  }

  /**
   * Builds auth headers for the Floe Credit API.
   *
   * @param wallet - The wallet provider to sign the auth message.
   * @returns Headers object with wallet address, signature, and timestamp.
   */
  private async buildAuthHeaders(
    wallet: EvmWalletProvider,
  ): Promise<Record<string, string>> {
    const address = await wallet.getAddress();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `Floe Credit API\nTimestamp: ${timestamp}`;
    const signature = await wallet.signMessage(message);
    return {
      "Content-Type": "application/json",
      "X-Wallet-Address": address,
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    };
  }

  /**
   * Helper to call the Floe Credit API.
   *
   * @param path - API path (e.g. "/v1/markets").
   * @param options - Optional method, headers, and body.
   * @returns The fetch Response object.
   */
  private async apiCall(
    path: string,
    options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<Response> {
    const url = `${this.facilitatorApi}${path}`;
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers ?? { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return res;
  }

  // ── Read Actions ──────────────────────────────────────────────────────

  /**
   * Lists available Floe lending markets with current rates and liquidity.
   *
   * @param wallet - The wallet instance.
   * @param args - Empty object.
   * @returns A formatted markdown table of available markets.
   */
  @CreateAction({
    name: "getMarkets",
    description: `
This tool lists available lending markets on the Floe protocol.
Returns available market pairs and collateral types.
Floe offers fixed-rate, fixed-term P2P loans — unlike variable-rate pools.
No parameters needed.
    `,
    schema: FloeGetMarketsSchema,
  })
  async getMarkets(
    _wallet: EvmWalletProvider,
    _args: z.infer<typeof FloeGetMarketsSchema>,
  ): Promise<string> {
    try {
      const res = await this.apiCall("/v1/markets");
      if (!res.ok) {
        return `Error fetching markets: HTTP ${res.status}`;
      }
      const data = await res.json();
      const markets = data.markets || [];
      if (markets.length === 0) {
        return "No active markets found.";
      }

      const lines = ["## Floe Lending Markets\n"];
      lines.push("| Market | Collateral | Loan Token |");
      lines.push("|--------|------------|------------|");
      for (const m of markets) {
        lines.push(`| ${m.collateralSymbol}/${m.loanSymbol} | ${m.collateralSymbol} | ${m.loanSymbol} |`);
      }
      lines.push(
        "\nRates are set by P2P matching — check available offers with `instantBorrow`.",
      );
      return lines.join("\n");
    } catch (error) {
      return `Error fetching markets: ${error}`;
    }
  }

  // ── Write Actions ─────────────────────────────────────────────────────

  /**
   * Borrows USDC instantly by auto-selecting the best available lender.
   *
   * @param wallet - The wallet instance to sign transactions.
   * @param args - Borrow parameters: amount, collateral, max rate, duration.
   * @returns A message with loan details or an error.
   */
  @CreateAction({
    name: "instantBorrow",
    description: `
This tool borrows USDC from Floe by auto-selecting the best available lender.
It takes:
- borrowAmount: USDC to borrow in human-readable format (e.g. '1000')
- collateralAmount: Collateral in human-readable USDC (e.g. '10000' for $10K deposit)
- maxInterestRateBps: Maximum rate in basis points (e.g. '800' for 8% APR)
- duration: Loan duration in seconds (e.g. '1209600' for 14 days)
- marketId: Optional market ID (defaults to USDC/USDC)

For the USDC/USDC market, there is no price-volatility risk — same token
in and out, up to 95% LTV. The rate is FIXED at match time. Collateral
returns automatically on repayment.
    `,
    schema: FloeInstantBorrowSchema,
  })
  async instantBorrow(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeInstantBorrowSchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const borrowRaw = parseUnits(args.borrowAmount, USDC_DECIMALS).toString();
      const collateralRaw = parseUnits(args.collateralAmount, USDC_DECIMALS).toString();

      const res = await this.apiCall("/v1/credit/instant-borrow", {
        method: "POST",
        headers,
        body: {
          borrowAmount: borrowRaw,
          collateralAmount: collateralRaw,
          maxInterestRateBps: parseInt(args.maxInterestRateBps, 10),
          duration: parseInt(args.duration, 10),
          marketId: args.marketId,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        if (res.status === 404) {
          return `No lenders available matching your terms. Try increasing maxInterestRateBps or reducing borrowAmount.`;
        }
        return `Borrow failed: ${err.error || err.message || res.statusText}`;
      }

      const data = await res.json();
      const ratePct = (parseInt(args.maxInterestRateBps, 10) / 100).toFixed(2);
      const durationDays = Math.round(parseInt(args.duration, 10) / 86400);

      return [
        "## Loan Created\n",
        `- **Loan ID**: ${data.loanId}`,
        `- **Borrowed**: ${args.borrowAmount} USDC`,
        `- **Collateral**: ${args.collateralAmount} USDC`,
        `- **Rate**: ≤${ratePct}% APR (fixed)`,
        `- **Duration**: ${durationDays} days`,
        "",
        "Collateral returns automatically on repayment.",
      ].join("\n");
    } catch (error) {
      return `Error borrowing: ${error}`;
    }
  }

  /**
   * Repays a Floe loan. Collateral returns automatically.
   *
   * @param wallet - The wallet instance to sign transactions.
   * @param args - The loan ID and optional slippage tolerance.
   * @returns A confirmation message or error.
   */
  @CreateAction({
    name: "repay",
    description: `
This tool repays a Floe loan. After repayment, collateral returns automatically.
It takes:
- loanId: The on-chain loan ID
- slippageBps: Optional slippage tolerance (default 500 = 5%)
    `,
    schema: FloeRepaySchema,
  })
  async repay(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeRepaySchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const res = await this.apiCall("/v1/credit/repay", {
        method: "POST",
        headers,
        body: {
          loanId: args.loanId,
          slippageBps: parseInt(args.slippageBps ?? "500", 10),
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return `Repay failed: ${err.error || err.message || res.statusText}`;
      }

      return [
        "## Loan Repaid\n",
        `- **Loan ID**: ${args.loanId}`,
        "- **Status**: Fully repaid",
        "- **Collateral**: Returned to your wallet",
      ].join("\n");
    } catch (error) {
      return `Error repaying: ${error}`;
    }
  }

  /**
   * Checks the status of a Floe loan — health, balance, time to expiry.
   *
   * @param wallet - The wallet instance.
   * @param args - The loan ID.
   * @returns A formatted status report.
   */
  @CreateAction({
    name: "checkStatus",
    description: `
This tool checks the status of a Floe loan: remaining principal,
accrued interest, health ratio, time to maturity, and early repayment costs.
It takes:
- loanId: The on-chain loan ID
    `,
    schema: FloeCheckStatusSchema,
  })
  async checkStatus(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeCheckStatusSchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const res = await this.apiCall(`/v1/credit/status/${args.loanId}`, { headers });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return `Status check failed: ${err.error || err.message || res.statusText}`;
      }

      const d = await res.json();
      return [
        `## Loan #${args.loanId} Status\n`,
        `- **Principal remaining**: ${d.remainingPrincipal ?? "N/A"}`,
        `- **Accrued interest**: ${d.accruedInterest ?? "N/A"}`,
        `- **Rate**: ${d.interestRateBps ? `${(d.interestRateBps / 100).toFixed(2)}% APR` : "N/A"}`,
        `- **Health**: ${d.status ?? "N/A"}`,
        `- **Time remaining**: ${d.timeToExpiry ?? "N/A"}`,
      ].join("\n");
    } catch (error) {
      return `Error checking status: ${error}`;
    }
  }

  /**
   * Gets the agent's credit balance from the Floe facilitator.
   *
   * @param wallet - The wallet instance.
   * @param args - Empty object.
   * @returns Credit balance details.
   */
  @CreateAction({
    name: "getBalance",
    description: `
This tool checks the agent's credit balance on the Floe facilitator.
Returns: credit limit, credit used, credit available, active loans.
Only applicable for agents using the Floe x402 facilitator (credit delegation).
No parameters needed.
    `,
    schema: FloeGetBalanceSchema,
  })
  async getBalance(
    wallet: EvmWalletProvider,
    _args: z.infer<typeof FloeGetBalanceSchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const res = await this.apiCall("/v1/agents/balance", { headers });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return `Balance check failed: ${err.error || err.message || res.statusText}`;
      }

      const d = await res.json();
      return [
        "## Credit Balance\n",
        `- **Credit limit**: ${d.creditLimit ?? "N/A"}`,
        `- **Credit used**: ${d.creditUsed ?? "N/A"}`,
        `- **Available**: ${d.creditAvailable ?? "N/A"}`,
        `- **Active loans**: ${d.activeLoans ?? 0}`,
        `- **Delegation**: ${d.delegationActive ? "Active" : "Inactive"}`,
      ].join("\n");
    } catch (error) {
      return `Error checking balance: ${error}`;
    }
  }

  /**
   * Checks the health of a Floe loan via the facilitator API.
   *
   * @param wallet - The wallet instance.
   * @param args - The loan ID.
   * @returns Health assessment with status, LTV, and buffer.
   */
  @CreateAction({
    name: "checkHealth",
    description: `
This tool checks the health of a Floe loan — current LTV,
liquidation threshold, and safety buffer.
It takes:
- loanId: The on-chain loan ID
    `,
    schema: FloeCheckHealthSchema,
  })
  async checkHealth(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeCheckHealthSchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const res = await this.apiCall(`/v1/credit/status/${args.loanId}`, { headers });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return `Health check failed: ${err.error || err.message || res.statusText}`;
      }

      const d = await res.json();
      const status = d.status ?? "unknown";
      const emoji = status === "active" ? "🟢" : status === "overdue" ? "🔴" : "🟡";

      return [
        `## Loan #${args.loanId} Health\n`,
        `- **Status**: ${emoji} ${status}`,
        `- **Current LTV**: ${d.currentLtvBps ? `${(d.currentLtvBps / 100).toFixed(1)}%` : "N/A"}`,
        `- **Liquidation LTV**: ${d.liquidationLtvBps ? `${(d.liquidationLtvBps / 100).toFixed(1)}%` : "N/A"}`,
        d.currentLtvBps && d.liquidationLtvBps
          ? `- **Buffer**: ${((d.liquidationLtvBps - d.currentLtvBps) / 100).toFixed(1)}%`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (error) {
      return `Error checking health: ${error}`;
    }
  }

  /**
   * Grants credit delegation to the Floe facilitator via on-chain setOperator.
   * This is a one-time setup that allows the facilitator to borrow on the
   * agent's behalf for gas-free x402 API payments.
   *
   * @param wallet - The wallet instance to sign the transaction.
   * @param args - Delegation parameters.
   * @returns Confirmation message or error.
   */
  @CreateAction({
    name: "grantDelegation",
    description: `
This tool grants credit delegation to the Floe facilitator by calling
setOperator on the lending contract. This is a ONE-TIME setup that
allows the facilitator to borrow USDC on your behalf for gas-free
x402 API payments.

It takes:
- facilitatorAddress: The Floe facilitator EOA address
- borrowLimit: Maximum USDC the facilitator can borrow (e.g. '10000')
- maxRateBps: Interest rate cap in basis points (e.g. '1500' for 15%)
- expiryDays: How many days the delegation lasts (e.g. '90')

After this, the agent can call x402 APIs via the x402Fetch action
without signing any transactions or paying gas.
    `,
    schema: FloeGrantDelegationSchema,
  })
  async grantDelegation(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeGrantDelegationSchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId ?? "";
      const matcherAddress = LENDING_MATCHER_ADDRESSES[networkId];

      if (!matcherAddress) {
        return `Floe is not supported on network ${networkId}. Supported: ${SUPPORTED_NETWORKS.join(", ")}`;
      }

      const borrowLimitRaw = parseUnits(args.borrowLimit, USDC_DECIMALS);
      const maxRateBps = BigInt(args.maxRateBps);
      const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(args.expiryDays, 10) * 86400);

      // Use provided address or default to the known facilitator for this network
      const facilitator = (args.facilitatorAddress ?? FACILITATOR_ADDRESSES[networkId]) as Address;
      if (!facilitator) {
        return `No facilitator address configured for network ${networkId}. Provide facilitatorAddress explicitly.`;
      }

      // For onBehalfOfRestriction, use the wallet's own address
      // (the facilitator routes USDC to the agent's wallet)
      const agentAddress = (await wallet.getAddress()) as Address;

      const data = encodeFunctionData({
        abi: LENDING_MATCHER_ABI,
        functionName: "setOperator",
        args: [facilitator, borrowLimitRaw, maxRateBps, expiryTimestamp, agentAddress],
      });

      const txHash = await wallet.sendTransaction({
        to: matcherAddress,
        data,
      });

      await wallet.waitForTransactionReceipt(txHash);

      const ratePct = (parseInt(args.maxRateBps, 10) / 100).toFixed(2);

      return [
        "## Credit Delegation Granted\n",
        `- **Facilitator**: ${facilitator}`,
        `- **Borrow limit**: ${args.borrowLimit} USDC`,
        `- **Max rate**: ${ratePct}% APR`,
        `- **Expires in**: ${args.expiryDays} days`,
        `- **Tx**: ${txHash}`,
        "",
        "You can now call x402 APIs via the `x402Fetch` action — gas-free.",
      ].join("\n");
    } catch (error) {
      return `Error granting delegation: ${error}`;
    }
  }

  /**
   * Calls an x402-enabled API via the Floe facilitator. The facilitator
   * handles payment automatically using the agent's delegated credit.
   * Gas-free for the agent.
   *
   * @param wallet - The wallet instance for authentication.
   * @param args - The URL and optional request parameters.
   * @returns The API response content.
   */
  @CreateAction({
    name: "x402Fetch",
    description: `
This tool calls any x402-enabled API via the Floe facilitator proxy.
The facilitator handles USDC payment automatically using your delegated
credit — you pay nothing, sign nothing, and use zero gas.

It takes:
- url: The x402-enabled URL to call
- method: HTTP method (default: GET)
- headers: Additional headers (optional)
- body: Request body (optional)

Requires credit delegation (see grantDelegation) to be set up first.
Works with any of the 13,000+ x402 APIs on Base.
    `,
    schema: FloeFetchSchema,
  })
  async x402Fetch(
    wallet: EvmWalletProvider,
    args: z.infer<typeof FloeFetchSchema>,
  ): Promise<string> {
    try {
      const headers = await this.buildAuthHeaders(wallet);
      const res = await this.apiCall("/v1/proxy/fetch", {
        method: "POST",
        headers,
        body: {
          url: args.url,
          method: args.method ?? "GET",
          headers: args.headers ?? {},
          body: args.body,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const errorCode = err.error || res.statusText;

        // Map common facilitator errors to actionable messages
        if (res.status === 402) {
          return `Insufficient credit balance. Available: ${err.available ?? "unknown"}. Required: ${err.required ?? "unknown"}. Top up collateral or increase delegation limit.`;
        }
        if (res.status === 403) {
          return `Access denied: ${errorCode}. Check that credit delegation is active and not frozen.`;
        }
        return `x402 fetch failed (${res.status}): ${errorCode}`;
      }

      // Check for payment metadata
      const paymentResponse = res.headers.get("payment-response") || res.headers.get("x-payment-response");
      const body = await res.text();

      const lines = ["## x402 Response\n"];
      if (paymentResponse) {
        lines.push(`- **Payment**: Settled via Floe credit`);
        lines.push(`- **Tx**: ${paymentResponse}`);
      } else {
        lines.push(`- **Payment**: None required (passthrough)`);
      }
      lines.push(`- **Status**: ${res.status}`);
      lines.push("");
      lines.push("**Response:**");
      lines.push("```");
      lines.push(body.length > 2000 ? body.slice(0, 2000) + "\n... (truncated)" : body);
      lines.push("```");

      return lines.join("\n");
    } catch (error) {
      return `Error calling x402 API: ${error}`;
    }
  }
}

/**
 * Factory function to create a FloeActionProvider instance.
 *
 * @param facilitatorApi - Optional override for the Floe Credit API URL.
 * @returns A new FloeActionProvider.
 */
export const floeActionProvider = (facilitatorApi?: string) =>
  new FloeActionProvider(facilitatorApi);
