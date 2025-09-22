import { Address, decodeEventLog, Hex, TransactionReceipt } from "viem";
import {
  FLAUNCH_ZAP_ABI,
  FlaunchPositionManagerV1_1Address,
  FlaunchZapAddress,
  POSITION_MANAGERV1_1_ABI,
} from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";

/**
 * Gets the memecoin address from the transaction receipt
 *
 * @param receipt - The transaction receipt
 * @param chainId - The chain id
 * @returns The memecoin address
 */
export function getMemecoinAddressFromReceipt(
  receipt: TransactionReceipt,
  chainId: string,
): Address {
  const filteredPoolCreatedEvent = receipt.logs
    .map(log => {
      try {
        if (
          log.address.toLowerCase() !== FlaunchPositionManagerV1_1Address[chainId].toLowerCase()
        ) {
          return null;
        }

        const event = decodeEventLog({
          abi: POSITION_MANAGERV1_1_ABI,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "PoolCreated" ? event.args : null;
      } catch {
        return null;
      }
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)[0];

  if (!filteredPoolCreatedEvent) {
    throw new Error("Could not find PoolCreated event in transaction receipt");
  }

  return filteredPoolCreatedEvent._memecoin;
}

/**
 * Calculates the ETH required to flaunch a token, takes into account the ETH for premine and the flaunching fee
 *
 * @param walletProvider - The EVM wallet provider
 * @param params - The flaunch parameters
 * @param params.premineAmount - The amount to premine
 * @param params.initialPriceParams - The initial price parameters
 * @param params.slippagePercent - The slippage percentage (optional, defaults to 5%)
 * @returns Promise that resolves to the ETH amount required
 */
export function ethRequiredToFlaunch(
  walletProvider: EvmWalletProvider,
  params: {
    premineAmount: bigint;
    initialPriceParams: Hex;
    slippagePercent?: number;
  },
): Promise<bigint> {
  const chainId = walletProvider.getNetwork().chainId;
  if (!chainId) throw new Error("Chain ID is not set.");

  return walletProvider.readContract({
    address: FlaunchZapAddress[chainId],
    abi: FLAUNCH_ZAP_ABI,
    functionName: "calculateFee",
    args: [
      params.premineAmount ?? 0n,
      BigInt(params.slippagePercent ?? 5 * 100),
      params.initialPriceParams,
    ],
  }) as Promise<bigint>;
}
