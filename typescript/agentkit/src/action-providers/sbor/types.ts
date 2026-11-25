/**
 * One lending market inside an SBOR index, as published in latest.json.
 */
export interface SborIndexMarket {
  venue: string;
  asset: string;
  borrow: number;
  supply: number;
  utilization: number;
  depthUsd: number;
  weight?: number;
}

/**
 * An SBOR index, as published in latest.json.
 */
export interface SborIndex {
  borrow: number;
  supply: number;
  venues: string[];
  markets: SborIndexMarket[];
}

/**
 * One Morpho market in the bitcoin-collateral USDC reference.
 */
export interface SborCollateralMarket {
  chain: string;
  collateral: string;
  borrow: number;
  supply: number;
  utilization: number;
  depthUsd: number;
  weight?: number;
}

/**
 * The bitcoin-collateral USDC reference. The rates are absent when not every
 * market could be read, and the reference is then withheld.
 */
export interface SborCollateralReference {
  borrow?: number;
  supply?: number;
  depthUsd?: number;
  markets: SborCollateralMarket[];
  notRead?: string[];
}

/**
 * The parts of SBOR's latest.json this provider reads.
 */
export interface SborFixing {
  fixing: string;
  methodologyVersion?: string;
  indices: Record<string, SborIndex>;
  bitcoinCollateralUsdc?: SborCollateralReference;
}

/**
 * A benchmark resolved into one shape, whether it is an index or the reference.
 */
export interface ResolvedBenchmark {
  name: string;
  isReference: boolean;
  borrow: number;
  supply: number;
  venueCount: number;
  markets: {
    venue: string;
    asset: string;
    borrow: number;
    supply: number;
    utilization: number;
    depthUsd: number;
  }[];
}
