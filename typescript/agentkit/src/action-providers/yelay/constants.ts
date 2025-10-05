export const YELAY_BACKEND_URL = "https://lite.api.yelay.io/v2";
export const RETAIL_POOL_ID = 10;

export const YELAY_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256", internalType: "uint256" },
      { name: "projectId", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256", internalType: "uint256" },
      { name: "projectId", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
export const YIELD_EXTRACTOR_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "yelayLiteVault", type: "address" },
          {
            internalType: "uint256",
            name: "projectId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "cycle",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "yieldSharesTotal",
            type: "uint256",
          },
          {
            internalType: "bytes32[]",
            name: "proof",
            type: "bytes32[]",
          },
        ],
        internalType: "struct YieldExtractor.ClaimRequest[]",
        name: "data",
        type: "tuple[]",
      },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        internalType: "address",
        name: "yelayLiteVault",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "poolID",
        type: "uint256",
      },
    ],
    name: "yieldSharesClaimed",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export const CONTRACTS_BY_CHAIN = {
  1: {
    YieldExtractor: "0x226239384EB7d78Cdf279BA6Fb458E2A4945E275",
  },
  146: {
    YieldExtractor: "0xB84B621D3da3E5e47A1927883C685455Ad731D7C",
  },
  8453: {
    YieldExtractor: "0x4d6a89dc55d8bacc0cbc3824bd7e44fa051c3958",
  },
  42161: {
    YieldExtractor: "0x79b7e90F1BAe837362DBD2c83Bd0715c2De5E47f",
  },
  43114: {
    YieldExtractor: "0x98732e2FEb854bAd400D4b5336f4439E7E53fe88",
  },
} as const;
