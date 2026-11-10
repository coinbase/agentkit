/**
 * Sapien Vault contracts on Base mainnet (EIP-55).
 *
 * @see https://vault.sapien.io
 */
export const SAPIEN_VAULT_ADDRESS = "0x60Bf63729f688287a450299962b36Cef0aFfaa42";
export const SAPIEN_TOKEN_ADDRESS = "0xC729777d0470F30612B1564Fd96E8Dd26f5814E3";

export const SAPIEN_VAULT_APP_URL = "https://vault.sapien.io";

export const SAPIEN_VAULT_NETWORK_ID = "base-mainnet";
export const SAPIEN_VAULT_CHAIN_ID = "8453";

/**
 * Sapien Vault ABI: ERC-4626 + tranche / age views + ERC-20 share transfer.
 *
 * View signatures match ISapienVault / the live vault used by vault.sapien.io.
 */
export const SAPIEN_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256", internalType: "uint256" },
      { name: "receiver", type: "address", internalType: "address" },
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToShares",
    inputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxDeposit",
    inputs: [{ name: "receiver", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxWithdraw",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxRedeem",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewDeposit",
    inputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maturedShares",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingShares",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "availableBalance",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "assetsOf",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "depositAgeStatus",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      { name: "matured", type: "uint256", internalType: "uint256" },
      { name: "pending", type: "uint256", internalType: "uint256" },
      { name: "minAge", type: "uint256", internalType: "uint256" },
      { name: "nextMaturityRemaining", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStakeAccount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct StakeAccount",
        components: [{ name: "lockedAmount", type: "uint256", internalType: "uint256" }],
      },
    ],
    stateMutability: "view",
  },
] as const;
