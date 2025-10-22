import { parseAbiItem } from "viem";

// Simplified ABIs
export const TruthMarketABI = [
  parseAbiItem("function marketQuestion() view returns (string)"),
  parseAbiItem("function marketSource() view returns (string)"),
  parseAbiItem("function getCurrentStatus() view returns (uint8)"),
  parseAbiItem("function endOfTrading() view returns (uint256)"),
  parseAbiItem("function getPoolAddresses() view returns (address yesPool, address noPool)"),
  parseAbiItem("function paymentToken() view returns (address)"),
  parseAbiItem("function additionalInfo() view returns (string)"),
  parseAbiItem("function winningPosition() view returns (uint8)"),
];

export const TruthMarketManagerABI = [
  parseAbiItem("function numberOfActiveMarkets() view returns (uint256)"),
  parseAbiItem("function getActiveMarketAddress(uint256) view returns (address)"),
  parseAbiItem("function creatorAddress(address) view returns (address)"),
  parseAbiItem("function resolverAddress(address) view returns (address)"),
];

export const UniswapV3PoolABI = [
  parseAbiItem("function liquidity() view returns (uint128)"),
  parseAbiItem(
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  ),
  parseAbiItem("function token0() view returns (address)"),
  parseAbiItem("function token1() view returns (address)"),
];

export const TruthMarketManager_ADDRESS = "0x61A98Bef11867c69489B91f340fE545eEfc695d7";
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const TYD_ADDRESS = "0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B";
export const USDC_DECIMALS = 6;
export const TYD_DECIMALS = 6;
export const YESNO_DECIMALS = 18;

/**
 * Market status enum
 */
export const MarketStatus = {
  Created: 0,
  OpenForResolution: 1,
  ResolutionProposed: 2,
  DisputeRaised: 3,
  SetByCouncil: 4,
  ResetByCouncil: 5,
  EscalatedDisputeRaised: 6,
  Finalized: 7,
};
