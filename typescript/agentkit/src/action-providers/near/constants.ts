import { NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID } from "../../network/near";

export const SUPPORTED_NETWORKS = [NEAR_MAINNET_NETWORK_ID, NEAR_TESTNET_NETWORK_ID];

export const SUPPORTED_ADDRESS_TYPES = [
  "evm",
  "bitcoin-mainnet-legacy",
  "bitcoin-mainnet-segwit",
  "bitcoin-testnet-legacy",
  "bitcoin-testnet-segwit",
];

export const DEFAULT_PATH = "account-1";

export const DEFAULT_KEY_VERSION = 0;

// https://docs.near.org/build/chain-abstraction/chain-signatures/#1-deriving-the-foreign-address
export const MPC_SIGNER_TESTNET = "v1.signer-prod.testnet";

export const MPC_SIGNER_MAINNET = "v1.signer";

export const ROOT_PUBLIC_KEY_TESTNET =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";

export const ROOT_PUBLIC_KEY_MAINNET =
  "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya";

export const TGAS = 1000000000000n;

export const NEAR_MAX_GAS = 300000000000000n;

export const NO_DEPOSIT = "0";
