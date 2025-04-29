import { ProtocolFamily, NetworkId, WalletProvider } from "./constants";

/**
 * Configuration for an action provider
 */
export interface ProviderConfig {
  name: string;
  protocolFamily: ProtocolFamily | null;
  networkIds: NetworkId[];
  walletProvider?: WalletProvider;
  providerKey: "default" | "walletProvider";
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
