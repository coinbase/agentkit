import { Network } from "./types";

// CDP Network IDs
export const SOLANA_MAINNET_NETWORK_ID = "solana-mainnet";
export const SOLANA_TESTNET_NETWORK_ID = "solana-testnet";
export const SOLANA_DEVNET_NETWORK_ID = "solana-devnet";

// AgentKit Protocol Family
export const SOLANA_PROTOCOL_FAMILY = "svm";

// Chain IDs - Genesis Block Hashes
export const SOLANA_MAINNET_GENESIS_BLOCK_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const SOLANA_TESTNET_GENESIS_BLOCK_HASH = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";
export const SOLANA_DEVNET_GENESIS_BLOCK_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export const SOLANA_MAINNET_NETWORK: Network = {
    protocolFamily: SOLANA_PROTOCOL_FAMILY,
    chainId: SOLANA_MAINNET_GENESIS_BLOCK_HASH,
    networkId: SOLANA_MAINNET_NETWORK_ID,
};

export const SOLANA_TESTNET_NETWORK: Network = {
    protocolFamily: SOLANA_PROTOCOL_FAMILY,
    chainId: SOLANA_TESTNET_GENESIS_BLOCK_HASH,
    networkId: SOLANA_TESTNET_NETWORK_ID,
};

export const SOLANA_DEVNET_NETWORK: Network = {
    protocolFamily: SOLANA_PROTOCOL_FAMILY,
    chainId: SOLANA_DEVNET_GENESIS_BLOCK_HASH,
    networkId: SOLANA_DEVNET_NETWORK_ID,
};

export const SOLANA_NETWORKS = {
    [SOLANA_MAINNET_NETWORK_ID]: SOLANA_MAINNET_NETWORK,
    [SOLANA_TESTNET_NETWORK_ID]: SOLANA_TESTNET_NETWORK,
    [SOLANA_DEVNET_NETWORK_ID]: SOLANA_DEVNET_NETWORK,
};

