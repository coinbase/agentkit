import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  AssessPortfolioRiskSchema,
  CalculateKellySchema,
  PriceOptionSchema,
  RecommendHedgeSchema,
  SimulatePortfolioSchema,
} from "./schemas";
import { QUANTORACLE_BASE_URL, USER_AGENT } from "./constants";

/**
 * QuantOracleActionProvider — deterministic quant finance math for AgentKit agents.
 *
 * QuantOracle is a free pay-per-call API serving 73 deterministic financial
 * calculators. This provider exposes the five highest-leverage actions an
 * autonomous trading or finance agent typically needs.
 *
 * Free tier: 1,000 calls/IP/day with no signup or API key (covers
 * price_option, calculate_kelly, simulate_portfolio). Paid composites
 * (assess_portfolio_risk, recommend_hedge) cost $0.04 USDC each, settled
 * via x402 on Base or Solana — AgentKit's wallet pays automatically.
 *
 * @augments ActionProvider
 */
export class QuantOracleActionProvider extends ActionProvider {
  /**
   * Constructor for QuantOracleActionProvider. No configuration required —
   * the free tier covers calculator endpoints, and paid composites use
   * AgentKit's wallet to settle x402 payments.
   */
  constructor() {
    super("quantoracle", []);
  }

  /**
   * Price a European call or put option using Black-Scholes with full Greeks.
   *
   * @param args - Spot price, strike, time to expiry, rate, vol, type
   * @returns Markdown-formatted summary with price, breakeven, and Greeks
   */
  @CreateAction({
    name: "price_option",
    description: `
Price a European call or put option using Black-Scholes with full Greeks.
Returns the option's theoretical price, breakeven, probability ITM, and
all first-order Greeks (delta, gamma, vega, theta, rho).

Use this when:
- Verifying that a market option price is reasonable before placing an order
- Estimating PnL on an existing options position given a view on the underlying
- Computing position deltas for portfolio hedging decisions
- Sizing options trades based on Greek exposures

Inputs: spot price, strike, time to expiry (in years; 30 days = 0.083),
risk-free rate, volatility, option type (call or put).
`,
    schema: PriceOptionSchema,
  })
  async priceOption(args: z.infer<typeof PriceOptionSchema>): Promise<string> {
    try {
      const data = await this.callApi("/v1/options/price", args);
      const ms = (data.ms as number) ?? 0;
      const greeks = (data.greeks as Record<string, number>) ?? {};
      return [
        `**${args.option_type.toUpperCase()} on $${args.S} underlying, $${args.K} strike, ${(args.T * 365).toFixed(0)}d to expiry, ${(args.sigma * 100).toFixed(1)}% IV**`,
        ``,
        `- Price: $${(data.price as number).toFixed(4)}`,
        `- Breakeven: $${(data.breakeven as number).toFixed(2)}`,
        `- Probability ITM: ${((data.prob_itm as number) * 100).toFixed(1)}%`,
        `- Delta: ${greeks.delta.toFixed(4)}`,
        `- Gamma: ${greeks.gamma.toFixed(4)}`,
        `- Vega: ${greeks.vega.toFixed(4)}`,
        `- Theta (per day): ${greeks.theta.toFixed(4)}`,
        `- Rho: ${greeks.rho.toFixed(4)}`,
        ``,
        `_Computed in ${ms.toFixed(0)}ms via QuantOracle._`,
      ].join("\n");
    } catch (err) {
      return `Failed to price option: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Calculate Kelly Criterion optimal bet/position sizing.
   *
   * @param args - Win rate, average win, average loss
   * @returns Markdown-formatted summary with Kelly variants and edge analysis
   */
  @CreateAction({
    name: "calculate_kelly",
    description: `
Calculate Kelly Criterion optimal bet sizing given a strategy's win rate
and average win/loss amounts. Returns the full-, half-, and quarter-Kelly
fractions, the edge per dollar risked, and the payoff ratio.

Use this when:
- Deriving the risk-per-trade fraction for a position-sizing system
- Comparing two strategies head-to-head (higher Kelly = better edge per unit risk)
- Validating that a strategy is positive-expected-value before deploying capital

Most professionals use half- or quarter-Kelly because edge estimates are noisy
and overestimating edge causes severe overbetting.
`,
    schema: CalculateKellySchema,
  })
  async calculateKelly(args: z.infer<typeof CalculateKellySchema>): Promise<string> {
    try {
      const data = await this.callApi("/v1/risk/kelly", { mode: "discrete", ...args });
      const fullKelly = (data.full_kelly as number) * 100;
      const halfKelly = (data.half_kelly as number) * 100;
      const quarterKelly = (data.quarter_kelly as number) * 100;
      const recommendation = (data.recommended as string).replace(/_/g, " ").toLowerCase();
      return [
        `**Kelly sizing for ${(args.win_rate * 100).toFixed(1)}% win rate, $${args.avg_win} avg win, $${args.avg_loss} avg loss**`,
        ``,
        `- Full Kelly: ${fullKelly.toFixed(2)}%`,
        `- Half Kelly: ${halfKelly.toFixed(2)}% _(typical for risk-tolerant)_`,
        `- Quarter Kelly: ${quarterKelly.toFixed(2)}% _(safer; recommended)_`,
        `- Edge: ${(data.edge as number).toFixed(2)}%`,
        `- Payoff ratio: ${(data.payoff_ratio as number).toFixed(2)}×`,
        `- **Recommendation:** ${recommendation}`,
        ``,
        fullKelly < 0
          ? `_Negative edge — this strategy has negative expected value. Do not deploy capital._`
          : `_Computed via QuantOracle._`,
      ].join("\n");
    } catch (err) {
      return `Failed to calculate Kelly: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Run a Monte Carlo portfolio simulation.
   *
   * @param args - Initial value, return/vol assumptions, time horizon, contributions/withdrawals
   * @returns Markdown-formatted summary with distribution percentiles and probability events
   */
  @CreateAction({
    name: "simulate_portfolio",
    description: `
Run a Monte Carlo simulation projecting the distribution of portfolio
outcomes over a chosen time horizon. Returns terminal-value percentiles
(P5/P25/median/P75/P95), probability of loss, probability of doubling,
and probability of ruin under withdrawals.

Use this when:
- Stress-testing a withdrawal-rate plan (e.g. "is 4% sustainable for 30 years?")
- Comparing portfolio strategies head-to-head
- Quantifying sequence-of-returns risk for retirement-style allocations
- Showing a user the realistic range of outcomes (not just expected return)
`,
    schema: SimulatePortfolioSchema,
  })
  async simulatePortfolio(args: z.infer<typeof SimulatePortfolioSchema>): Promise<string> {
    try {
      const data = await this.callApi("/v1/simulate/montecarlo", args);
      const t = data.terminal as Record<string, number>;
      const probLoss = ((data.prob_loss as number) * 100).toFixed(1);
      const probRuin = ((data.prob_ruin as number) * 100).toFixed(2);
      const cagr = ((data.cagr as number) * 100).toFixed(2);
      const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      return [
        `**Monte Carlo: $${args.initial_value.toLocaleString()} over ${args.years} years, ${(args.annual_return * 100).toFixed(1)}% return, ${(args.annual_vol * 100).toFixed(1)}% vol**`,
        ``,
        `_Distribution of terminal outcomes (across ${args.simulations.toLocaleString()} simulated paths):_`,
        `- Median: ${fmt(t.median)}`,
        `- 5th percentile (worst 5%): ${fmt(t.p5)}`,
        `- 95th percentile (best 5%): ${fmt(t.p95)}`,
        `- Median CAGR: ${cagr}%`,
        ``,
        `**Probability events:**`,
        `- Loss vs starting value: ${probLoss}%`,
        `- Probability of ruin (portfolio depleted): ${probRuin}%`,
        ``,
        `_Computed in ${(data.ms as number).toFixed(0)}ms via QuantOracle._`,
      ].join("\n");
    } catch (err) {
      return `Failed to simulate: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Compute a full risk-adjusted-return audit. PAID composite endpoint.
   *
   * @param args - Historical returns array, risk-free rate, annualization factor
   * @returns Markdown-formatted comprehensive risk summary
   */
  @CreateAction({
    name: "assess_portfolio_risk",
    description: `
Run a comprehensive risk audit on a return series. Returns Sharpe ratio,
Sortino ratio, Calmar ratio, max drawdown, VaR (95%/99%), CVaR (Expected
Shortfall), Kelly fraction, and Hurst exponent (regime indicator).

Use this when:
- Evaluating a backtest before deploying real capital
- Auditing an existing strategy's risk-adjusted performance
- Comparing two strategies on multiple risk dimensions in one call
- Generating a one-page risk summary for a stakeholder

PAID composite endpoint: $0.04 per call, settled in USDC via x402 on Base
or Solana. AgentKit's wallet pays automatically — no API key, no signup.
The savings vs running 8 separate calculator calls is meaningful in both
cost and latency.

Requires at least 30 observations of historical returns; 252+ recommended
for statistical significance.
`,
    schema: AssessPortfolioRiskSchema,
  })
  async assessPortfolioRisk(args: z.infer<typeof AssessPortfolioRiskSchema>): Promise<string> {
    try {
      const data = await this.callApi("/v1/risk/full-analysis", args);
      const sharpe = ((data.sharpe as Record<string, number>)?.sharpe_ratio as number) ?? 0;
      const sortino = ((data.sortino as Record<string, number>)?.sortino_ratio as number) ?? 0;
      const calmar = ((data.calmar as Record<string, number>)?.calmar_ratio as number) ?? 0;
      const maxDd = ((data.drawdown as Record<string, number>)?.max_drawdown as number) ?? 0;
      const varObj = (
        data.var as { var_results?: Record<string, { var_pct: number; cvar_pct: number }> }
      )?.var_results?.["95"];
      const var95 = varObj?.var_pct ?? 0;
      const cvar95 = varObj?.cvar_pct ?? 0;
      const kelly = ((data.kelly as Record<string, number>)?.kelly_fraction as number) ?? 0;
      const hurst = ((data.hurst as Record<string, number>)?.hurst_exponent as number) ?? 0;
      return [
        `**Risk audit on ${args.returns.length} observations** _(paid via x402, $0.04 USDC)_`,
        ``,
        `**Risk-adjusted return:**`,
        `- Sharpe ratio: ${sharpe.toFixed(2)}`,
        `- Sortino ratio: ${sortino.toFixed(2)}`,
        `- Calmar ratio: ${calmar.toFixed(2)}`,
        ``,
        `**Tail risk:**`,
        `- Max drawdown: ${(maxDd * 100).toFixed(2)}%`,
        `- VaR (95%): ${var95.toFixed(2)}%`,
        `- CVaR / Expected Shortfall (95%): ${cvar95.toFixed(2)}%`,
        ``,
        `**Sizing & regime:**`,
        `- Kelly fraction: ${(kelly * 100).toFixed(2)}%`,
        `- Hurst exponent: ${hurst.toFixed(3)} ${hurst > 0.6 ? "_(trending)_" : hurst < 0.4 ? "_(mean-reverting)_" : "_(random walk)_"}`,
        ``,
        `_Composite analysis via QuantOracle. Settled on-chain via x402._`,
      ].join("\n");
    } catch (err) {
      return `Failed to assess risk: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Recommend ranked hedge structures. PAID composite endpoint.
   *
   * @param args - Position details and hedge parameters
   * @returns Markdown-formatted ranked list of hedge structures
   */
  @CreateAction({
    name: "recommend_hedge",
    description: `
Recommend ranked hedge structures (collar, protective put, partial put,
inverse) for an existing position. Each recommendation includes the cost
as a percentage of position value, the downside protection floor, and the
upside cap (if any).

Use this when:
- An agent holding a long position wants to limit downside before an event
  (earnings, FOMC, FDA decision) without selling
- An agent needs to compare hedge strategies head-to-head by cost vs protection
- Programmatic risk management of crypto positions ahead of high-vol periods

PAID composite endpoint: $0.04 per call, settled in USDC via x402 on Base or
Solana. AgentKit's wallet pays automatically.
`,
    schema: RecommendHedgeSchema,
  })
  async recommendHedge(args: z.infer<typeof RecommendHedgeSchema>): Promise<string> {
    try {
      const data = await this.callApi("/v1/hedging/recommend", args);
      const structures = (data.structures as Array<Record<string, unknown>>) ?? [];
      const lines: string[] = [
        `**Hedge recommendations for $${args.position_value.toLocaleString()} ${args.position_type} position over ${args.time_horizon_days} days** _(paid via x402, $0.04 USDC)_`,
        ``,
      ];
      for (let i = 0; i < structures.length; i++) {
        const s = structures[i];
        const upsideStr = s.upside_cap
          ? `, upside cap ${((s.upside_cap as number) * 100).toFixed(1)}%`
          : ", unlimited upside";
        lines.push(
          `**${i + 1}. ${s.name as string}** — cost ${((s.cost_pct as number) * 100).toFixed(2)}% ($${(s.cost_dollars as number).toFixed(2)}), floor ${((s.downside_floor as number) * 100).toFixed(1)}%${upsideStr}`,
        );
        if (s.legs) {
          for (const leg of s.legs as Array<Record<string, unknown>>) {
            lines.push(
              `   - ${leg.action as string} ${leg.quantity as number}× ${leg.type as string} @ $${(leg.strike as number).toFixed(2)} (premium $${(leg.premium as number).toFixed(2)})`,
            );
          }
        }
        lines.push(``);
      }
      return lines.join("\n");
    } catch (err) {
      return `Failed to recommend hedge: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * QuantOracle works on any network because the calculations are pure math
   * (no on-chain reads). x402 settlement for paid endpoints works on Base
   * mainnet and Solana mainnet, but the agent's network does not constrain
   * which calculator endpoints can be called.
   *
   * @param _ - The network the agent is operating on (unused)
   * @returns true for any network
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Internal helper. POSTs JSON to a QuantOracle endpoint and returns the
   * parsed response. Throws on non-2xx responses.
   *
   * @param path - Endpoint path beginning with /v1/...
   * @param body - JSON-serializable request body
   * @returns Parsed JSON response
   */
  private async callApi(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${QUANTORACLE_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Source": "agentkit",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = JSON.stringify(j).slice(0, 200);
      } catch {
        // ignore parse errors on error responses
      }
      throw new Error(`QuantOracle ${path} returned ${res.status}: ${detail}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }
}

/**
 * Factory function — returns a configured QuantOracleActionProvider instance.
 *
 * @example
 * ```ts
 * import { quantoracleActionProvider } from "@coinbase/agentkit";
 *
 * const agent = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [quantoracleActionProvider()],
 * });
 * ```
 *
 * @returns Configured QuantOracleActionProvider
 */
export const quantoracleActionProvider = (): QuantOracleActionProvider =>
  new QuantOracleActionProvider();
