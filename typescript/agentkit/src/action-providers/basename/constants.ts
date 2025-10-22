// Contract addresses
export const BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET =
  "0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5";
export const BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET =
  "0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581";

export const L2_RESOLVER_ADDRESS_MAINNET = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
export const L2_RESOLVER_ADDRESS_TESTNET = "0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA";

// Default registration duration (1 year in seconds)
export const REGISTRATION_DURATION = 31557600n;

// Relevant ABI for L2 Resolver Contract.
export const L2_RESOLVER_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "address", name: "a", type: "address" },
    ],
    name: "setAddr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "newName", type: "string" },
    ],
    name: "setName",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Relevant ABI for Basenames Registrar Controller Contract.
export const REGISTRAR_ABI = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "duration",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "resolver",
            type: "address",
          },
          {
            internalType: "bytes[]",
            name: "data",
            type: "bytes[]",
          },
          {
            internalType: "bool",
            name: "reverseRecord",
            type: "bool",
          },
        ],
        internalType: "struct RegistrarController.RegisterRequest",
        name: "request",
        type: "tuple",
      },
    ],
    name: "register",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;
