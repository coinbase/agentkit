export const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * Aave V3 Pool proxy address per network — the entry point for supply()/withdraw().
 *
 * Sources:
 * - base-mainnet: BaseScan "Aave: Pool Proxy Base" (https://basescan.org/address/0xa238dd80c259a72e81d7e4664a9801593f98d1c5),
 *   cross-checked against AAVE_PROTOCOL_DATA_PROVIDER in bgd-labs/aave-address-book, src/AaveV3Base.sol.
 * - base-sepolia: aave-dao/aave-address-book, src/AaveV3BaseSepolia.sol.
 */
export const AAVE_POOL_ADDRESSES: Record<string, `0x${string}`> = {
  "base-mainnet": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  "base-sepolia": "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27",
};

/**
 * Minimal IPool interface — only the two functions this action provider needs.
 * Full interface: https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol
 */
export const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
