/**
 * Interface representing a DeFi protocol from DefiLlama
 */
export interface Protocol {
  name: string;
  address?: string;
  symbol?: string;
  url?: string;
  description?: string;
  chain?: string;
  logo?: string;
  audits?: string;
  category?: string;
  tvl?: number;
}

/**
 * Interface representing a time-series data point with a date
 */
export interface TimeSeriesDataPoint {
  date: number;
  totalLiquidityUSD: number;
}

/**
 * Interface representing a time-series data point with tokens
 */
export interface TokenTimeSeriesDataPoint {
  date: number;
  tokens: Record<string, number>;
}

/**
 * Type for representing generic metadata values that can be returned by DefiLlama API
 */
export type MetadataValue = string | number | boolean | null | Record<string, unknown> | unknown[];

/**
 * Interface representing DefiLlama protocol response
 */
export interface ProtocolResponse {
  id: string;
  name: string;
  address?: string;
  symbol?: string;
  url?: string;
  description?: string;
  chain?: string;
  logo?: string;
  audits?: string;
  audit_note?: string | null;
  gecko_id?: string | null;
  cmcId?: string | null;
  category?: string;

  chains?: string[];
  oracles?: string[];
  forkedFrom?: string[];
  audit_links?: string[];
  github?: string[];

  tvl?: TimeSeriesDataPoint[];
  tokensInUsd?: TokenTimeSeriesDataPoint[];
  tokens?: TokenTimeSeriesDataPoint[];
  chainTvls?: Record<
    string,
    {
      tvl?: TimeSeriesDataPoint[];
      tokensInUsd?: TokenTimeSeriesDataPoint[];
      tokens?: TokenTimeSeriesDataPoint[];
    }
  >;
  currentChainTvls?: Record<string, number>;

  // Other metadata
  raises?: Record<string, MetadataValue>[];
  metrics?: Record<string, MetadataValue>;
  mcap?: number;
  methodology?: string;
}

/**
 * Type for the pruned protocol response - same structure as the input
 */
export type PrunedProtocolResponse = ProtocolResponse;
