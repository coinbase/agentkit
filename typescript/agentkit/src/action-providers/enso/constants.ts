import { Coinbase } from "@coinbase/coinbase-sdk";

export const ENSO_API_KEY = "1e02632d-6feb-4a75-a157-documentation" as const;
export const ENSO_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;
export const ENSO_ROUTE_SINGLE_SIG = "0xb35d7e73" as const;

const ENSO_DEFAULT_CHAIN_ROUTER = "0x80EbA3855878739F4710233A8a19d89Bdd2ffB8E" as const;

export const ENSO_ROUTERS = new Map<number, string>([
  [1, ENSO_DEFAULT_CHAIN_ROUTER],
  [8453, ENSO_DEFAULT_CHAIN_ROUTER],
  [42161, ENSO_DEFAULT_CHAIN_ROUTER],
  [137, ENSO_DEFAULT_CHAIN_ROUTER],
]);

export const ENSO_SUPPORTED_NETWORKS = new Map<string, number>([
  [Coinbase.networks.BaseMainnet, 8453],
  [Coinbase.networks.EthereumMainnet, 1],
  [Coinbase.networks.ArbitrumMainnet, 42161],
  [Coinbase.networks.PolygonMainnet, 137],
]);
export const ENSO_SUPPORTED_NETWORKS_SET = new Set<number>([...ENSO_SUPPORTED_NETWORKS.values()]);
