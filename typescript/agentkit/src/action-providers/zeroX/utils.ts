import { Hex, erc20Abi, getAddress, isAddress } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";

// Permit2 contract address is the same across all networks
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

type Permit2Eip712 = {
  domain?: {
    verifyingContract?: string;
    chainId?: number | string;
    name?: string;
  };
  message?: Record<string, unknown>;
  primaryType?: string;
};

/**
 * Extracts ERC-20 token + amount from a Permit2-style EIP-712 message.
 * Supports both flat and `permitted: { token, amount }` shapes used by 0x.
 */
function extractPermit2TokenAmount(
  message: Record<string, unknown> | undefined,
): { token?: string; amount?: bigint } {
  if (!message) return {};

  const permitted = message.permitted;
  if (permitted && typeof permitted === "object") {
    const p = permitted as Record<string, unknown>;
    const token = typeof p.token === "string" ? p.token : undefined;
    const amountRaw = p.amount;
    const amount =
      typeof amountRaw === "bigint"
        ? amountRaw
        : typeof amountRaw === "string" || typeof amountRaw === "number"
          ? BigInt(amountRaw)
          : undefined;
    return { token, amount };
  }

  const token = typeof message.token === "string" ? message.token : undefined;
  const amountRaw = message.amount;
  const amount =
    typeof amountRaw === "bigint"
      ? amountRaw
      : typeof amountRaw === "string" || typeof amountRaw === "number"
        ? BigInt(amountRaw)
        : undefined;
  return { token, amount };
}

/**
 * Validates that a quote's Permit2 EIP-712 payload matches local swap intent.
 * Rejects blind signing of attacker-controlled typed data from a compromised API path.
 */
export function assertPermit2Eip712MatchesSwap(params: {
  eip712: Permit2Eip712;
  chainId: string | number;
  sellToken: string;
  sellAmountBaseUnits: string;
  /**
   * When set (typically quote.transaction.to), require message.spender to match.
   * 0x Permit2 witness transfers use the settlement/allowance-holder as spender.
   */
  expectedSpender?: string;
  /** Unix seconds; defaults to Date.now()/1000. Deadline must be strictly in the future. */
  nowSeconds?: number;
}): void {
  const {
    eip712,
    chainId,
    sellToken,
    sellAmountBaseUnits,
    expectedSpender,
    nowSeconds,
  } = params;
  const verifying = eip712.domain?.verifyingContract;
  if (!verifying || !isAddress(verifying)) {
    throw new Error("Invalid Permit2 EIP-712 domain.verifyingContract");
  }
  if (getAddress(verifying) !== getAddress(PERMIT2_ADDRESS)) {
    throw new Error(
      `Permit2 EIP-712 verifyingContract mismatch: got ${verifying}, expected ${PERMIT2_ADDRESS}`,
    );
  }

  const domainName = eip712.domain?.name;
  if (domainName !== undefined && domainName !== "Permit2") {
    throw new Error(`Permit2 EIP-712 domain.name mismatch: got ${domainName}, expected Permit2`);
  }

  const domainChainId = eip712.domain?.chainId;
  if (domainChainId === undefined || domainChainId === null || domainChainId === "") {
    throw new Error("Permit2 EIP-712 domain.chainId missing");
  }
  if (String(domainChainId) !== String(chainId)) {
    throw new Error(
      `Permit2 EIP-712 chainId mismatch: got ${domainChainId}, expected ${chainId}`,
    );
  }

  const { token, amount } = extractPermit2TokenAmount(eip712.message);
  if (!token || !isAddress(token)) {
    throw new Error("Permit2 EIP-712 message missing token");
  }
  if (getAddress(token) !== getAddress(sellToken)) {
    throw new Error(
      `Permit2 EIP-712 token mismatch: got ${token}, expected ${sellToken}`,
    );
  }
  if (amount === undefined) {
    throw new Error("Permit2 EIP-712 message missing amount");
  }
  const expected = BigInt(sellAmountBaseUnits);
  // Exact match: padded-high amounts would authorize more than the local sell intent
  // (and more than the exact ERC-20 approve above).
  if (amount !== expected) {
    throw new Error(
      `Permit2 EIP-712 amount mismatch: got ${amount.toString()}, expected ${expected.toString()}`,
    );
  }

  const message = eip712.message ?? {};
  const spender = typeof message.spender === "string" ? message.spender : undefined;
  if (expectedSpender !== undefined) {
    if (!spender || !isAddress(spender)) {
      throw new Error("Permit2 EIP-712 message missing spender");
    }
    if (getAddress(spender) !== getAddress(expectedSpender)) {
      throw new Error(
        `Permit2 EIP-712 spender mismatch: got ${spender}, expected ${expectedSpender}`,
      );
    }
  } else if (spender !== undefined) {
    if (!isAddress(spender)) {
      throw new Error("Permit2 EIP-712 message has invalid spender");
    }
  }

  const deadlineRaw = message.deadline;
  if (deadlineRaw !== undefined && deadlineRaw !== null) {
    let deadline: bigint;
    try {
      if (typeof deadlineRaw === "bigint") {
        deadline = deadlineRaw;
      } else if (typeof deadlineRaw === "string" || typeof deadlineRaw === "number") {
        deadline = BigInt(deadlineRaw);
      } else {
        throw new Error("Permit2 EIP-712 message has invalid deadline");
      }
    } catch {
      throw new Error("Permit2 EIP-712 message has invalid deadline");
    }
    const now = BigInt(nowSeconds ?? Math.floor(Date.now() / 1000));
    if (deadline <= now) {
      throw new Error(
        `Permit2 EIP-712 deadline expired: got ${deadline.toString()}, now ${now.toString()}`,
      );
    }
  }
}

/**
 * Checks if a token is native ETH.
 *
 * @param token - The token address to check.
 * @returns True if the token is native ETH, false otherwise.
 */
export function isNativeEth(token: string): boolean {
  return token.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}

/**
 * Gets the details (decimals and name) for both fromToken and toToken
 *
 * @param walletProvider - The EVM wallet provider to read contracts
 * @param fromToken - The contract address of the from token
 * @param toToken - The contract address of the to token
 * @returns Promise<{fromTokenDecimals: number, toTokenDecimals: number, fromTokenName: string, toTokenName: string}>
 */
export async function getTokenDetails(
  walletProvider: EvmWalletProvider,
  fromToken: string,
  toToken: string,
): Promise<{
  fromTokenDecimals: number;
  toTokenDecimals: number;
  fromTokenName: string;
  toTokenName: string;
}> {
  // Initialize default values for native ETH
  let fromTokenDecimals = 18;
  let fromTokenName = "ETH";
  let toTokenDecimals = 18;
  let toTokenName = "ETH";

  // Prepare multicall contracts array
  const contracts: {
    address: Hex;
    abi: typeof erc20Abi;
    functionName: "decimals" | "name";
  }[] = [];
  const contractIndexMap = {
    fromDecimals: -1,
    fromName: -1,
    toDecimals: -1,
    toName: -1,
  };

  // Add from token contracts if not native ETH
  if (!isNativeEth(fromToken)) {
    contractIndexMap.fromDecimals = contracts.length;
    contracts.push({
      address: fromToken as Hex,
      abi: erc20Abi,
      functionName: "decimals",
    });

    contractIndexMap.fromName = contracts.length;
    contracts.push({
      address: fromToken as Hex,
      abi: erc20Abi,
      functionName: "name",
    });
  }

  // Add to token contracts if not native ETH
  if (!isNativeEth(toToken)) {
    contractIndexMap.toDecimals = contracts.length;
    contracts.push({
      address: toToken as Hex,
      abi: erc20Abi,
      functionName: "decimals",
    });

    contractIndexMap.toName = contracts.length;
    contracts.push({
      address: toToken as Hex,
      abi: erc20Abi,
      functionName: "name",
    });
  }

  // Execute multicall if there are contracts to call
  if (contracts.length > 0) {
    try {
      const results = await walletProvider.getPublicClient().multicall({
        contracts,
      });

      // Extract from token details
      if (contractIndexMap.fromDecimals !== -1) {
        const decimalsResult = results[contractIndexMap.fromDecimals];
        const nameResult = results[contractIndexMap.fromName];

        if (decimalsResult.status === "success" && nameResult.status === "success") {
          fromTokenDecimals = decimalsResult.result as number;
          fromTokenName = nameResult.result as string;
        } else {
          throw new Error(
            `Failed to read details for fromToken ${fromToken}. This address may not be a valid ERC20 contract.`,
          );
        }
      }

      // Extract to token details
      if (contractIndexMap.toDecimals !== -1) {
        const decimalsResult = results[contractIndexMap.toDecimals];
        const nameResult = results[contractIndexMap.toName];

        if (decimalsResult.status === "success" && nameResult.status === "success") {
          toTokenDecimals = decimalsResult.result as number;
          toTokenName = nameResult.result as string;
        } else {
          throw new Error(
            `Failed to read details for toToken ${toToken}. This address may not be a valid ERC20 contract.`,
          );
        }
      }
    } catch (error) {
      throw new Error(`Failed to read token details via multicall. Error: ${error}`);
    }
  }

  return { fromTokenDecimals, toTokenDecimals, fromTokenName, toTokenName };
}
