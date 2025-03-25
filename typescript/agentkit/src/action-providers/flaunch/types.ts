import { Address } from "viem";

export interface Addresses {
  [chainId: number]: Address;
}

type BuyCoinBase = {
  coinAddress: Address;
  slippagePercent: number;
  referrer?: Address;
};

export type BuyCoinExactInParams = BuyCoinBase & {
  swapType: "EXACT_IN";
  amountIn: bigint;
  amountOutMin?: bigint;
};

export type BuyCoinExactOutParams = BuyCoinBase & {
  swapType: "EXACT_OUT";
  amountOut: bigint;
  amountInMax?: bigint;
};

export type PoolSwapEventArgs = {
  flAmount0: bigint;
  flAmount1: bigint;
  flFee0: bigint;
  flFee1: bigint;
  ispAmount0: bigint;
  ispAmount1: bigint;
  ispFee0: bigint;
  ispFee1: bigint;
  uniAmount0: bigint;
  uniAmount1: bigint;
  uniFee0: bigint;
  uniFee1: bigint;
};
