import { z } from "zod";

import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { WalletProvider, CdpSmartWalletProvider, EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { formatUnits, parseUnits } from "viem";

import {
  NativeTransferSchema,
  GetWalletDetailsSchema,
  GetBalanceSchema,
  ReturnNativeBalanceSchema,
} from "./schemas";

const PROTOCOL_FAMILY_TO_TERMINOLOGY: Record<
  string,
  { unit: string; displayUnit: string; decimals: number; type: string; verb: string }
> = {
  evm: {
    unit: "WEI",
    displayUnit: "ETH",
    decimals: 18,
    type: "Transaction hash",
    verb: "transaction",
  },
  svm: { unit: "LAMPORTS", displayUnit: "SOL", decimals: 9, type: "Signature", verb: "transfer" },
};

const DEFAULT_TERMINOLOGY = {
  unit: "",
  displayUnit: "",
  decimals: 0,
  type: "Hash",
  verb: "transfer",
};

// Standard gas units consumed by a simple EVM native transfer (intrinsic gas constant).
// Multiplied by 2 to produce the effective gas budget: this covers the gas-limit multiplier
// that wallet providers typically apply (default 1.2x) and minor fee fluctuations between
// estimation time and transaction submission.
const EVM_GAS_BUDGET = 21000n * 2n; // 42000

// The EVM zero address. Sending tokens here burns them permanently with no recovery.
const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Returns an error string if the destination is the EVM zero address, or null if it is valid.
 * Handles addresses with or without the 0x prefix.
 */
function validateNotZeroAddress(to: string, verb: string): string | null {
  // Normalize address: trim, lowercase, strip all leading "0x" prefixes, then add a single "0x".
  let normalized = to.trim().toLowerCase();
  while (normalized.startsWith("0x")) {
    normalized = normalized.slice(2);
  }
  const canonical = `0x${normalized}`;

  if (canonical === EVM_ZERO_ADDRESS) {
    return `Error during ${verb}: Transfer to the zero address is not allowed`;
  }
  return null;
}

/**
 * WalletActionProvider provides actions for getting basic wallet information.
 */
export class WalletActionProvider extends ActionProvider {
  /**
   * Constructor for the WalletActionProvider.
   */
  constructor() {
    super("wallet", []);
  }

  /**
   * Gets the details of the connected wallet including address, network, and balance.
   *
   * @param walletProvider - The wallet provider to get the details from.
   * @param _ - Empty args object (not used).
   * @returns A formatted string containing the wallet details.
   */
  @CreateAction({
    name: "get_wallet_details",
    description: `
    This tool will return the details of the connected wallet including:
    - Wallet address
    - Network information (protocol family, network ID, chain ID)
    - Native token balance (ETH for EVM networks, SOL for Solana networks)
    - Wallet provider name
    `,
    schema: GetWalletDetailsSchema,
  })
  async getWalletDetails(
    walletProvider: WalletProvider,
    _: z.infer<typeof GetWalletDetailsSchema>,
  ): Promise<string> {
    try {
      const address = walletProvider.getAddress();
      const network = walletProvider.getNetwork();
      const balance = await walletProvider.getBalance();
      const name = walletProvider.getName();
      const terminology =
        PROTOCOL_FAMILY_TO_TERMINOLOGY[network.protocolFamily] || DEFAULT_TERMINOLOGY;

      return [
        "Wallet Details:",
        `- Provider: ${name}`,
        `- Address: ${address}`,
        ...(walletProvider instanceof CdpSmartWalletProvider
          ? [`- Owner Address: ${walletProvider.ownerAccount.address}`]
          : []),
        "- Network:",
        `  * Protocol Family: ${network.protocolFamily}`,
        `  * Network ID: ${network.networkId || "N/A"}`,
        `  * Chain ID: ${network.chainId || "N/A"}`,
        `- Native Balance: ${balance.toString()} ${terminology.unit}`,
        `- Native Balance: ${formatUnits(balance, terminology.decimals)} ${terminology.displayUnit}`,
      ].join("\n");
    } catch (error) {
      return `Error getting wallet details: ${error}`;
    }
  }

  /**
   * Gets the native currency balance of the connected wallet.
   *
   * @param walletProvider - The wallet provider to get the balance from.
   * @param _ - Empty args object (not used).
   * @returns A message containing the wallet address and balance information.
   */
  @CreateAction({
    name: "get_balance",
    description: "This tool will get the native currency balance of the connected wallet.",
    schema: GetBalanceSchema,
  })
  async getBalance(
    walletProvider: WalletProvider,
    _: z.infer<typeof GetBalanceSchema>,
  ): Promise<string> {
    try {
      const balance = await walletProvider.getBalance();
      const address = walletProvider.getAddress();

      return `Native balance at address ${address}: ${balance}`;
    } catch (error) {
      return `Error getting balance: ${error}`;
    }
  }

  /**
   * Transfers a specified amount of native currency to a destination onchain.
   *
   * @param walletProvider - The wallet provider to transfer from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer details.
   */
  @CreateAction({
    name: "native_transfer",
    description: `
This tool will transfer (send) native tokens (ETH for EVM networks, SOL for SVM networks) from the wallet to another onchain address.

It takes the following inputs:
- amount: The amount to transfer in whole units (e.g. 4.2 ETH, 0.1 SOL)
- destination: The address to receive the funds
`,
    schema: NativeTransferSchema,
  })
  async nativeTransfer(
    walletProvider: WalletProvider,
    args: z.infer<typeof NativeTransferSchema>,
  ): Promise<string> {
    try {
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;

      if (protocolFamily === "evm" && !args.to.startsWith("0x")) {
        args.to = `0x${args.to}`;
      }

      if (protocolFamily === "evm") {
        const zeroAddressError = validateNotZeroAddress(args.to, terminology.verb);
        if (zeroAddressError) return zeroAddressError;
      }

      const amountInAtomicUnits = parseUnits(args.value, terminology.decimals);
      const result = await walletProvider.nativeTransfer(args.to, amountInAtomicUnits.toString());
      return [
        `Transferred ${args.value} ${terminology.displayUnit} to ${args.to}`,
        `${terminology.type}: ${result}`,
      ].join("\n");
    } catch (error) {
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;
      return `Error during ${terminology.verb}: ${error}`;
    }
  }

  /**
   * Returns the entire native token balance of the wallet minus gas fees to a destination address.
   *
   * @param walletProvider - The wallet provider to transfer from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer details.
   */
  @CreateAction({
    name: "return_native_balance",
    description: `
This tool will transfer the entire native token balance of the wallet to a destination address,
automatically deducting the estimated network/gas fees so the transaction succeeds.

It takes the following inputs:
- to: The destination address to receive the native tokens

Important notes:
- The exact amount transferred will be the wallet balance minus the estimated transaction fees
- A negligible dust amount may remain in the wallet after the transfer due to gas estimation buffers
- The transfer will fail if the wallet balance is too low to cover even the gas fees
`,
    schema: ReturnNativeBalanceSchema,
  })
  async returnNativeBalance(
    walletProvider: WalletProvider,
    args: z.infer<typeof ReturnNativeBalanceSchema>,
  ): Promise<string> {
    try {
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;

      if (protocolFamily === "evm" && !args.to.startsWith("0x")) {
        args.to = `0x${args.to}`;
      }

      if (protocolFamily === "evm") {
        const zeroAddressError = validateNotZeroAddress(args.to, terminology.verb);
        if (zeroAddressError) return zeroAddressError;
      }

      const balance = await walletProvider.getBalance();
      let transferAmount: bigint;

      if (protocolFamily === "evm" && walletProvider instanceof EvmWalletProvider) {
        // For EVM networks, estimate gas fees and subtract them from the balance.
        // A simple native transfer always uses 21000 gas units (intrinsic gas constant).
        // EVM_GAS_BUDGET applies a 2x buffer to account for the gas-limit multiplier
        // that wallet providers typically apply (default 1.2x) and fee fluctuations
        // between estimation time and transaction submission.
        const publicClient = walletProvider.getPublicClient();
        const feeData = await publicClient.estimateFeesPerGas();
        const maxFeePerGas = "maxFeePerGas" in feeData ? feeData.maxFeePerGas : feeData.gasPrice;
        const gasCost = EVM_GAS_BUDGET * maxFeePerGas;

        if (balance <= gasCost) {
          return `Error: Insufficient balance to cover gas fees`;
        }
        transferAmount = balance - gasCost;
      } else if (protocolFamily === "svm") {
        // Standard Solana transaction fee is 5000 lamports
        const SOL_TX_FEE = 5000n;
        if (balance <= SOL_TX_FEE) {
          return `Error: Insufficient balance to cover transaction fee`;
        }
        transferAmount = balance - SOL_TX_FEE;
      } else {
        // For networks where gas estimation is unavailable, transfer the full balance.
        transferAmount = balance;
      }

      const result = await walletProvider.nativeTransfer(args.to, transferAmount.toString());
      const formattedAmount = formatUnits(transferAmount, terminology.decimals);
      return [
        `Returned ${formattedAmount} ${terminology.displayUnit} to ${args.to}`,
        `${terminology.type}: ${result}`,
      ].join("\n");
    } catch (error) {
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;
      return `Error during ${terminology.verb}: ${error}`;
    }
  }

  /**
   * Checks if the wallet action provider supports the given network.
   * Since wallet actions are network-agnostic, this always returns true.
   *
   * @param _ - The network to check.
   * @returns True, as wallet actions are supported on all networks.
   */
  supportsNetwork = (_: Network): boolean => true;
}

/**
 * Factory function to create a new WalletActionProvider instance.
 *
 * @returns A new WalletActionProvider instance.
 */
export const walletActionProvider = () => new WalletActionProvider();
