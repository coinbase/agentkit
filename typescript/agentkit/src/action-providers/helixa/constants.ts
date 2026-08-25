/**
 * Helixa AgentDNA contract on Base mainnet (Chain ID 8453).
 * ERC-8004 compliant identity NFT for AI agents.
 *
 * IMPORTANT: This contract does NOT implement ERC721Enumerable.
 * totalSupply() and paused() will REVERT. Use totalAgents() instead.
 * balanceOf() and ownerOf() work fine (standard ERC721).
 */
export const AGENTDNA_CONTRACT = "0x665971e7bf8ec90c3066162c5b396604b3cd7711";

/**
 * Helixa AgentNames contract on Base mainnet.
 * .agent naming registry for AI agents.
 */
export const AGENTNAMES_CONTRACT = "0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d";

/**
 * Max uint256 — pass as parentTokenId when minting without a parent.
 */
export const NO_PARENT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export const AGENTDNA_ABI = [
  {
    inputs: [],
    name: "totalAgents",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getAgent",
    outputs: [
      {
        components: [
          { name: "agentAddress", type: "address" },
          { name: "name", type: "string" },
          { name: "framework", type: "string" },
          { name: "mintedAt", type: "uint256" },
          { name: "verified", type: "bool" },
          { name: "soulbound", type: "bool" },
          { name: "generation", type: "uint256" },
          { name: "parentDNA", type: "uint256" },
          { name: "currentVersion", type: "string" },
          { name: "mutationCount", type: "uint256" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentAddress", type: "address" }],
    name: "addressToTokenId",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getPoints",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentAddress", type: "address" },
      { name: "name", type: "string" },
      { name: "framework", type: "string" },
      { name: "tokenURI_", type: "string" },
      { name: "soulbound", type: "bool" },
      { name: "parentTokenId", type: "uint256" },
    ],
    name: "mint",
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newVersion", type: "string" },
      { name: "reason", type: "string" },
    ],
    name: "mutate",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "traitType", type: "string" },
      { name: "traitValue", type: "string" },
    ],
    name: "addTrait",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const AGENTNAMES_ABI = [
  {
    inputs: [{ name: "name", type: "string" }],
    name: "resolve",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "name", type: "string" }],
    name: "available",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "name", type: "string" }],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
