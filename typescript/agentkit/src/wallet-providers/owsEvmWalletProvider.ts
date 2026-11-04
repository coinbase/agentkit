import { privateKeyToAccount } from "viem/accounts";
import { EvmWalletProvider } from "./evmWalletProvider";

/**
 * Create an EVM wallet provider from an OWS encrypted vault.
 *
 * @param walletNameOrId - OWS wallet name or UUID
 * @returns A configured EvmWalletProvider
 *
 * @example
 * ```ts
 * import { owsEvmWalletProvider } from "@coinbase/agentkit";
 * const provider = owsEvmWalletProvider("my-agent-wallet");
 * ```
 */
export function owsEvmWalletProvider(walletNameOrId: string): EvmWalletProvider {
  const { exportWallet } = require("@open-wallet-standard/core") as {
    exportWallet: (nameOrId: string) => string;
  };

  const exported = exportWallet(walletNameOrId);
  let privateKey: `0x${string}`;

  try {
    const keys = JSON.parse(exported);
    const hex = keys.secp256k1 ?? "";
    privateKey = (hex.startsWith("0x") ? hex : `0x${hex}`) as `0x${string}`;
  } catch {
    const { deriveAddress } = require("@open-wallet-standard/core") as {
      deriveAddress: (mnemonic: string, chain: string) => { private_key?: string; privateKey?: string };
    };
    const info = deriveAddress(exported, "evm");
    const hex = info.private_key ?? info.privateKey ?? "";
    privateKey = (hex.startsWith("0x") ? hex : `0x${hex}`) as `0x${string}`;
  }

  // Use the ViemWalletProvider with the decrypted key
  const { ViemWalletProvider } = require("./viemWalletProvider");
  return ViemWalletProvider.fromPrivateKey(privateKey);
}
