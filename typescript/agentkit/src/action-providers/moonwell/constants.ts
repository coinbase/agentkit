export const MOONWELL_BASE_ADDRESSES = {
  "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22": "MOONWELL_USDC",
  "0x73b06D8d18De422E269645eaCe15400DE7462417": "MOONWELL_DAI",
  "0x628ff693426583D9a7FB391E54366292F509D457": "MOONWELL_WETH",
  "0x3bf93770f2d4a794c3d9EBEfBAeBAE2a8f09A5E5": "MOONWELL_cbETH",
  "0x627Fe393Bc6EdDA28e99AE648fD6fF362514304b": "MOONWELL_wstETH",
  "0x73902f619CEB9B31FD8EFecf435CbDf89E369Ba6": "MOONWELL_AERO",
  "0xb8051464C8c92209C92F3a4CD9C73746C4c3CFb3": "MOONWELL_weETH",
  "0xF877ACaFA28c19b96727966690b2f44d35aD5976": "MOONWELL_cbBTC",
  "0xb682c840B5F4FC58B20769E691A6fa1305A501a2": "MOONWELL_EURC",
  "0xfC41B49d064Ac646015b459C522820DB9472F4B5": "MOONWELL_wrsETH",
  "0xdC7810B47eAAb250De623F0eE07764afa5F71ED1": "MOONWELL_WELL",
  "0xb6419c6C2e60c4025D6D06eE4F913ce89425a357": "MOONWELL_USDS",
  "0x9A858ebfF1bEb0D3495BB0e2897c1528eD84A218": "MOONWELL_TBTC",
  "0x70778cfcFC475c7eA0f24cC625Baf6EaE475D0c9": "WETH_ROUTER",
};

export const MOONWELL_BASE_SEPOLIA_ADDRESSES = {
  "0x876852425331a113d8E432eFFB3aC5BEf38f033a": "MOONWELL_USDBC",
  "0x5302EbD8BC32435C823c2e22B04Cd6c45f593e89": "MOONWELL_cbETH",
  "0x2F39a349A79492a70E152760ce7123A1933eCf28": "MOONWELL_WETH",
};

export const WETH_ROUTER_ADDRESS = "0x70778cfcFC475c7eA0f24cC625Baf6EaE475D0c9";

// Token decimals mapping
export const TOKEN_DECIMALS = {
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": 6, // USDC
  "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42": 6, // EURC
  "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A": 18, // weETH
  "0xEDfa23602D0EC14714057867A78d01e94176BEA0": 18, // wrsETH
  "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b": 18, // tBTC
  "0xA88594D404727625A9437C3f886C7643872296AE": 18, // WELL
  "0x820C137fa70C8691f0e44Dc420a5e53c168921Dc": 18, // USDS
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": 18, // DAI
  "0x4200000000000000000000000000000000000006": 18, // WETH
  "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22": 18, // cbETH
  "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452": 18, // wstETH
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": 18, // AERO
  "0x0000000000000000000000000000000000000000": 18, // ETH (native)
};

export const MTOKENS_UNDERLYING_DECIMALS = {
  MOONWELL_USDC: 6,
  MOONWELL_DAI: 18,
  MOONWELL_WETH: 18,
  MOONWELL_cbETH: 18,
  MOONWELL_wstETH: 18,
  MOONWELL_AERO: 18,
  MOONWELL_weETH: 18,
  MOONWELL_cbBTC: 18,
  MOONWELL_EURC: 6,
  MOONWELL_wrsETH: 18,
  MOONWELL_WELL: 18,
  MOONWELL_USDS: 18,
  MOONWELL_TBTC: 18,
};

export const ETH_ROUTER_ABI = [
  {
    name: "mint",
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

export const MTOKEN_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      {
        name: "mintAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeemUnderlying",
    inputs: [
      {
        name: "redeemAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
];
