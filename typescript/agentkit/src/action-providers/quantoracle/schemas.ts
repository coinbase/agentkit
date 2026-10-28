import { z } from "zod";

/**
 * Input schema for the price_option action — Black-Scholes option pricing.
 */
export const PriceOptionSchema = z
  .object({
    S: z.number().positive().describe("Spot price of the underlying"),
    K: z.number().positive().describe("Strike price"),
    T: z.number().positive().describe("Time to expiry in years (0.083 = 30 days)"),
    r: z.number().describe("Risk-free interest rate as decimal (0.05 = 5%)"),
    sigma: z.number().positive().describe("Annualized volatility as decimal (0.28 = 28%)"),
    option_type: z.enum(["call", "put"]).default("call").describe("Option type — call or put"),
  })
  .describe(
    "Black-Scholes option pricing with full Greeks. Returns price, breakeven, probability ITM, and all first-order Greeks (delta, gamma, vega, theta, rho).",
  );

/**
 * Input schema for the calculate_kelly action — discrete-bet Kelly Criterion.
 */
export const CalculateKellySchema = z
  .object({
    win_rate: z.number().min(0.01).max(0.99).describe("Probability of winning (0-1)"),
    avg_win: z.number().positive().describe("Average dollar amount won on winning trades"),
    avg_loss: z
      .number()
      .positive()
      .describe("Average dollar amount lost on losing trades (positive number)"),
  })
  .describe(
    "Kelly Criterion optimal bet sizing. Returns full-, half-, and quarter-Kelly fractions plus edge and payoff ratio. Use half- or quarter-Kelly in real trading because edge estimates are noisy.",
  );

/**
 * Input schema for the simulate_portfolio action — Monte Carlo simulation.
 */
export const SimulatePortfolioSchema = z
  .object({
    initial_value: z.number().positive().describe("Starting portfolio value"),
    annual_return: z.number().describe("Expected annual return as decimal (0.08 = 8%)"),
    annual_vol: z.number().positive().describe("Annual volatility as decimal (0.18 = 18%)"),
    years: z.number().positive().describe("Time horizon in years"),
    simulations: z
      .number()
      .int()
      .min(100)
      .max(10000)
      .default(1000)
      .describe("Number of Monte Carlo paths (1000-2500 typical)"),
    contributions: z
      .number()
      .min(0)
      .default(0)
      .describe("Annual contribution amount (set 0 if none)"),
    withdrawal_rate: z
      .number()
      .min(0)
      .max(0.5)
      .default(0)
      .describe("Annual withdrawal rate as decimal (0.04 = 4%)"),
  })
  .describe(
    "Monte Carlo portfolio simulation. Returns distribution of terminal outcomes (P5/P25/median/P75/P95), probability of loss, probability of doubling, and probability of ruin under withdrawals.",
  );

/**
 * Input schema for the assess_portfolio_risk action — composite risk audit.
 */
export const AssessPortfolioRiskSchema = z
  .object({
    returns: z
      .array(z.number())
      .min(30)
      .describe(
        "Array of historical periodic returns as decimals (0.012 = 1.2%). Daily returns assumed; minimum 30 observations.",
      ),
    risk_free_rate: z
      .number()
      .default(0.04)
      .describe("Annual risk-free rate as decimal (0.04 = 4%)"),
    annualization_factor: z
      .number()
      .int()
      .default(252)
      .describe("252 for daily returns, 52 for weekly, 12 for monthly"),
  })
  .describe(
    "Composite full risk analysis: Sharpe, Sortino, Calmar, max drawdown, VaR, CVaR, Hurst exponent, and Kelly. PAID endpoint ($0.04 per call, settled in USDC). AgentKit's wallet pays automatically.",
  );

/**
 * Input schema for the recommend_hedge action — ranked hedge structures.
 */
export const RecommendHedgeSchema = z
  .object({
    position_type: z
      .enum(["long_stock", "short_stock", "long_crypto", "long_options"])
      .describe("Type of position to hedge"),
    position_value: z.number().positive().describe("Current dollar value of the position"),
    asset_price: z.number().positive().describe("Current spot price of the underlying"),
    volatility: z
      .number()
      .positive()
      .describe("Annualized volatility of the underlying as decimal (0.28 = 28%)"),
    time_horizon_days: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Hedge time horizon in days"),
    max_hedge_cost_pct: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.05)
      .describe("Maximum hedge cost as fraction of position (0.05 = 5%)"),
    r: z.number().default(0.05).describe("Risk-free rate as decimal"),
  })
  .describe(
    "Recommend ranked hedge structures (collar, protective put, partial put, inverse) for an existing position. Returns each structure's cost, downside protection, and upside cap. PAID endpoint ($0.04 per call, settled in USDC). AgentKit's wallet pays automatically.",
  );
