export const EZPATH_API   = "https://ezpath.myezverse.xyz/api/v1/quote";
export const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const TOLL_DEFAULT = "0x13dDE704389b1118B20d2BCc6D3Ace749600e2ad" as const;

export const TIER_ATOMIC = {
  basic:         30_000n,
  resilient:     100_000n,
  institutional: 500_000n,
} as const;
