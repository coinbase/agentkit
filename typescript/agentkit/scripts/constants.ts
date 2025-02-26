import { CHAIN_ID_TO_NETWORK_ID } from "../src/network/network";
import { SOLANA_CLUSTER_ID_BY_NETWORK_ID } from "../src/network/svm";
import { networkIdToDisplayName } from "./utils";

/**
 * Protocol families with descriptions
 */
export const PROTOCOL_FAMILIES = [
  {
    title: "All Networks",
    value: "all",
    description: "Support for any blockchain network",
  },
  {
    title: "EVM Networks",
    value: "evm",
    description: "Ethereum Virtual Machine networks (Ethereum, Base, etc.)",
  },
  {
    title: "Solana Networks",
    value: "svm",
    description: "Solana Virtual Machine networks",
  },
] as const;

/**
 * Network options organized by protocol family
 */
export const NETWORKS_BY_PROTOCOL = {
  all: [
    {
      title: "All Networks",
      value: "all",
      description: "Support any network",
    },
  ],
  evm: [
    {
      title: "All EVM Networks",
      value: "all",
      description: "Support all EVM networks",
    },
    ...Object.entries(CHAIN_ID_TO_NETWORK_ID)
      .map(([chainId, networkId]) => ({
        title: networkIdToDisplayName(networkId),
        value: networkId,
        description: `Chain ID: ${chainId}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  ],
  svm: [
    {
      title: "All Solana Networks",
      value: "all",
      description: "Support all Solana networks",
    },
    ...Object.entries(SOLANA_CLUSTER_ID_BY_NETWORK_ID)
      .map(([networkId, clusterId]) => ({
        title: networkIdToDisplayName(networkId),
        value: networkId,
        description: `Cluster: ${clusterId}`,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  ],
} as const;

//
// TODO: consider exporting wallet providers much like networks
//

/**
 * Base wallet provider configuration
 */
const BASE_WALLET_PROVIDERS = {
  all: [
    {
      title: "WalletProvider (generic)",
      value: "WalletProvider",
      description: "Base wallet provider for general blockchain interactions",
    },
  ],
} as const;

/**
 * EVM wallet provider configuration
 */
const EVM_WALLET_PROVIDERS = [
  {
    title: "EvmWalletProvider",
    value: "EvmWalletProvider",
    description: "For EVM-compatible blockchain networks (Ethereum, Base, etc.)",
  },
  {
    title: "CdpWalletProvider",
    value: "CdpWalletProvider",
    description: "Coinbase Developer Platform wallet provider with built-in key management",
  },
  {
    title: "EthAccountWalletProvider",
    value: "EthAccountWalletProvider",
    description: "Local private key wallet provider for EVM networks",
  },
  {
    title: "PrivyEvmWalletProvider",
    value: "PrivyEvmWalletProvider",
    description: "Privy's server wallet API provider for EVM networks",
  },
] as const;

/**
 * Solana wallet provider configuration
 */
const SVM_WALLET_PROVIDERS = [
  {
    title: "SvmWalletProvider",
    value: "SvmWalletProvider",
    description: "For Solana Virtual Machine networks",
  },
  {
    title: "PrivySvmWalletProvider",
    value: "PrivySvmWalletProvider",
    description: "Privy's server wallet API provider for Solana networks",
  },
  {
    title: "SolanaKeypairWalletProvider",
    value: "SolanaKeypairWalletProvider",
    description: "Local keypair wallet provider for Solana networks",
  },
] as const;

/**
 * Available wallet providers organized by protocol
 */
export const WALLET_PROVIDERS_BY_PROTOCOL = {
  ...BASE_WALLET_PROVIDERS,
  evm: EVM_WALLET_PROVIDERS,
  svm: SVM_WALLET_PROVIDERS,
} as const;

/**
 * Type definitions for protocol families and providers
 */
export type ProtocolFamily = (typeof PROTOCOL_FAMILIES)[number]["value"];
export type WalletProvider = (typeof WALLET_PROVIDERS_BY_PROTOCOL)[ProtocolFamily][number]["value"];
export type NetworkId = (typeof NETWORKS_BY_PROTOCOL)[ProtocolFamily][number]["value"];
