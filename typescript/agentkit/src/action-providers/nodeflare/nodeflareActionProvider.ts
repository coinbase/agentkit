import { z } from "zod";
import { encodeFunctionData, decodeFunctionResult, formatUnits, type Abi } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  GetSupportedChainsSchema,
  GetBlockNumberSchema,
  GetNativeBalanceSchema,
  GetErc20BalanceSchema,
  GetTokenMetadataSchema,
  GetGasPriceSchema,
  GetTransactionSchema,
} from "./schemas";

/**
 * The EVM chains NodeFlare serves, keyed by slug. Each has a public keyless read
 * endpoint at https://rpc.nodeflare.app/{slug}/public.
 */
const CHAINS: Record<string, { label: string; chainId: number; currency: string }> = {
  eth: { label: "Ethereum", chainId: 1, currency: "ETH" },
  base: { label: "Base", chainId: 8453, currency: "ETH" },
  bnb: { label: "BNB Chain", chainId: 56, currency: "BNB" },
  arb: { label: "Arbitrum One", chainId: 42161, currency: "ETH" },
  op: { label: "Optimism", chainId: 10, currency: "ETH" },
  hl: { label: "HyperEVM (HyperLiquid)", chainId: 999, currency: "HYPE" },
  avax: { label: "Avalanche C-Chain", chainId: 43114, currency: "AVAX" },
  unichain: { label: "Unichain", chainId: 130, currency: "ETH" },
  sonic: { label: "Sonic", chainId: 146, currency: "S" },
  polygon: { label: "Polygon PoS", chainId: 137, currency: "POL" },
  linea: { label: "Linea", chainId: 59144, currency: "ETH" },
  mantle: { label: "Mantle", chainId: 5000, currency: "MNT" },
  zircuit: { label: "Zircuit", chainId: 48900, currency: "ETH" },
  robinhood: { label: "Robinhood Chain", chainId: 4663, currency: "ETH" },
  xlayer: { label: "XLayer", chainId: 196, currency: "OKB" },
  soneium: { label: "Soneium", chainId: 1868, currency: "ETH" },
  nova: { label: "Arbitrum Nova", chainId: 42170, currency: "ETH" },
  bob: { label: "BOB", chainId: 60808, currency: "ETH" },
  ink: { label: "Ink", chainId: 57073, currency: "ETH" },
  cronos: { label: "Cronos", chainId: 25, currency: "CRO" },
  mode: { label: "Mode", chainId: 34443, currency: "ETH" },
  sei: { label: "Sei", chainId: 1329, currency: "SEI" },
  plasma: { label: "Plasma", chainId: 9745, currency: "XPL" },
};

const ALIASES: Record<string, string> = {
  ethereum: "eth",
  mainnet: "eth",
  arbitrum: "arb",
  "arbitrum-one": "arb",
  "arbitrum-nova": "nova",
  optimism: "op",
  bsc: "bnb",
  binance: "bnb",
  "bnb-chain": "bnb",
  avalanche: "avax",
  matic: "polygon",
  pol: "polygon",
  hyperevm: "hl",
  hyperliquid: "hl",
  "x-layer": "xlayer",
};

const BY_CHAIN_ID: Record<number, string> = Object.fromEntries(
  Object.entries(CHAINS).map(([slug, c]) => [c.chainId, slug]),
);

const GATEWAY = "https://rpc.nodeflare.app";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

/**
 * Resolve a slug, common name, or numeric chain ID to a canonical slug (or null).
 *
 * @param input - The chain identifier provided by the model.
 * @returns The canonical chain slug, or null if unknown.
 */
function resolveChain(input: string): string | null {
  const s = String(input ?? "")
    .trim()
    .toLowerCase();
  if (CHAINS[s]) return s;
  if (ALIASES[s]) return ALIASES[s];
  const n = s.startsWith("0x") ? parseInt(s, 16) : /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (!Number.isNaN(n) && BY_CHAIN_ID[n]) return BY_CHAIN_ID[n];
  return null;
}

/**
 * Make one JSON-RPC call against NodeFlare's public keyless endpoint for a chain.
 *
 * @param slug - The canonical chain slug.
 * @param method - The JSON-RPC method name.
 * @param params - The JSON-RPC params.
 * @returns The JSON-RPC result.
 */
async function nodeflareRpc(slug: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(`${GATEWAY}/${slug}/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: unknown; message?: string };
  if (json.error !== undefined && json.error !== null) {
    const msg =
      typeof json.error === "string"
        ? (json.message ?? json.error)
        : ((json.error as { message?: string }).message ?? "RPC error");
    throw new Error(msg);
  }
  return json.result;
}

/**
 * Batch several eth_calls into ONE JSON-RPC request. A batch counts as a single
 * rate-limit token, so multi-read actions don't trip the per-IP public limit.
 *
 * @param slug - The canonical chain slug.
 * @param calls - The list of { to, data } eth_call payloads.
 * @returns The result hex per call (null for a call that errored).
 */
async function ethCallBatch(
  slug: string,
  calls: { to: string; data: string }[],
): Promise<(string | null)[]> {
  const batch = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "eth_call",
    params: [c, "latest"],
  }));
  const res = await fetch(`${GATEWAY}/${slug}/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) {
    const e = body as { error?: unknown; message?: string };
    throw new Error(e.message ?? (typeof e.error === "string" ? e.error : "batch request failed"));
  }
  const byId = new Map(
    (body as Array<{ id: number; result?: unknown; error?: unknown }>).map(r => [r.id, r]),
  );
  return calls.map((_, i) => {
    const r = byId.get(i);
    return r && !r.error && typeof r.result === "string" ? r.result : null;
  });
}

const erc20Call = (token: string, fn: "balanceOf" | "decimals" | "symbol" | "name" | "totalSupply", args: unknown[] = []) => ({
  to: token,
  data: encodeFunctionData({ abi: ERC20_ABI, functionName: fn, args: args as never }),
});

const unknownChain = (input: string) =>
  `Error: unknown chain '${input}'. NodeFlare serves: ${Object.keys(CHAINS).join(", ")}. Pass a slug, name, or chain ID.`;

/**
 * NodeflareActionProvider gives an agent read access to on-chain data across the
 * 23 EVM chains NodeFlare serves — Ethereum, Base, Arbitrum, Optimism, BNB and
 * young chains like Robinhood Chain, Plasma and Ink — through NodeFlare's public
 * gateway. Every action takes an explicit `chain` argument (slug, name, or chain
 * ID), so an agent reads any supported chain without configuring a per-chain RPC.
 * All actions are read-only and keyless; the injected wallet provider is not used.
 */
export class NodeflareActionProvider extends ActionProvider {
  /**
   * Creates a new instance of NodeflareActionProvider.
   */
  constructor() {
    super("nodeflare", []);
  }

  /**
   * Lists the EVM chains NodeFlare serves, with chain IDs and native currencies.
   *
   * @returns A human-readable list of supported chains.
   */
  @CreateAction({
    name: "get_supported_chains",
    description:
      "Lists the EVM chains NodeFlare serves, with their chain IDs and native currencies. Use this to discover valid `chain` values for the other actions.",
    schema: GetSupportedChainsSchema,
  })
  async getSupportedChains(): Promise<string> {
    const rows = Object.entries(CHAINS).map(
      ([slug, c]) => `${slug} (chainId ${c.chainId}, ${c.currency}) — ${c.label}`,
    );
    return `NodeFlare serves ${rows.length} EVM chains:\n${rows.join("\n")}`;
  }

  /**
   * Gets the latest block number on a chain.
   *
   * @param args - The chain to query.
   * @returns The latest block number, or an error message.
   */
  @CreateAction({
    name: "get_block_number",
    description: "Gets the latest block number on any supported EVM chain.",
    schema: GetBlockNumberSchema,
  })
  async getBlockNumber(args: z.infer<typeof GetBlockNumberSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const hex = (await nodeflareRpc(slug, "eth_blockNumber", [])) as string;
      return `${CHAINS[slug].label} latest block: ${parseInt(hex, 16)} (${hex})`;
    } catch (error) {
      return `Error fetching block number on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Gets the native-token balance of an address.
   *
   * @param args - The chain and address to query.
   * @returns The native balance, or an error message.
   */
  @CreateAction({
    name: "get_native_balance",
    description:
      "Gets the native gas-token balance of an address on any supported EVM chain (e.g. ETH, BNB, POL, SEI), returned human-readable.",
    schema: GetNativeBalanceSchema,
  })
  async getNativeBalance(args: z.infer<typeof GetNativeBalanceSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const hex = (await nodeflareRpc(slug, "eth_getBalance", [args.address, "latest"])) as string;
      return `${args.address} on ${CHAINS[slug].label}: ${formatUnits(BigInt(hex), 18)} ${CHAINS[slug].currency}`;
    } catch (error) {
      return `Error fetching native balance on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Reads an ERC-20 token balance for a holder.
   *
   * @param args - The chain, token, and holder address.
   * @returns The token balance, or an error message.
   */
  @CreateAction({
    name: "get_erc20_balance",
    description:
      "Reads an ERC-20 token balance for a holder on any supported EVM chain, returned human-readable using the token's decimals.",
    schema: GetErc20BalanceSchema,
  })
  async getErc20Balance(args: z.infer<typeof GetErc20BalanceSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const [balHex, decHex, symHex] = await ethCallBatch(slug, [
        erc20Call(args.tokenAddress, "balanceOf", [args.address]),
        erc20Call(args.tokenAddress, "decimals"),
        erc20Call(args.tokenAddress, "symbol"),
      ]);
      if (balHex === null) {
        return `Error: could not read token balance — check the token address and chain (${CHAINS[slug].label}).`;
      }
      const raw = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: "balanceOf",
        data: balHex as `0x${string}`,
      }) as bigint;
      const decimals = decHex
        ? Number(decodeFunctionResult({ abi: ERC20_ABI, functionName: "decimals", data: decHex as `0x${string}` }))
        : 18;
      let symbol = "";
      try {
        symbol = symHex
          ? String(decodeFunctionResult({ abi: ERC20_ABI, functionName: "symbol", data: symHex as `0x${string}` }))
          : "";
      } catch {
        /* non-standard token */
      }
      return `${args.address} holds ${formatUnits(raw, decimals)} ${symbol} (${args.tokenAddress}) on ${CHAINS[slug].label}`;
    } catch (error) {
      return `Error fetching ERC-20 balance on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Reads ERC-20 token metadata (name, symbol, decimals, total supply).
   *
   * @param args - The chain and token address.
   * @returns The token metadata, or an error message.
   */
  @CreateAction({
    name: "get_token_metadata",
    description:
      "Reads ERC-20 token metadata (name, symbol, decimals, total supply) on any supported EVM chain.",
    schema: GetTokenMetadataSchema,
  })
  async getTokenMetadata(args: z.infer<typeof GetTokenMetadataSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const [nameHex, symHex, decHex, supHex] = await ethCallBatch(slug, [
        erc20Call(args.tokenAddress, "name"),
        erc20Call(args.tokenAddress, "symbol"),
        erc20Call(args.tokenAddress, "decimals"),
        erc20Call(args.tokenAddress, "totalSupply"),
      ]);
      if (decHex === null && supHex === null) {
        return `Error: not an ERC-20 token, or unreachable — check the address on ${CHAINS[slug].label}.`;
      }
      const dec = decHex
        ? Number(decodeFunctionResult({ abi: ERC20_ABI, functionName: "decimals", data: decHex as `0x${string}` }))
        : 18;
      const str = (h: string | null, fn: "name" | "symbol") => {
        try {
          return h ? String(decodeFunctionResult({ abi: ERC20_ABI, functionName: fn, data: h as `0x${string}` })) : "?";
        } catch {
          return "?";
        }
      };
      const supply = supHex
        ? (decodeFunctionResult({ abi: ERC20_ABI, functionName: "totalSupply", data: supHex as `0x${string}` }) as bigint)
        : 0n;
      return `${str(nameHex, "name")} (${str(symHex, "symbol")}) on ${CHAINS[slug].label}: ${dec} decimals, total supply ${formatUnits(supply, dec)}`;
    } catch (error) {
      return `Error fetching token metadata on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Gets the current gas price on a chain, in gwei.
   *
   * @param args - The chain to query.
   * @returns The gas price in gwei, or an error message.
   */
  @CreateAction({
    name: "get_gas_price",
    description: "Gets the current gas price on any supported EVM chain, in gwei.",
    schema: GetGasPriceSchema,
  })
  async getGasPrice(args: z.infer<typeof GetGasPriceSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const hex = (await nodeflareRpc(slug, "eth_gasPrice", [])) as string;
      return `${CHAINS[slug].label} gas price: ${formatUnits(BigInt(hex), 9)} gwei`;
    } catch (error) {
      return `Error fetching gas price on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Looks up a transaction by hash.
   *
   * @param args - The chain and transaction hash.
   * @returns A summary of the transaction, or an error message.
   */
  @CreateAction({
    name: "get_transaction",
    description:
      "Looks up a transaction by hash on any supported EVM chain (from, to, value, block).",
    schema: GetTransactionSchema,
  })
  async getTransaction(args: z.infer<typeof GetTransactionSchema>): Promise<string> {
    const slug = resolveChain(args.chain);
    if (!slug) return unknownChain(args.chain);
    try {
      const tx = (await nodeflareRpc(slug, "eth_getTransactionByHash", [args.txHash])) as Record<
        string,
        string
      > | null;
      if (!tx) return `Transaction ${args.txHash} not found on ${CHAINS[slug].label}.`;
      const value = tx.value ? formatUnits(BigInt(tx.value), 18) : "0";
      const block = tx.blockNumber ? parseInt(tx.blockNumber, 16) : "pending";
      return `Transaction ${args.txHash} on ${CHAINS[slug].label}: from ${tx.from} to ${tx.to}, value ${value} ${CHAINS[slug].currency}, block ${block}`;
    } catch (error) {
      return `Error fetching transaction on ${CHAINS[slug].label}: ${error}`;
    }
  }

  /**
   * Checks if the NodeFlare action provider supports the given network.
   * The actions take an explicit `chain` argument, so they are available on any
   * network the host agent is configured for.
   *
   * @returns True, always.
   */
  supportsNetwork = (): boolean => true;
}

/**
 * Factory for a {@link NodeflareActionProvider} instance.
 *
 * @returns A new NodeflareActionProvider.
 */
export const nodeflareActionProvider = () => new NodeflareActionProvider();
