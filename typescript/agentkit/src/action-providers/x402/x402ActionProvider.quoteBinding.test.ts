/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-description, jsdoc/require-returns, jsdoc/require-param-description, import/first, @typescript-eslint/no-unused-vars */
import { AgentKit } from "../../agentkit";
import { x402ActionProvider } from "./x402ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { QUOTE_BINDING_MAX_PENDING, QUOTE_BINDING_TTL_MS } from "./quoteBinding";
import { SOLANA_USDC_ADDRESSES } from "./constants";
import type { PublicClient } from "viem";
import { generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";

jest.mock("../../wallet-providers", () => {
  const wallet = jest.requireActual("../../wallet-providers/walletProvider");
  const evm = jest.requireActual("../../wallet-providers/evmWalletProvider");
  const svm = jest.requireActual("../../wallet-providers/svmWalletProvider");
  return {
    WalletProvider: wallet.WalletProvider,
    EvmWalletProvider: evm.EvmWalletProvider,
    SvmWalletProvider: svm.SvmWalletProvider,
    CdpSmartWalletProvider: { configureWithWallet: jest.fn() },
  };
});
jest.mock("../../action-providers", () => {
  const provider = jest.requireActual("../../action-providers/actionProvider");
  return {
    ActionProvider: provider.ActionProvider,
    walletActionProvider: () => ({
      name: "wallet",
      supportsNetwork: () => false,
      getActions: () => [],
      actionProviders: [],
    }),
  };
});

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const PAYER = "0xa8c1a5D3C372C65c04f91f87a43F549619A9483f";
const PROTECTED_URL = "https://api.example.com/protected";

/**
 *
 * @param overrides
 */
function v1Requirement(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "10000",
    resource: PROTECTED_URL,
    description: "Access to protected content",
    mimeType: "application/json",
    outputSchema: {},
    payTo: PAY_TO,
    maxTimeoutSeconds: 300,
    asset: USDC_BASE_SEPOLIA,
    extra: {
      name: "USDC",
      version: "2",
    },
    ...overrides,
  };
}

/**
 *
 * @param accepts
 * @param extras
 */
function v1Envelope(accepts: Array<Record<string, unknown>>, extras: Record<string, unknown> = {}) {
  return {
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts,
    ...extras,
  };
}

/**
 *
 * @param status
 * @param body
 * @param headers
 */
function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

/**
 *
 * @param overrides
 */
function paymentProofHeader(overrides: Record<string, unknown> = {}): string {
  const body: Record<string, unknown> = {
    success: true,
    transaction: EVM_WELL_FORMED_TX,
    network: "base-sepolia",
    payer: PAYER,
    ...overrides,
  };
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) {
      delete body[key];
    }
  }
  return btoa(JSON.stringify(body));
}

/**
 *
 * @param address
 */
function mutateBase58Case(address: string): string {
  const mutated = address.replace(/[A-Za-z]/g, ch =>
    ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase(),
  );
  if (mutated === address) {
    throw new Error("case mutation produced identical payer");
  }
  return mutated;
}

/**
 *
 */
class FakeEvmWallet extends EvmWalletProvider {
  signCalls = 0;
  typedDataCalls: unknown[] = [];

  /**
   *
   */
  getAddress(): string {
    return PAYER;
  }

  /**
   *
   */
  getNetwork() {
    return { protocolFamily: "evm" as const, networkId: "base-sepolia", chainId: "84532" };
  }

  /**
   *
   */
  getName(): string {
    return "fake-evm";
  }

  /**
   *
   */
  async getBalance(): Promise<bigint> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async nativeTransfer(): Promise<string> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async sign(): Promise<`0x${string}`> {
    this.signCalls += 1;
    return `0x${"11".repeat(65)}`;
  }

  /**
   *
   */
  async signMessage(): Promise<`0x${string}`> {
    this.signCalls += 1;
    return `0x${"11".repeat(65)}`;
  }

  /**
   *
   * @param typedData
   */
  async signTypedData(typedData: unknown): Promise<`0x${string}`> {
    this.signCalls += 1;
    this.typedDataCalls.push(typedData);
    return `0x${"11".repeat(65)}`;
  }

  /**
   *
   */
  async signTransaction(): Promise<`0x${string}`> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async sendTransaction(): Promise<`0x${string}`> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async waitForTransactionReceipt(): Promise<unknown> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async readContract(): Promise<never> {
    throw new Error("readContract is not available in the fake signer");
  }

  /**
   *
   */
  getPublicClient(): PublicClient {
    throw new Error("getPublicClient reached");
  }
}

/**
 * Shape-valid SVM wallet whose toSigner() is a real @solana/kit KeyPairSigner
 * (address + signTransactions) that official @x402/svm 2.7.0 consumes.
 */
class FakeSvmWallet extends SvmWalletProvider {
  signCalls = 0;
  private readonly inner: KeyPairSigner;

  /**
   *
   * @param inner
   */
  constructor(inner: KeyPairSigner) {
    super();
    this.inner = inner;
  }

  /**
   *
   */
  getAddress(): string {
    return this.inner.address;
  }

  /**
   *
   */
  getNetwork() {
    return { protocolFamily: "svm" as const, networkId: "solana-devnet" };
  }

  /**
   *
   */
  getName(): string {
    return "fake-svm";
  }

  /**
   *
   */
  async getBalance(): Promise<bigint> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async nativeTransfer(): Promise<string> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  getConnection(): never {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  getPublicKey(): PublicKey {
    return new PublicKey(this.inner.address);
  }

  /**
   *
   */
  async signTransaction(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async sendTransaction(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async signAndSendTransaction(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async getSignatureStatus(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async waitForSignatureResult(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async signMessage(): Promise<never> {
    throw new Error("wallet method reached");
  }

  /**
   *
   */
  async getKeyPairSigner(): Promise<KeyPairSigner> {
    const inner = this.inner;
    const incrementSignCalls = (): void => {
      this.signCalls += 1;
    };
    return {
      ...inner,
      signTransactions: async (transactions, config) => {
        incrementSignCalls();
        return inner.signTransactions(transactions, config);
      },
    };
  }
}

type ScriptedHandler = (request: Request) => Response | Promise<Response>;

type CapturedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  request: Request;
};

/**
 *
 * @param headers
 */
function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

const TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SVM_USDC = SOLANA_USDC_ADDRESSES["solana-devnet"];
const SVM_PAY_TO = "So11111111111111111111111111111111111111112";
const SVM_FEE_PAYER = "11111111111111111111111111111111";
const SVM_WELL_FORMED_TX =
  "2AXDGYSE4f2sz7tvMMzyHvUfcoJmxudvdhBcmiUSo6ijwfYmfZYsKRxboQMPh3R4kUhXRVdtSXFXMheka4Rc4P2";
const EVM_WELL_FORMED_TX = `0x${"ab".repeat(32)}`;

/**
 * Classic initialized SPL mint (82 bytes, 6 decimals) for official fetchMint.
 */
function classicUsdcMintAccount(): string {
  const buf = Buffer.alloc(82);
  buf.writeUInt8(6, 44);
  buf.writeUInt8(1, 45);
  return buf.toString("base64");
}

/**
 *
 * @param url
 */
function isSolanaRpcUrl(url: string): boolean {
  return (
    url.includes("api.devnet.solana.com") ||
    url.includes("api.mainnet-beta.solana.com") ||
    url.includes("api.testnet.solana.com")
  );
}

/**
 * Scripted official @solana/kit RPC. No live network.
 *
 * @param request
 */
async function scriptedSolanaRpc(request: Request): Promise<Response> {
  let parsed: { id?: unknown; method?: string } = {};
  try {
    parsed = (await request.clone().json()) as { id?: unknown; method?: string };
  } catch {
    parsed = {};
  }
  if (parsed.method === "getAccountInfo") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: parsed.id,
        result: {
          context: { slot: 1 },
          value: {
            data: [classicUsdcMintAccount(), "base64"],
            executable: false,
            lamports: 1461600,
            owner: TOKEN_PROGRAM_ADDRESS,
            rentEpoch: 0,
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  if (parsed.method === "getLatestBlockhash") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: parsed.id,
        result: {
          context: { slot: 1 },
          value: {
            blockhash: "11111111111111111111111111111111",
            lastValidBlockHeight: 1000,
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  throw new Error(`Unexpected Solana RPC method ${String(parsed.method)}`);
}

/**
 *
 * @param handlers
 */
function installScriptedFetch(handlers: ScriptedHandler[]): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let index = 0;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (isSolanaRpcUrl(request.url)) {
      return scriptedSolanaRpc(request);
    }
    if (!request.url.includes("api.example.com") && !request.url.includes("evil.example")) {
      return new Response(null, { status: 204 });
    }
    const body = await request.clone().text();
    calls.push({
      url: request.url,
      method: request.method,
      headers: headerMap(request.headers),
      body,
      request,
    });
    const handler = handlers[index];
    index += 1;
    if (!handler) {
      throw new Error(`Unexpected fetch #${index} to ${request.url}`);
    }
    return handler(request);
  }) as typeof fetch;
  return { calls };
}

/**
 *
 * @param headers
 */
function hasPaymentHeader(headers: Record<string, string>): boolean {
  return "payment-signature" in headers || "x-payment" in headers;
}

/**
 *
 * @param headers
 */
function nonPaymentHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key === "payment-signature" || key === "x-payment") {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 *
 */
async function createHarness() {
  const wallet = new FakeEvmWallet();
  const provider = x402ActionProvider({
    registeredServices: ["https://api.example.com"],
    maxPaymentUsdc: 1.0,
  });
  const kit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [provider],
  });
  const actions = kit.getActions();
  const make = actions.find(
    action => action.name === "make_http_request" || action.name.endsWith("_make_http_request"),
  );
  const retry = actions.find(
    action =>
      action.name === "retry_http_request_with_x402" ||
      action.name.endsWith("_retry_http_request_with_x402"),
  );
  const autoPay = actions.find(
    action =>
      action.name === "make_http_request_with_x402" ||
      action.name.endsWith("_make_http_request_with_x402"),
  );
  if (!make || !retry || !autoPay) {
    throw new Error("missing exported actions: " + actions.map(action => action.name).join(","));
  }
  return { wallet, make, retry, autoPay };
}

async function invokeAction(
  action: {
    schema: { parse: (args: unknown) => unknown };
    invoke: (args: unknown) => Promise<string>;
  },
  args: unknown,
): Promise<Record<string, unknown>> {
  const parsed = action.schema.parse(args);
  return JSON.parse(await action.invoke(parsed)) as Record<string, unknown>;
}

/**
 *
 * @param overrides
 */
function baseSelected(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "10000",
    asset: USDC_BASE_SEPOLIA,
    amount: null,
    price: null,
    payTo: PAY_TO,
    ...overrides,
  };
}

/**
 *
 * @param args
 * @param args.inspectHandlers
 * @param args.retryHandlers
 * @param args.url
 * @param args.method
 * @param args.headers
 * @param args.queryParams
 * @param args.body
 * @param args.selectedOverrides
 * @param args.quoteBinding
 * @param args.skipBinding
 * @param args.extensions
 */
async function inspectAndRetry(args: {
  inspectHandlers: ScriptedHandler[];
  retryHandlers: ScriptedHandler[];
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string> | null;
  queryParams?: Record<string, string> | null;
  body?: unknown;
  selectedOverrides?: Record<string, unknown>;
  quoteBinding?: string | null;
  skipBinding?: boolean;
  extensions?: Record<string, unknown> | null;
}) {
  const { wallet, make, retry } = await createHarness();
  const inspectFetch = installScriptedFetch(args.inspectHandlers);
  const inspect = await invokeAction(make, {
    url: args.url ?? PROTECTED_URL,
    method: args.method ?? "GET",
    headers: args.headers ?? null,
    queryParams: args.queryParams ?? null,
    body: args.body ?? null,
  });
  const retryFetch = installScriptedFetch(args.retryHandlers);
  const retryArgs: Record<string, unknown> = {
    url: args.url ?? PROTECTED_URL,
    method: args.method ?? "GET",
    headers: args.headers ?? null,
    queryParams: args.queryParams ?? null,
    body: args.body ?? null,
    selectedPaymentOption: baseSelected(args.selectedOverrides),
  };
  if (!args.skipBinding) {
    retryArgs.quoteBinding = args.quoteBinding ?? inspect.quoteBinding;
  }
  if (args.extensions !== undefined) {
    retryArgs.extensions = args.extensions;
  }
  const retryResult = await invokeAction(retry, retryArgs);
  return {
    wallet,
    inspect,
    retry: retryResult,
    inspectCalls: inspectFetch.calls,
    retryCalls: retryFetch.calls,
  };
}

/**
 *
 */
function paidReplay(): ScriptedHandler[] {
  return [
    request => {
      if (!request.headers.has("PAYMENT-SIGNATURE") && !request.headers.has("X-PAYMENT")) {
        throw new Error("Expected payment header on prepared replay");
      }
      return jsonResponse(200, { message: "paid" }, { "x-payment-response": paymentProofHeader() });
    },
  ];
}

/**
 *
 * @param overrides
 */
function svmV1Requirement(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000",
    resource: PROTECTED_URL,
    description: "Access to protected content",
    mimeType: "application/json",
    outputSchema: {},
    payTo: SVM_PAY_TO,
    maxTimeoutSeconds: 300,
    asset: SVM_USDC,
    extra: {
      feePayer: SVM_FEE_PAYER,
    },
    ...overrides,
  };
}

/**
 *
 * @param overrides
 */
function svmSelected(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "10000",
    asset: SVM_USDC,
    amount: null,
    price: null,
    payTo: SVM_PAY_TO,
    ...overrides,
  };
}

/**
 *
 * @param payer
 * @param overrides
 */
function svmPaymentProofHeader(payer: string, overrides: Record<string, unknown> = {}): string {
  const body: Record<string, unknown> = {
    success: true,
    transaction: SVM_WELL_FORMED_TX,
    network: "solana-devnet",
    payer,
    ...overrides,
  };
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) {
      delete body[key];
    }
  }
  return btoa(JSON.stringify(body));
}

/**
 *
 */
async function createSvmHarness() {
  const inner = await generateKeyPairSigner();
  const wallet = new FakeSvmWallet(inner);
  const provider = x402ActionProvider({
    registeredServices: ["https://api.example.com"],
    maxPaymentUsdc: 1.0,
  });
  const kit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [provider],
  });
  const actions = kit.getActions();
  const make = actions.find(
    action => action.name === "make_http_request" || action.name.endsWith("_make_http_request"),
  );
  const retry = actions.find(
    action =>
      action.name === "retry_http_request_with_x402" ||
      action.name.endsWith("_retry_http_request_with_x402"),
  );
  const autoPay = actions.find(
    action =>
      action.name === "make_http_request_with_x402" ||
      action.name.endsWith("_make_http_request_with_x402"),
  );
  if (!make || !retry || !autoPay) {
    throw new Error("missing exported actions: " + actions.map(action => action.name).join(","));
  }
  return { wallet, make, retry, autoPay };
}

/**
 *
 * @param args
 * @param args.inspectHandlers
 * @param args.retryHandlers
 * @param args.selectedOverrides
 * @param args.quoteBinding
 * @param args.skipBinding
 * @param args.extensions
 */
async function inspectAndRetrySvm(args: {
  inspectHandlers: ScriptedHandler[];
  retryHandlers: ScriptedHandler[];
  selectedOverrides?: Record<string, unknown>;
  quoteBinding?: string | null;
  skipBinding?: boolean;
  extensions?: Record<string, unknown> | null;
}) {
  const { wallet, make, retry } = await createSvmHarness();
  const inspectFetch = installScriptedFetch(args.inspectHandlers);
  const inspect = await invokeAction(make, {
    url: PROTECTED_URL,
    method: "GET",
    headers: null,
    queryParams: null,
    body: null,
  });
  const retryFetch = installScriptedFetch(args.retryHandlers);
  const retryArgs: Record<string, unknown> = {
    url: PROTECTED_URL,
    method: "GET",
    headers: null,
    queryParams: null,
    body: null,
    selectedPaymentOption: svmSelected(args.selectedOverrides),
  };
  if (!args.skipBinding) {
    retryArgs.quoteBinding = args.quoteBinding ?? inspect.quoteBinding;
  }
  if (args.extensions !== undefined) {
    retryArgs.extensions = args.extensions;
  }
  const retryResult = await invokeAction(retry, retryArgs);
  return {
    wallet,
    inspect,
    retry: retryResult,
    inspectCalls: inspectFetch.calls,
    retryCalls: retryFetch.calls,
  };
}

/**
 *
 * @param payer
 * @param proofOverrides
 * @param headers
 */
function svmPaidReplay(
  payer: string,
  proofOverrides?: Record<string, unknown>,
  headers?: Record<string, string>,
): ScriptedHandler[] {
  return [
    request => {
      if (!request.headers.has("PAYMENT-SIGNATURE") && !request.headers.has("X-PAYMENT")) {
        throw new Error("Expected payment header on prepared replay");
      }
      return jsonResponse(
        200,
        { message: "paid" },
        headers ?? { "x-payment-response": svmPaymentProofHeader(payer, proofOverrides) },
      );
    },
  ];
}

describe("X402ActionProvider quote binding (real official x402 2.7.0 client)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("signs once and replays frozen request bytes when inspect and prepared retry match", async () => {
    const envelope = v1Envelope([v1Requirement()]);
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, envelope)],
      retryHandlers: paidReplay(),
    });

    expect(result.inspect.status).toBe("error_402_payment_required");
    expect(result.inspect.quoteBinding).toEqual(expect.any(String));
    expect(result.retry.status).toBe("success");
    expect(
      (result.retry.details as { paymentProof: { transaction: string } }).paymentProof.transaction,
    ).toMatch(/^0x/);
    expect(
      (result.retry.details as { paymentUsed: { network: string; asset: string; amount?: string } })
        .paymentUsed,
    ).toEqual({
      network: "base-sepolia",
      asset: USDC_BASE_SEPOLIA,
      amount: "10000",
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(result.retryCalls).toHaveLength(1);
    expect(hasPaymentHeader(result.retryCalls[0].headers)).toBe(true);
    expect(result.retryCalls[0].url).toBe(result.inspectCalls[0].url);
    expect(result.retryCalls[0].method).toBe(result.inspectCalls[0].method);
    expect(result.retryCalls[0].body).toBe(result.inspectCalls[0].body);
    expect(nonPaymentHeaders(result.retryCalls[0].headers)).toEqual(
      nonPaymentHeaders(result.inspectCalls[0].headers),
    );

    const typed = result.wallet.typedDataCalls[0] as {
      primaryType: string;
      domain: { name: string; version: string; chainId: number; verifyingContract: string };
      message: { to: string; value: bigint };
    };
    expect(typed.primaryType).toBe("TransferWithAuthorization");
    expect(typed.domain.name).toBe("USDC");
    expect(typed.domain.version).toBe("2");
    expect(typed.domain.chainId).toBe(84532);
    expect(typed.domain.verifyingContract.toLowerCase()).toBe(USDC_BASE_SEPOLIA.toLowerCase());
    expect(typed.message.to.toLowerCase()).toBe(PAY_TO.toLowerCase());
    expect(typed.message.value).toBe(10000n);

    const paymentHeader =
      result.retryCalls[0].headers["x-payment"] ??
      result.retryCalls[0].headers["payment-signature"];
    const payload = JSON.parse(atob(paymentHeader)) as {
      network?: string;
      payload: { authorization: { to: string; value: string } };
    };
    expect(payload.network ?? "base-sepolia").toBe("base-sepolia");
    expect(payload.payload.authorization.to.toLowerCase()).toBe(PAY_TO.toLowerCase());
    expect(payload.payload.authorization.value).toBe("10000");
  });

  it.each([
    ["amount", { maxAmountRequired: "20000" }],
    ["payee", { payTo: "0x0000000000000000000000000000000000000001" }],
    ["asset", { asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }],
    ["network", { network: "base" }],
    ["scheme", { scheme: "upto" }],
    ["timeout", { maxTimeoutSeconds: 12 }],
    ["EIP-712 domain data", { extra: { name: "USD Coin", version: "2" } }],
    ["resource URL", { resource: "https://api.example.com/other" }],
  ])("signs zero times when retry selected option drifts %s", async (_label, override) => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [],
      selectedOverrides: override,
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(result.retry.status).not.toBe("success");
    expect(result.retry.possibleSpend).not.toBe(true);
    expect(result.retryCalls).toHaveLength(0);
  });

  it("signs zero times when retry extensions drift from the frozen envelope", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [],
      extensions: { bonus: { more: true } },
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(result.retry.status).not.toBe("success");
    expect(result.retryCalls).toHaveLength(0);
  });

  it("signs zero times when retry request bytes differ from the frozen inspect", async () => {
    const envelope = v1Envelope([v1Requirement()]);
    const { wallet, make, retry } = await createHarness();
    installScriptedFetch([() => jsonResponse(402, envelope)]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "POST",
      headers: null,
      queryParams: null,
      body: { order: "alpha" },
    });
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "POST",
      headers: null,
      queryParams: null,
      body: { order: "beta" },
      selectedPaymentOption: baseSelected(),
      quoteBinding: inspect.quoteBinding,
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(retryResult.message)).toMatch(/does not match frozen quote/i);
  });

  it("signs zero times when retry targets a different redirect URL than the frozen inspect", async () => {
    const envelope = v1Envelope([v1Requirement()]);
    const { wallet, make, retry } = await createHarness();
    installScriptedFetch([() => jsonResponse(402, envelope)]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: "https://api.example.com/other",
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      selectedPaymentOption: baseSelected(),
      quoteBinding: inspect.quoteBinding,
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(retryResult.message)).toMatch(/does not match frozen quote/i);
  });

  it("does not let a cheap incompatible option authorize a more expensive compatible option", async () => {
    const cheapIncompatible = v1Requirement({
      scheme: "upto",
      maxAmountRequired: "1",
    });
    const expensiveCompatible = v1Requirement({
      scheme: "exact",
      maxAmountRequired: "900000",
    });
    const { wallet, make, retry } = await createHarness();
    installScriptedFetch([
      () => jsonResponse(402, v1Envelope([cheapIncompatible, expensiveCompatible])),
    ]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    expect((inspect.selectedRequirement as { scheme: string }).scheme).toBe("upto");
    expect((inspect.selectedRequirement as { maxAmountRequired: string }).maxAmountRequired).toBe(
      "1",
    );

    installScriptedFetch([]);
    const conflict = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: inspect.quoteBinding,
      selectedPaymentOption: baseSelected({
        scheme: "exact",
        maxAmountRequired: "900000",
      }),
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(conflict.message)).toMatch(/does not match frozen quote/i);

    const second = await inspectAndRetry({
      inspectHandlers: [
        () => jsonResponse(402, v1Envelope([cheapIncompatible, expensiveCompatible])),
      ],
      retryHandlers: [],
      selectedOverrides: {
        scheme: "upto",
        maxAmountRequired: "1",
      },
    });
    expect(second.wallet.signCalls).toBe(0);
    expect(second.retry.status).not.toBe("success");
  });

  it("signs zero times for absent quote state", async () => {
    const { wallet, retry } = await createHarness();
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      selectedPaymentOption: baseSelected(),
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(retryResult.message)).toMatch(/No valid frozen quote binding/i);
  });

  it("signs zero times for a malformed quoteBinding handle", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [],
      quoteBinding: "!!",
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(String(result.retry.message)).toMatch(/malformed/i);
  });

  it("signs zero times for a mismatched quoteBinding handle", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [],
      quoteBinding: "a".repeat(32),
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(String(result.retry.message)).toMatch(/not found/i);
  });

  it("signs zero times on replay of a consumed quoteBinding", async () => {
    const envelope = v1Envelope([v1Requirement()]);
    const { wallet, make, retry } = await createHarness();
    installScriptedFetch([() => jsonResponse(402, envelope)]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    installScriptedFetch(paidReplay());
    const first = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: inspect.quoteBinding,
      selectedPaymentOption: baseSelected(),
    });
    expect(wallet.signCalls).toBe(1);
    expect(first.status).toBe("success");

    installScriptedFetch(paidReplay());
    const replay = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: inspect.quoteBinding,
      selectedPaymentOption: baseSelected(),
    });
    expect(wallet.signCalls).toBe(1);
    expect(String(replay.message)).toMatch(/not found|already used|quote binding/i);
  });

  it("signs zero times after quote binding expiry", async () => {
    const envelope = v1Envelope([v1Requirement()]);
    const now = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(now);
    const { wallet, make, retry } = await createHarness();
    installScriptedFetch([() => jsonResponse(402, envelope)]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    nowSpy.mockReturnValue(now + QUOTE_BINDING_TTL_MS + 1);
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: inspect.quoteBinding,
      selectedPaymentOption: baseSelected(),
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(retryResult.message)).toMatch(/expired|not found/i);
  });

  it("signs zero times after bounded-state eviction of the oldest approval", async () => {
    const envelope = v1Requirement();
    const { wallet, make, retry } = await createHarness();
    const handles: string[] = [];
    for (let i = 0; i < QUOTE_BINDING_MAX_PENDING + 1; i += 1) {
      installScriptedFetch([() => jsonResponse(402, v1Envelope([envelope]))]);
      const inspect = await invokeAction(make, {
        url: `https://api.example.com/protected/${i}`,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
      });
      handles.push(inspect.quoteBinding as string);
    }
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: "https://api.example.com/protected/0",
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: handles[0],
      selectedPaymentOption: baseSelected(),
    });
    expect(wallet.signCalls).toBe(0);
    expect(String(retryResult.message)).toMatch(/not found|evict/i);
  });

  it("does not treat a 200 missing payment-response as settled-success", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(200, { message: "paid" });
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(String(result.retry.status)).toMatch(/possible_spend|unreconciled/);
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.signCount).toBe(1);
    expect(result.retryCalls).toHaveLength(1);
    expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
  });

  it("does not treat a malformed payment-response as settled-success", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": "not-valid-base64!!!" },
          );
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(String(result.retry.status)).toMatch(/possible_spend|unreconciled/);
    expect(result.retry.possibleSpend).toBe(true);
    expect(
      (result.retry.details as { paymentProof?: unknown } | undefined)?.paymentProof,
    ).toBeUndefined();
    expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
  });

  it("preserves possible-spend evidence on non-2xx after the fake sign and does not retry", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(503, { error: "settlement failed" });
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(String(result.retry.status)).toMatch(/possible_spend|unreconciled/);
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.httpStatus).toBe(503);
    expect(result.retryCalls).toHaveLength(1);
    expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
  });

  it("preserves possible-spend evidence on timeout after the fake sign and does not retry", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return Promise.reject(new Error("The operation timed out"));
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(String(result.retry.status)).toMatch(/possible_spend|unreconciled/);
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retryCalls).toHaveLength(1);
    expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
  });

  it("treats a 3xx after sign as terminal unreconciled possible-spend and does not retry", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return new Response(null, {
            status: 302,
            headers: { Location: "https://evil.example/collect" },
          });
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(String(result.retry.status)).toMatch(/possible_spend|unreconciled/);
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.httpStatus).toBe(302);
    expect(result.retryCalls).toHaveLength(1);
    expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
  });

  it("does not promote unsuccessful settlement with nonempty tx and matching network/payer", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": paymentProofHeader({ success: false }) },
          );
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(result.retry.status).toBe("unreconciled_possible_spend");
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.signCount).toBe(1);
    expect(result.retry.status).not.toBe("success");
  });

  it("does not promote wrong-network settlement as settled-success", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": paymentProofHeader({ network: "base" }) },
          );
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(result.retry.status).toBe("unreconciled_possible_spend");
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.signCount).toBe(1);
    expect(result.retry.status).not.toBe("success");
  });

  it("does not promote transactionless settlement as settled-success", async () => {
    const emptyTx = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": paymentProofHeader({ transaction: "" }) },
          );
        },
      ],
    });
    expect(emptyTx.wallet.signCalls).toBe(1);
    expect(emptyTx.retry.status).toBe("unreconciled_possible_spend");
    expect(emptyTx.retry.possibleSpend).toBe(true);
    expect(emptyTx.retry.signCount).toBe(1);

    const missingTx = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          const header = btoa(
            JSON.stringify({
              success: true,
              network: "base-sepolia",
              payer: PAYER,
            }),
          );
          return jsonResponse(200, { message: "paid" }, { "x-payment-response": header });
        },
      ],
    });
    expect(missingTx.wallet.signCalls).toBe(1);
    expect(missingTx.retry.status).toBe("unreconciled_possible_spend");
    expect(missingTx.retry.possibleSpend).toBe(true);
  });

  it("does not promote wrong-payer settlement as settled-success", async () => {
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            {
              "x-payment-response": paymentProofHeader({
                payer: "0x0000000000000000000000000000000000000001",
              }),
            },
          );
        },
      ],
    });
    expect(result.wallet.signCalls).toBe(1);
    expect(result.retry.status).toBe("unreconciled_possible_spend");
    expect(result.retry.possibleSpend).toBe(true);
    expect(result.retry.signCount).toBe(1);
    expect(result.retry.status).not.toBe("success");
  });

  it("refuses ambiguous exact-one selector match before sign", async () => {
    const duplicate = v1Requirement();
    const result = await inspectAndRetry({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([duplicate, { ...duplicate }]))],
      retryHandlers: [],
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(result.retry.status).not.toBe("success");
    expect(result.retry.possibleSpend).not.toBe(true);
    expect(result.retry.signCount).toBe(0);
    expect(result.retryCalls).toHaveLength(0);
    expect(String(result.retry.message) + String(result.retry.details)).toMatch(
      /ambiguous|exact-one|refusing/i,
    );
  });
});

describe("X402ActionProvider SVM quote binding (official @x402/svm 2.7.0 signTransactions)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("promotes official SVM settlement when decoded proof matches frozen network and payer", async () => {
    const { wallet, make, retry } = await createSvmHarness();
    installScriptedFetch([() => jsonResponse(402, v1Envelope([svmV1Requirement()]))]);
    const inspect = await invokeAction(make, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    const retryFetch = installScriptedFetch(svmPaidReplay(wallet.getAddress()));
    const retryResult = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      quoteBinding: inspect.quoteBinding,
      selectedPaymentOption: svmSelected(),
    });
    expect(wallet.signCalls).toBe(1);
    expect(retryResult.status).toBe("success");
    expect(
      (retryResult.details as { paymentUsed: { network: string; asset: string; amount?: string } })
        .paymentUsed,
    ).toEqual({
      network: "solana-devnet",
      asset: SVM_USDC,
      amount: "10000",
    });
    expect(retryFetch.calls).toHaveLength(1);
    expect(hasPaymentHeader(retryFetch.calls[0].headers)).toBe(true);
  });

  it.each([
    ["missing settlement header", (payer: string) => svmPaidReplay(payer, undefined, {})],
    [
      "malformed header",
      (_payer: string) => [
        (request: Request) => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": "not-valid-base64!!!" },
          );
        },
      ],
    ],
    ["unsuccessful", (payer: string) => svmPaidReplay(payer, { success: false })],
    ["wrong-network", (payer: string) => svmPaidReplay(payer, { network: "solana" })],
    ["transactionless empty tx", (payer: string) => svmPaidReplay(payer, { transaction: "" })],
    [
      "transactionless missing tx",
      (payer: string) =>
        svmPaidReplay(payer, {
          success: true,
          network: "solana-devnet",
          payer,
          transaction: undefined,
        }),
    ],
    ["wrong-payer", (payer: string) => svmPaidReplay(payer, { payer: SVM_PAY_TO })],
  ])(
    "returns terminal unreconciled_possible_spend after real SVM sign for %s",
    async (_label, handlersFor) => {
      const { wallet, make, retry } = await createSvmHarness();
      installScriptedFetch([() => jsonResponse(402, v1Envelope([svmV1Requirement()]))]);
      const inspect = await invokeAction(make, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
      });
      installScriptedFetch(handlersFor(wallet.getAddress()));
      const retryResult = await invokeAction(retry, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
        quoteBinding: inspect.quoteBinding,
        selectedPaymentOption: svmSelected(),
      });
      expect(wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(retryResult.status).toBe("unreconciled_possible_spend");
      expect(retryResult.possibleSpend).toBe(true);
      expect(Number(retryResult.signCount)).toBeGreaterThanOrEqual(1);
      expect(retryResult.status).not.toBe("success");
    },
  );

  it("returns terminal unreconciled_possible_spend when fetch throws after a real SVM sign", async () => {
    const result = await inspectAndRetrySvm({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([svmV1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return Promise.reject(new Error("The operation timed out"));
        },
      ],
    });
    expect(result.wallet.signCalls).toBeGreaterThanOrEqual(1);
    expect(result.retry.status).toBe("unreconciled_possible_spend");
    expect(result.retry.possibleSpend).toBe(true);
    expect(Number(result.retry.signCount)).toBeGreaterThanOrEqual(1);
    expect(result.retry.status).not.toBe("success");
  });

  it("returns terminal unreconciled_possible_spend on body-parse failure after a real SVM sign", async () => {
    const result = await inspectAndRetrySvm({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([svmV1Requirement()]))],
      retryHandlers: [
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return new Response("{not-json", {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-payment-response": svmPaymentProofHeader("ignored"),
            },
          });
        },
      ],
    });
    expect(result.wallet.signCalls).toBeGreaterThanOrEqual(1);
    expect(result.retry.status).toBe("unreconciled_possible_spend");
    expect(result.retry.possibleSpend).toBe(true);
    expect(Number(result.retry.signCount)).toBeGreaterThanOrEqual(1);
    expect(result.retry.status).not.toBe("success");
  });

  it("keeps absent quote as zero-spend with signCount 0", async () => {
    const { wallet, retry } = await createSvmHarness();
    installScriptedFetch([]);
    const retryResult = await invokeAction(retry, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
      selectedPaymentOption: svmSelected(),
    });
    expect(wallet.signCalls).toBe(0);
    expect(retryResult.possibleSpend).not.toBe(true);
    expect(retryResult.signCount).toBe(0);
    expect(retryResult.status).not.toBe("success");
  });

  it("keeps ambiguous exact-one selector as zero-spend with signCount 0", async () => {
    const duplicate = svmV1Requirement();
    const result = await inspectAndRetrySvm({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([duplicate, { ...duplicate }]))],
      retryHandlers: [],
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(result.retry.possibleSpend).not.toBe(true);
    expect(result.retry.signCount).toBe(0);
    expect(result.retry.status).not.toBe("success");
    expect(result.retryCalls).toHaveLength(0);
  });

  it("keeps frozen-envelope selected-option drift as zero-spend with signCount 0", async () => {
    const result = await inspectAndRetrySvm({
      inspectHandlers: [() => jsonResponse(402, v1Envelope([svmV1Requirement()]))],
      retryHandlers: [],
      selectedOverrides: { maxAmountRequired: "20000" },
    });
    expect(result.wallet.signCalls).toBe(0);
    expect(result.retry.possibleSpend).not.toBe(true);
    expect(result.retry.signCount).toBe(0);
    expect(result.retry.status).not.toBe("success");
    expect(result.retryCalls).toHaveLength(0);
  });
});

/**
 *
 * @param paid
 * @param envelope
 */
function autoPayHandlers(
  paid: ScriptedHandler,
  envelope: Record<string, unknown> = v1Envelope([v1Requirement()]),
): ScriptedHandler[] {
  return [() => jsonResponse(402, envelope), paid];
}

/**
 *
 * @param kind
 * @param handlers - Scripted fetch handlers installed for the auto-pay invoke.
 */
async function invokeAutoPay(kind: "evm" | "svm", handlers: ScriptedHandler[]) {
  const harness = kind === "svm" ? await createSvmHarness() : await createHarness();
  const fetchState = installScriptedFetch(handlers);
  const result = await invokeAction(harness.autoPay, {
    url: PROTECTED_URL,
    method: "GET",
    headers: null,
    queryParams: null,
    body: null,
  });
  return { wallet: harness.wallet, result, calls: fetchState.calls };
}

describe("X402ActionProvider auto-pay exported settlement (EVM)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("promotes auto-pay only with official decoded successful settlement", async () => {
    const { wallet, result, calls } = await invokeAutoPay(
      "evm",
      autoPayHandlers(request => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": paymentProofHeader() },
        );
      }),
    );
    expect(wallet.signCalls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect((result.paymentProof as { success: boolean }).success).toBe(true);
    expect(
      String((result.paymentProof as { transaction: string }).transaction).length,
    ).toBeGreaterThan(0);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    [
      "missing settlement header",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(200, { message: "paid" });
      },
    ],
    [
      "malformed header",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": "not-valid-base64!!!" },
        );
      },
    ],
    [
      "unsuccessful",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": paymentProofHeader({ success: false }) },
        );
      },
    ],
    [
      "wrong-network",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": paymentProofHeader({ network: "base" }) },
        );
      },
    ],
    [
      "transactionless empty tx",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": paymentProofHeader({ transaction: "" }) },
        );
      },
    ],
    [
      "transactionless missing tx",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        const header = btoa(
          JSON.stringify({
            success: true,
            network: "base-sepolia",
            payer: PAYER,
          }),
        );
        return jsonResponse(200, { message: "paid" }, { "x-payment-response": header });
      },
    ],
    [
      "wrong-payer",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          {
            "x-payment-response": paymentProofHeader({
              payer: "0x0000000000000000000000000000000000000001",
            }),
          },
        );
      },
    ],
    [
      "transport-failed settlement evidence",
      (request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return Promise.reject(new Error("transport failed after payment signature"));
      },
    ],
  ])(
    "returns terminal unreconciled_possible_spend after EVM auto-pay sign for %s",
    async (_label, paid) => {
      const { wallet, result } = await invokeAutoPay("evm", autoPayHandlers(paid));
      expect(wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(result.status).toBe("unreconciled_possible_spend");
      expect(result.possibleSpend).toBe(true);
      expect(Number(result.signCount)).toBeGreaterThanOrEqual(1);
      expect(result.success).not.toBe(true);
      expect(result.paymentProof ?? null).toBeNull();
      expect(JSON.stringify(result)).not.toMatch(/payment was not settled/i);
    },
  );
});

describe("X402ActionProvider auto-pay exported settlement (SVM)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("promotes SVM auto-pay only with official decoded successful settlement", async () => {
    const harness = await createSvmHarness();
    const payer = harness.wallet.getAddress();
    installScriptedFetch(
      autoPayHandlers(
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": svmPaymentProofHeader(payer) },
          );
        },
        v1Envelope([svmV1Requirement()]),
      ),
    );
    const result = await invokeAction(harness.autoPay, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    expect(harness.wallet.signCalls).toBeGreaterThanOrEqual(1);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect((result.paymentProof as { success: boolean }).success).toBe(true);
    expect(
      String((result.paymentProof as { transaction: string }).transaction).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    [
      "missing settlement header",
      (_payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(200, { message: "paid" });
      },
    ],
    [
      "malformed header",
      (_payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": "not-valid-base64!!!" },
        );
      },
    ],
    [
      "unsuccessful",
      (payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": svmPaymentProofHeader(payer, { success: false }) },
        );
      },
    ],
    [
      "wrong-network",
      (payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": svmPaymentProofHeader(payer, { network: "solana" }) },
        );
      },
    ],
    [
      "transactionless empty tx",
      (payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": svmPaymentProofHeader(payer, { transaction: "" }) },
        );
      },
    ],
    [
      "transactionless missing tx",
      (payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        const header = btoa(
          JSON.stringify({
            success: true,
            network: "solana-devnet",
            payer,
          }),
        );
        return jsonResponse(200, { message: "paid" }, { "x-payment-response": header });
      },
    ],
    [
      "wrong-payer",
      (_payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return jsonResponse(
          200,
          { message: "paid" },
          { "x-payment-response": svmPaymentProofHeader(SVM_PAY_TO) },
        );
      },
    ],
    [
      "transport-failed settlement evidence",
      (_payer: string, request: Request) => {
        expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
          true,
        );
        return Promise.reject(new Error("transport failed after payment signature"));
      },
    ],
  ])(
    "returns terminal unreconciled_possible_spend after SVM auto-pay sign for %s",
    async (_label, paidFor) => {
      const harness = await createSvmHarness();
      const payer = harness.wallet.getAddress();
      installScriptedFetch(
        autoPayHandlers(request => paidFor(payer, request), v1Envelope([svmV1Requirement()])),
      );
      const result = await invokeAction(harness.autoPay, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
      });
      expect(harness.wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(result.status).toBe("unreconciled_possible_spend");
      expect(result.possibleSpend).toBe(true);
      expect(Number(result.signCount)).toBeGreaterThanOrEqual(1);
      expect(result.success).not.toBe(true);
      expect(result.paymentProof ?? null).toBeNull();
      expect(JSON.stringify(result)).not.toMatch(/payment was not settled/i);
    },
  );
});

describe("X402ActionProvider A3 settlement identity (prepared retry)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ["missing payer", { payer: undefined }],
    ["empty payer", { payer: "" }],
    ["missing network", { network: undefined }],
    ["empty network", { network: "" }],
    ["malformed transaction not-a-tx", { transaction: "not-a-tx" }],
    ["malformed transaction x", { transaction: "x" }],
    ["wrong-family transaction", { transaction: SVM_WELL_FORMED_TX }],
  ])(
    "returns terminal unreconciled_possible_spend after prepared EVM sign for %s",
    async (_label, overrides) => {
      const result = await inspectAndRetry({
        inspectHandlers: [() => jsonResponse(402, v1Envelope([v1Requirement()]))],
        retryHandlers: [
          request => {
            expect(
              request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE"),
            ).toBe(true);
            return jsonResponse(
              200,
              { message: "paid" },
              { "x-payment-response": paymentProofHeader(overrides) },
            );
          },
        ],
      });
      expect(result.wallet.signCalls).toBe(1);
      expect(result.retry.status).toBe("unreconciled_possible_spend");
      expect(result.retry.possibleSpend).toBe(true);
      expect(result.retry.signCount).toBe(1);
      expect(result.retry.status).not.toBe("success");
      expect(JSON.stringify(result.retry)).not.toMatch(/payment was not settled/i);
    },
  );

  it.each([
    ["missing payer", (payer: string) => ({ payer: undefined, network: "solana-devnet" })],
    ["empty payer", (payer: string) => ({ payer: "" })],
    ["missing network", (payer: string) => ({ network: undefined, payer })],
    ["empty network", (payer: string) => ({ network: "", payer })],
    ["malformed transaction not-a-tx", (payer: string) => ({ transaction: "not-a-tx", payer })],
    ["malformed transaction x", (payer: string) => ({ transaction: "x", payer })],
    ["wrong-family transaction", (payer: string) => ({ transaction: EVM_WELL_FORMED_TX, payer })],
    ["case-mutated SVM payer", (payer: string) => ({ payer: mutateBase58Case(payer) })],
  ])(
    "returns terminal unreconciled_possible_spend after prepared SVM sign for %s",
    async (_label, overridesFor) => {
      const { wallet, make, retry } = await createSvmHarness();
      installScriptedFetch([() => jsonResponse(402, v1Envelope([svmV1Requirement()]))]);
      const inspect = await invokeAction(make, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
      });
      installScriptedFetch(svmPaidReplay(wallet.getAddress(), overridesFor(wallet.getAddress())));
      const retryResult = await invokeAction(retry, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
        quoteBinding: inspect.quoteBinding,
        selectedPaymentOption: svmSelected(),
      });
      expect(wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(retryResult.status).toBe("unreconciled_possible_spend");
      expect(retryResult.possibleSpend).toBe(true);
      expect(Number(retryResult.signCount)).toBeGreaterThanOrEqual(1);
      expect(retryResult.status).not.toBe("success");
      expect(JSON.stringify(retryResult)).not.toMatch(/payment was not settled/i);
    },
  );
});

describe("X402ActionProvider A3 settlement identity (auto-pay)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("does not promote unsigned auto-pay HTTP 200 with null official settlement", async () => {
    const { wallet, result } = await invokeAutoPay("evm", [
      () => jsonResponse(200, { message: "free" }),
    ]);
    expect(wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.signCount).toBe(0);
    expect(result.possibleSpend).not.toBe(true);
    expect(String(result.message)).toMatch(/without a well-formed payment-response/i);
  });

  it.each([
    ["missing payer", { payer: undefined }],
    ["empty payer", { payer: "" }],
    ["missing network", { network: undefined }],
    ["empty network", { network: "" }],
    ["malformed transaction not-a-tx", { transaction: "not-a-tx" }],
    ["malformed transaction x", { transaction: "x" }],
    ["wrong-family transaction", { transaction: SVM_WELL_FORMED_TX }],
  ])(
    "returns terminal unreconciled_possible_spend after EVM auto-pay sign for %s",
    async (_label, overrides) => {
      const { wallet, result } = await invokeAutoPay(
        "evm",
        autoPayHandlers(request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": paymentProofHeader(overrides) },
          );
        }),
      );
      expect(wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(result.status).toBe("unreconciled_possible_spend");
      expect(result.possibleSpend).toBe(true);
      expect(Number(result.signCount)).toBeGreaterThanOrEqual(1);
      expect(result.success).not.toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/payment was not settled/i);
    },
  );

  it.each([
    ["missing payer", (payer: string) => ({ payer: undefined, network: "solana-devnet" })],
    ["empty payer", (payer: string) => ({ payer: "" })],
    ["missing network", (payer: string) => ({ network: undefined, payer })],
    ["empty network", (payer: string) => ({ network: "", payer })],
    ["malformed transaction not-a-tx", (payer: string) => ({ transaction: "not-a-tx", payer })],
    ["malformed transaction x", (payer: string) => ({ transaction: "x", payer })],
    ["wrong-family transaction", (payer: string) => ({ transaction: EVM_WELL_FORMED_TX, payer })],
    ["case-mutated SVM payer", (payer: string) => ({ payer: mutateBase58Case(payer) })],
  ])(
    "returns terminal unreconciled_possible_spend after SVM auto-pay sign for %s",
    async (_label, overridesFor) => {
      const harness = await createSvmHarness();
      const payer = harness.wallet.getAddress();
      installScriptedFetch(
        autoPayHandlers(
          request => {
            expect(
              request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE"),
            ).toBe(true);
            return jsonResponse(
              200,
              { message: "paid" },
              { "x-payment-response": svmPaymentProofHeader(payer, overridesFor(payer)) },
            );
          },
          v1Envelope([svmV1Requirement()]),
        ),
      );
      const result = await invokeAction(harness.autoPay, {
        url: PROTECTED_URL,
        method: "GET",
        headers: null,
        queryParams: null,
        body: null,
      });
      expect(harness.wallet.signCalls).toBeGreaterThanOrEqual(1);
      expect(result.status).toBe("unreconciled_possible_spend");
      expect(result.possibleSpend).toBe(true);
      expect(Number(result.signCount)).toBeGreaterThanOrEqual(1);
      expect(result.success).not.toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/payment was not settled/i);
    },
  );

  it("fails closed before sign when auto-pay 402 has zero matching requirements", async () => {
    const { wallet, result } = await invokeAutoPay("evm", [
      () => jsonResponse(402, v1Envelope([v1Requirement({ network: "base" })])),
    ]);
    expect(wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.possibleSpend).not.toBe(true);
    expect(result.signCount).toBe(0);
    expect(String(result.message) + String(result.details)).toMatch(
      /exact-one|found 0|Cannot freeze/i,
    );
  });

  it("fails closed before sign when auto-pay 402 is not exact-one (requirement drift)", async () => {
    const original = v1Requirement({ maxAmountRequired: "10000" });
    const drifted = v1Requirement({
      maxAmountRequired: "20000",
      payTo: "0x0000000000000000000000000000000000000001",
    });
    const { wallet, result, calls } = await invokeAutoPay("evm", [
      () => jsonResponse(402, v1Envelope([original, drifted])),
      () => {
        throw new Error("later 402 must not be fetched after refuse");
      },
    ]);
    expect(wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.possibleSpend).not.toBe(true);
    expect(result.signCount).toBe(0);
    expect(calls).toHaveLength(1);
    expect(String(result.message) + String(result.details)).toMatch(
      /exact-one|multiple|drift|Cannot freeze/i,
    );
  });

  it("fails closed before sign when SVM auto-pay 402 is not exact-one (requirement drift)", async () => {
    const original = svmV1Requirement({ maxAmountRequired: "10000" });
    const drifted = svmV1Requirement({
      maxAmountRequired: "20000",
      payTo: "So11111111111111111111111111111111111111113",
    });
    const harness = await createSvmHarness();
    installScriptedFetch([() => jsonResponse(402, v1Envelope([original, drifted]))]);
    const result = await invokeAction(harness.autoPay, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    expect(harness.wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.possibleSpend).not.toBe(true);
    expect(result.signCount).toBe(0);
  });
});

describe("X402ActionProvider auto-pay maxPaymentUsdc before sign", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("rejects over-limit frozen auto-pay (2 USDC > maxPaymentUsdc 1) before sign on EVM", async () => {
    const { wallet, result, calls } = await invokeAutoPay("evm", [
      () => jsonResponse(402, v1Envelope([v1Requirement({ maxAmountRequired: "2000000" })])),
      () => {
        throw new Error("paid replay must not run after over-limit refuse");
      },
    ]);
    expect(wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.possibleSpend).not.toBe(true);
    expect(result.signCount).toBe(0);
    expect(calls).toHaveLength(1);
    expect(String(result.message) + String(result.details)).toMatch(/exceeds|limit/i);
  });

  it("allows exact-limit frozen auto-pay (1 USDC == maxPaymentUsdc 1) to proceed to sign on EVM", async () => {
    const { wallet, result, calls } = await invokeAutoPay(
      "evm",
      autoPayHandlers(
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": paymentProofHeader() },
          );
        },
        v1Envelope([v1Requirement({ maxAmountRequired: "1000000" })]),
      ),
    );
    expect(wallet.signCalls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(Number(result.signCount)).toBe(1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects over-limit frozen auto-pay (2 USDC > maxPaymentUsdc 1) before sign on SVM", async () => {
    const harness = await createSvmHarness();
    const fetchState = installScriptedFetch([
      () => jsonResponse(402, v1Envelope([svmV1Requirement({ maxAmountRequired: "2000000" })])),
      () => {
        throw new Error("paid replay must not run after over-limit refuse");
      },
    ]);
    const result = await invokeAction(harness.autoPay, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    expect(harness.wallet.signCalls).toBe(0);
    expect(result.success).not.toBe(true);
    expect(result.possibleSpend).not.toBe(true);
    expect(result.signCount).toBe(0);
    expect(fetchState.calls).toHaveLength(1);
    expect(String(result.message) + String(result.details)).toMatch(/exceeds|limit/i);
  });

  it("allows exact-limit frozen auto-pay (1 USDC == maxPaymentUsdc 1) to proceed to sign on SVM", async () => {
    const harness = await createSvmHarness();
    const payer = harness.wallet.getAddress();
    installScriptedFetch(
      autoPayHandlers(
        request => {
          expect(request.headers.has("X-PAYMENT") || request.headers.has("PAYMENT-SIGNATURE")).toBe(
            true,
          );
          return jsonResponse(
            200,
            { message: "paid" },
            { "x-payment-response": svmPaymentProofHeader(payer) },
          );
        },
        v1Envelope([svmV1Requirement({ maxAmountRequired: "1000000" })]),
      ),
    );
    const result = await invokeAction(harness.autoPay, {
      url: PROTECTED_URL,
      method: "GET",
      headers: null,
      queryParams: null,
      body: null,
    });
    expect(harness.wallet.signCalls).toBeGreaterThanOrEqual(1);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(Number(result.signCount)).toBeGreaterThanOrEqual(1);
  });
});
