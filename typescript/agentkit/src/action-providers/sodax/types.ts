/**
 * A token SODAX can swap, as returned by `GET /tokens/:chainKey`.
 */
export interface SodaxToken {
  symbol: string;
  name?: string;
  decimals: number;
  address: string;
  chainKey?: string;
}

/**
 * Tokens keyed by SODAX chain key, as returned by `GET /tokens`.
 */
export type SodaxTokensByChain = Record<string, SodaxToken[]>;

/**
 * Body of `POST /quote`.
 */
export interface SodaxQuoteRequest {
  tokenSrc: string;
  tokenSrcChainKey: string;
  tokenDst: string;
  tokenDstChainKey: string;
  amount: string;
  quoteType: "exact_input";
}

/**
 * Response of `POST /quote`. The API returns only the quoted output amount.
 */
export interface SodaxQuoteResponse {
  /** Output amount in the smallest unit of the destination token. */
  quotedAmount: string;
}

/**
 * Body of `POST /allowance/check`, `POST /approve` and `POST /intents`.
 */
export interface SodaxCreateIntentRequest {
  srcChainKey: string;
  dstChainKey: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  deadline: string;
  allowPartialFill: boolean;
  srcAddress: string;
  dstAddress: string;
  solver: string;
  data: string;
}

/**
 * Unsigned EVM transaction built by the SODAX API.
 */
export interface SodaxEvmTx {
  from: string;
  to: string;
  value: string;
  data: string;
}

/**
 * Hub representation of a swap intent.
 */
export interface SodaxIntent {
  intentId: string;
  creator: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  deadline: string;
  allowPartialFill: boolean;
  srcChain: string;
  dstChain: string;
  srcAddress: string;
  dstAddress: string;
  solver: string;
  data: string;
}

/**
 * Response of `POST /intents`.
 */
export interface SodaxCreateIntentResponse {
  tx: SodaxEvmTx;
  intent: SodaxIntent;
  relayData: {
    address: string;
    payload: string;
  };
}

/**
 * Response of `POST /approve`.
 */
export interface SodaxApproveResponse {
  tx: SodaxEvmTx;
  /** Present when the allowance has to be reset to zero first (e.g. USDT-style tokens). */
  resetTx?: SodaxEvmTx;
}

/**
 * Response of `GET /submit-tx/status`.
 */
export interface SodaxSubmitTxStatusResponse {
  success?: boolean;
  data?: {
    txHash?: string;
    srcChainKey?: string;
    status?: string;
    failedAtStep?: string;
    failureReason?: string;
    userMessage?: string;
    intentCancelled?: boolean;
    result?: {
      dstIntentTxHash?: string;
      intent_hash?: string;
      fillTxHash?: string;
    };
  };
}
