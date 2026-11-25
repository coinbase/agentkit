import { decodeFunctionData, erc20Abi } from "viem";
import { SODAX_NATIVE_TOKEN_ADDRESS, SODAX_REQUEST_TIMEOUT_MS } from "./constants";
import { SodaxEvmTx, SodaxToken } from "./types";

/**
 * Options shared by every SODAX API request.
 */
export interface SodaxRequestOptions {
  /** Base URL of the SODAX Swaps API. */
  baseUrl: string;
  /** Optional SODAX partner API key, sent as the `x-api-key` header. */
  apiKey?: string;
}

/**
 * Sends a request to the SODAX Swaps API and returns the parsed JSON body.
 *
 * @param options - Base URL and optional API key.
 * @param path - Path below the Swaps API base URL, e.g. `/quote`.
 * @param body - JSON body for POST requests. GET is used when omitted.
 * @returns The parsed response body.
 */
export async function sodaxRequest<T>(
  options: SodaxRequestOptions,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (options.apiKey) {
    headers["x-api-key"] = options.apiKey;
  }

  const response = await fetch(`${options.baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(SODAX_REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = undefined;
  }

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : text.slice(0, 200);
    throw new Error(`SODAX API ${path.split("?")[0]} returned ${response.status}: ${message}`);
  }

  if (json === undefined) {
    throw new Error(`SODAX API ${path.split("?")[0]} returned a non-JSON response`);
  }

  return json as T;
}

/**
 * Finds a token in a SODAX token list by address or symbol.
 *
 * EVM addresses match case-insensitively; other addresses (e.g. Solana mints) must match
 * exactly. Symbols match case-insensitively.
 *
 * @param tokens - Tokens supported on a chain.
 * @param query - Token address or symbol.
 * @param chainKey - SODAX chain key, used in error messages.
 * @returns The matching token.
 */
export function findToken(tokens: SodaxToken[], query: string, chainKey: string): SodaxToken {
  const trimmed = query.trim();
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);

  const byAddress = tokens.find(token =>
    isEvmAddress
      ? token.address.toLowerCase() === trimmed.toLowerCase()
      : token.address === trimmed,
  );
  if (byAddress) {
    return byAddress;
  }

  const bySymbol = tokens.filter(token => token.symbol.toLowerCase() === trimmed.toLowerCase());
  if (bySymbol.length === 1) {
    return bySymbol[0];
  }
  if (bySymbol.length > 1) {
    throw new Error(
      `Symbol ${trimmed} matches several tokens on ${chainKey}: ${bySymbol
        .map(token => `${token.symbol} (${token.address})`)
        .join(", ")}. Use the token address instead`,
    );
  }

  throw new Error(
    `Token ${trimmed} is not supported by SODAX on ${chainKey}. Use the get_supported_tokens action to list supported tokens`,
  );
}

/**
 * Whether the token is the chain's native asset.
 *
 * @param token - The token.
 * @returns True for the native asset.
 */
export function isNativeToken(token: SodaxToken): boolean {
  return token.address.toLowerCase() === SODAX_NATIVE_TOKEN_ADDRESS;
}

/**
 * Applies slippage to a quoted output amount.
 *
 * @param quotedAmount - Quoted output in the destination token's smallest unit.
 * @param slippageBps - Maximum slippage in basis points.
 * @returns The minimum acceptable output amount.
 */
export function applySlippage(quotedAmount: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) {
    throw new Error(`slippageBps must be an integer between 0 and 5000, got ${slippageBps}`);
  }
  return (quotedAmount * BigInt(10_000 - slippageBps)) / 10_000n;
}

/**
 * Checks that an unsigned transaction from the SODAX API is sent from the wallet.
 *
 * @param tx - The unsigned transaction.
 * @param walletAddress - The agent wallet address.
 * @param label - Name of the transaction, used in error messages.
 */
export function assertTxFromWallet(tx: SodaxEvmTx, walletAddress: string, label: string): void {
  if (!tx?.to || !tx.data) {
    throw new Error(`SODAX API returned an incomplete ${label} transaction`);
  }
  if (tx.value !== undefined && !/^\d+$/.test(String(tx.value))) {
    throw new Error(`SODAX API returned an invalid value for the ${label} transaction`);
  }
  if (tx.from && tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error(`SODAX ${label} transaction is not from the wallet address ${walletAddress}`);
  }
}

/**
 * Gets the native value of a transaction built by the SODAX API.
 *
 * @param tx - The unsigned transaction.
 * @returns The value in wei.
 */
export function txValue(tx: SodaxEvmTx): bigint {
  return BigInt(tx.value || 0);
}

/**
 * Checks that an approval built by the SODAX API approves exactly the expected amount of the
 * input token to the contract that will receive the swap transaction, and sends no native value.
 *
 * @param tx - The unsigned approval transaction.
 * @param tokenAddress - The input token address.
 * @param spender - The `to` address of the create-intent transaction.
 * @param expectedAmount - The allowance the transaction must set.
 */
export function assertApprovalTx(
  tx: SodaxEvmTx,
  tokenAddress: string,
  spender: string,
  expectedAmount: bigint,
): void {
  if (txValue(tx) !== 0n) {
    throw new Error("SODAX approval transaction must not send native value");
  }
  if (tx.to.toLowerCase() !== tokenAddress.toLowerCase()) {
    throw new Error(`SODAX approval transaction does not target the token ${tokenAddress}`);
  }
  const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data as `0x${string}` });
  if (decoded.functionName !== "approve") {
    throw new Error("SODAX approval transaction is not an ERC20 approve call");
  }
  const [approvedSpender, approvedAmount] = decoded.args as readonly [string, bigint];
  if (approvedSpender.toLowerCase() !== spender.toLowerCase()) {
    throw new Error(
      `SODAX approval spender ${approvedSpender} does not match the swap contract ${spender}`,
    );
  }
  if (approvedAmount !== expectedAmount) {
    throw new Error(
      `SODAX approval amount ${approvedAmount} does not match the expected amount ${expectedAmount}`,
    );
  }
}
