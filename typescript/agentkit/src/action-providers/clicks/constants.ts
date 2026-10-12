export const CLICKS_SPLITTER_ADDRESS = "0xF625e41D6e83Ca4FA890e0C73DAd65433a6ab5E3";
export const CLICKS_YIELD_ROUTER_ADDRESS = "0x4DE206153c2C6888F394F8CEcCE15B818dFb51A8";
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const CLICKS_SPLITTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "agent", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "quickStart",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "agent", type: "address" }],
    name: "getAgentInfo",
    outputs: [
      { internalType: "address", name: "splitter", type: "address" },
      { internalType: "bool", name: "registered", type: "bool" },
      { internalType: "uint256", name: "deposited", type: "uint256" },
      { internalType: "uint256", name: "earned", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const CLICKS_YIELD_ROUTER_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
