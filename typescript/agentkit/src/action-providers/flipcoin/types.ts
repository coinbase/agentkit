/**
 * Type definitions for the FlipCoin API responses.
 *
 * These mirror the OpenAPI spec exposed at https://www.flipcoin.fun/api/openapi.json.
 * Only the fields used by the action provider are declared here.
 */

export interface FlipcoinMarket {
  id: string;
  chain_id: string;
  market_addr: string;
  condition_id: string;
  title: string;
  description: string;
  status: "open" | "resolved";
  resolved_outcome: string | null;
  volume_usdc: number;
  liquidity_usdc: number;
  trades_count: number;
  resolve_end_at: string;
  category?: string;
  market_version: number;
}

export interface ListMarketsResponse {
  markets: FlipcoinMarket[];
  pagination: { offset: number; limit: number; total: number | null };
}

export interface QuoteResponse {
  quoteId: string;
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: string;
  venue: "lmsr" | "clob";
  validUntil: string;
  lmsr: {
    available: boolean;
    sharesOut: string;
    amountOut: string;
    fee: string;
    priceYesBps: number;
    priceNoBps: number;
    newPriceYesBps: number;
    priceImpactBps: number;
    avgPriceBps: number;
  };
  clob: {
    available: boolean;
    canFillFull: boolean;
    bestBidBps: number | null;
    bestAskBps: number | null;
  };
  priceImpactGuard?: {
    level: "ok" | "warn" | "blocked";
    impactBps: number;
    maxAllowedImpactBps: number;
  };
}

export interface TradeIntentTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: "TradeIntent";
  message: Record<string, string | number | boolean>;
}

export interface TradeIntentResponse {
  intentId: string;
  status: "awaiting_relay";
  venue: "lmsr";
  quote: {
    sharesOut: string;
    avgPriceBps: number;
    priceImpactBps: number;
    fee: string;
  };
  typedData: TradeIntentTypedData;
  balanceCheck: {
    sufficient: boolean;
    required: string;
    available: string;
  };
  approvalRequired?: {
    contract: string;
    function: string;
    operator: string;
    approved: boolean;
    hint: string;
  };
  priceImpactGuard: {
    level: "ok" | "warn" | "blocked";
    impactBps: number;
    maxAllowedImpactBps: number;
  };
}

export interface TradeRelayResponse {
  intentId: string;
  status: "confirmed" | "awaiting_relay" | "failed";
  venue: "lmsr";
  txHash: string | null;
  sharesOut: string | null;
  usdcOut: string | null;
  feeUsdc: string | null;
  error: string | null;
  retryable: boolean;
  errorCode?: string;
  approvalRequired?: {
    contract: string;
    function: string;
    operator: string;
    hint: string;
  };
}

export interface PortfolioPosition {
  marketAddr: string;
  title: string | null;
  status: "open" | "resolved" | null;
  yesShares: number;
  noShares: number;
  netSide: "yes" | "no";
  netShares: number;
  avgEntryPriceUsdc: number;
  currentPriceBps: number;
  currentValueUsdc: number;
  pnlUsdc: number;
  lastTradeAt: string | null;
}

export interface PortfolioResponse {
  positions: PortfolioPosition[];
  totals: {
    marketsActive: number;
    marketsResolved: number;
  };
}
