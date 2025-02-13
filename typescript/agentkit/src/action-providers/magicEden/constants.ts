import { base, mainnet, polygon, arbitrum } from "viem/chains";

// Mapping of chain IDs to WETH addresses
export const WETH_ADDRESSES = {
  [mainnet.id]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  [base.id]: "0x4200000000000000000000000000000000000006",
  [arbitrum.id]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  [polygon.id]: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
};

export const ME_EVM_BASE_URL = "https://api-mainnet.magiceden.dev/v3/rtp";
