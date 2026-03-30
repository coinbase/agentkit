/**
 * Lido Finance contract addresses and ABIs for Base chain.
 *
 * wstETH on Base is a bridged ERC20 token (non-rebasing).
 * Direct staking is available via Chainlink CCIP Custom Sender.
 */

/** wstETH bridged token on Base */
export const WSTETH_BASE = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452";

/** Lido Direct Staking Custom Sender on Base (via Chainlink CCIP) */
export const LIDO_CUSTOM_SENDER_BASE = "0x328de900860816d29D1367F6903a24D8ed40C997";

/** WETH on Base */
export const WETH_BASE = "0x4200000000000000000000000000000000000006";

/** Chainlink wstETH/stETH exchange rate oracle on Base */
export const WSTETH_RATE_ORACLE_BASE = "0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061";

/** Minimal ABI for Lido Custom Sender — fastStake with native ETH */
export const LIDO_CUSTOM_SENDER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "minWstETHAmount", type: "uint256" },
      { internalType: "address", name: "referral", type: "address" },
    ],
    name: "fastStake",
    outputs: [{ internalType: "uint256", name: "wstETHAmount", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "wethAmount", type: "uint256" },
      { internalType: "uint256", name: "minWstETHAmount", type: "uint256" },
      { internalType: "address", name: "referral", type: "address" },
    ],
    name: "fastStakeWETH",
    outputs: [{ internalType: "uint256", name: "wstETHAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "ethAmount", type: "uint256" }],
    name: "getExpectedWstETH",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** Minimal wstETH ABI (standard ERC20 + exchange rate query) */
export const WSTETH_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
