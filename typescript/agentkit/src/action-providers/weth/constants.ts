export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

export const WETH_ABI = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
