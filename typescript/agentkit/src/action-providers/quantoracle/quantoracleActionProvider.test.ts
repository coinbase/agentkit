import { quantoracleActionProvider, QuantOracleActionProvider } from "./quantoracleActionProvider";
import { QUANTORACLE_BASE_URL } from "./constants";

const MOCK_PRICE_RESPONSE = {
  price: 4.615,
  intrinsic: 0,
  time_value: 4.615,
  breakeven: 104.615,
  prob_itm: 0.5299,
  greeks: {
    delta: 0.56946,
    gamma: 0.039288,
    theta: -0.028696,
    vega: 0.19644,
    rho: 0.130828,
  },
  d1: 0.175,
  d2: 0.075,
  ms: 19.84,
};

const MOCK_KELLY_RESPONSE = {
  full_kelly: 0.25,
  half_kelly: 0.125,
  quarter_kelly: 0.0625,
  edge: 37.5,
  payoff_ratio: 1.5,
  recommended: "QUARTER_KELLY",
  ms: 17.09,
};

const MOCK_KELLY_NEGATIVE_RESPONSE = {
  full_kelly: -0.05,
  half_kelly: -0.025,
  quarter_kelly: -0.0125,
  edge: -5,
  payoff_ratio: 0.8,
  recommended: "QUARTER_KELLY",
  ms: 12,
};

const MOCK_MC_RESPONSE = {
  terminal: {
    mean: 219417.91,
    median: 184473.98,
    p5: 62105.06,
    p25: 116413.12,
    p75: 277432.19,
    p95: 508381.34,
  },
  prob_loss: 0.18,
  prob_double: 0.443,
  prob_ruin: 0,
  cagr: 0.0818,
  sample_paths: [],
  ms: 2912.96,
};

const MOCK_RISK_ANALYSIS_RESPONSE = {
  sharpe: { sharpe_ratio: 1.42 },
  sortino: { sortino_ratio: 2.18 },
  calmar: { calmar_ratio: 0.85 },
  drawdown: { max_drawdown: -0.18 },
  var: {
    var_results: {
      "95": { var_pct: 1.61, cvar_pct: 2.15 },
      "99": { var_pct: 2.5, cvar_pct: 2.94 },
    },
  },
  kelly: { kelly_fraction: 0.32 },
  hurst: { hurst_exponent: 0.55 },
};

const MOCK_HEDGE_RESPONSE = {
  structures: [
    {
      name: "Collar",
      cost_pct: 0.0061,
      cost_dollars: 613,
      downside_floor: -0.05,
      upside_cap: 0.1,
      legs: [
        {
          action: "buy",
          quantity: 1,
          type: "put",
          strike: 175.75,
          premium: 4.5,
        },
        {
          action: "sell",
          quantity: 1,
          type: "call",
          strike: 203.5,
          premium: 3.88,
        },
      ],
    },
  ],
};

describe("QuantOracleActionProvider", () => {
  let provider: QuantOracleActionProvider;

  beforeEach(() => {
    provider = quantoracleActionProvider();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates an instance without configuration", () => {
      const p = quantoracleActionProvider();
      expect(p).toBeInstanceOf(QuantOracleActionProvider);
    });

    it("supports any network", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm" } as never)).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" } as never)).toBe(true);
    });
  });

  describe("priceOption", () => {
    it("calls the /v1/options/price endpoint with the right body", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_PRICE_RESPONSE,
      } as Response);

      const result = await provider.priceOption({
        S: 100,
        K: 100,
        T: 0.25,
        r: 0.05,
        sigma: 0.2,
        option_type: "call",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `${QUANTORACLE_BASE_URL}/v1/options/price`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
      expect(result).toContain("CALL");
      expect(result).toContain("$4.6150");
      expect(result).toContain("Delta: 0.5695");
    });

    it("returns an error message when the API fails", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "internal" }),
      } as Response);

      const result = await provider.priceOption({
        S: 100,
        K: 100,
        T: 0.25,
        r: 0.05,
        sigma: 0.2,
        option_type: "call",
      });

      expect(result).toContain("Failed to price option");
    });
  });

  describe("calculateKelly", () => {
    it("returns Kelly variants for a positive-edge strategy", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_KELLY_RESPONSE,
      } as Response);

      const result = await provider.calculateKelly({
        win_rate: 0.55,
        avg_win: 150,
        avg_loss: 100,
      });

      expect(result).toContain("Full Kelly: 25.00%");
      expect(result).toContain("Half Kelly: 12.50%");
      expect(result).toContain("Quarter Kelly: 6.25%");
      expect(result).toContain("quarter kelly");
    });

    it("warns about negative edge", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_KELLY_NEGATIVE_RESPONSE,
      } as Response);

      const result = await provider.calculateKelly({
        win_rate: 0.45,
        avg_win: 100,
        avg_loss: 120,
      });

      expect(result).toContain("Negative edge");
      expect(result).toContain("Do not deploy capital");
    });
  });

  describe("simulatePortfolio", () => {
    it("returns terminal-distribution and probability events", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_MC_RESPONSE,
      } as Response);

      const result = await provider.simulatePortfolio({
        initial_value: 100000,
        annual_return: 0.08,
        annual_vol: 0.18,
        years: 20,
        simulations: 1000,
        contributions: 0,
        withdrawal_rate: 0,
      });

      expect(result).toContain("Median: $184,474");
      expect(result).toContain("Loss vs starting value: 18.0%");
      expect(result).toContain("Probability of ruin");
    });
  });

  describe("assessPortfolioRisk", () => {
    it("surfaces Sharpe, Sortino, Calmar, VaR, CVaR, Kelly, Hurst", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_RISK_ANALYSIS_RESPONSE,
      } as Response);

      const returns = Array.from({ length: 252 }, () => 0.001);
      const result = await provider.assessPortfolioRisk({
        returns,
        risk_free_rate: 0.04,
        annualization_factor: 252,
      });

      expect(result).toContain("Sharpe ratio: 1.42");
      expect(result).toContain("Sortino ratio: 2.18");
      expect(result).toContain("Calmar ratio: 0.85");
      expect(result).toContain("Max drawdown: -18.00%");
      expect(result).toContain("VaR (95%): 1.61%");
      expect(result).toContain("CVaR / Expected Shortfall (95%): 2.15%");
      expect(result).toContain("paid via x402");
    });
  });

  describe("recommendHedge", () => {
    it("returns ranked hedge structures with cost and floor", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => MOCK_HEDGE_RESPONSE,
      } as Response);

      const result = await provider.recommendHedge({
        position_type: "long_stock",
        position_value: 100000,
        asset_price: 185,
        volatility: 0.28,
        time_horizon_days: 30,
        max_hedge_cost_pct: 0.02,
        r: 0.05,
      });

      expect(result).toContain("Collar");
      expect(result).toContain("cost 0.61% ($613.00)");
      expect(result).toContain("buy 1× put @ $175.75");
      expect(result).toContain("sell 1× call @ $203.50");
    });
  });
});
