import { ProtocolFamily, NetworkId, WalletProvider } from "./constants";

/**
 * Configuration for an action provider
 */
export interface ProviderConfig {
  /** The name of the provider */
  name: string;
  /** The protocol family (e.g., "evm", "svm") or null for all protocols */
  protocolFamily: ProtocolFamily | null;
  /** The network IDs (e.g., ["ethereum-mainnet", "base-mainnet"]) */
  networkIds: NetworkId[];
  /** The wallet provider to use (optional) */
  walletProvider?: WalletProvider;
}

/**
 * Result from the prompts
 */
export type PromptResult = {
  name: string;
  overwrite?: boolean;
  protocolFamily: ProtocolFamily | null;
  networkIds?: NetworkId[];
  walletProvider?: WalletProvider;
};

/**
 * Values for the prompts
 */
export type PromptValues = {
  [K in keyof PromptResult]: K extends "networkIds"
    ? NetworkId[]
    : K extends "overwrite"
      ? boolean
      : string;
};
