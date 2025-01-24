import { Coinbase } from "@coinbase/coinbase-sdk";

export const ENSO_API_KEY = "1e02632d-6feb-4a75-a157-documentation" as const;
export const ENSO_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const ENSO_ROUTE_SINGLE_SIG = "0xb35d7e73" as const;

export const ENSO_SUPPORTED_NETWORKS = new Map<string, number>([
  // Mainnets
  [Coinbase.networks.BaseMainnet, 8453],
  [Coinbase.networks.EthereumMainnet, 1],
  [Coinbase.networks.ArbitrumMainnet, 42161],
  [Coinbase.networks.PolygonMainnet, 137],
  // Testnets
  [Coinbase.networks.BaseSepolia, 84532],
]);

export const MIN_ERC20_ABI = [
  {
    constant: false,
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ENSO_ROUTER_ABI = [
  {
    inputs: [
      {
        internalType: "contract IERC20",
        name: "tokenIn",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amountIn",
        type: "uint256",
      },
      {
        internalType: "bytes32[]",
        name: "commands",
        type: "bytes32[]",
      },
      {
        internalType: "bytes[]",
        name: "state",
        type: "bytes[]",
      },
    ],
    name: "routeSingle",
    outputs: [
      {
        internalType: "bytes[]",
        name: "returnData",
        type: "bytes[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;
