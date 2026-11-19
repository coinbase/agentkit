import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { WalletProvider } from "../../wallet-providers";
import { NULLCLEAR_API_BASE_URL } from "./constants";
import {
  DecodeCalldataSchema,
  InspectContractSchema,
  PreflightGuardSchema,
  ScanTokenSchema,
  SimulateTxSchema,
} from "./schemas";
import { NullClearActionProviderConfig } from "./types";
import { callNullClearApi, inferEvmChain, inferForensicChain } from "./utils";

/**
 * NullClearActionProvider equips AgentKit agents with a 7-chain Pre-Execution Security Firewall
 * (Base, Ethereum, Arbitrum, Optimism, Polygon, BSC, Solana) to screen tokens, EIP-712 Permits,
 * nested Multicall3/Universal Router calldata, proxy upgradeability, and transaction simulations
 * before signing or broadcasting.
 */
export class NullClearActionProvider extends ActionProvider<WalletProvider> {
  private readonly apiBaseUrl: string;
  private readonly apiKey?: string;

  /**
   * Creates a new NullClearActionProvider instance.
   *
   * @param config - Optional API base URL and Prepaid Pass (`nc_live_...`) Bearer key.
   */
  constructor(config: NullClearActionProviderConfig = {}) {
    super("nullclear", []);
    this.apiBaseUrl = (config.apiBaseUrl || NULLCLEAR_API_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  /**
   * Executes NullClear's 1-call composite Pre-Sign Firewall (`POST /v1/guard`).
   *
   * @param walletProvider - The connected AgentKit wallet provider.
   * @param args - Transaction, EIP-712 typed data, or Solana wire transaction parameters.
   * @returns JSON security report containing `recommendedAgentAction` (`EXECUTE_SAFE`, `CAUTION_HIGH_RISK`, `ABORT_*`).
   */
  @CreateAction({
    name: "preflight_guard",
    description: `Runs NullClear's 1-call Pre-Sign Firewall (POST /v1/guard) BEFORE signing or sending any transaction or EIP-712 Permit.
Recursively unwraps nested Multicall3, Universal Router, and Safe calldata, audits EIP-712 Permit / Seaport signatures, simulates stateful balance changes (eth_simulateV1 or Solana simulateTransaction), and scans all touched token contracts across Base, Ethereum, Arbitrum, Optimism, Polygon, BSC, and Solana.
Always check \`recommendedAgentAction\` in the JSON response: proceed on EXECUTE_SAFE, warn on CAUTION_HIGH_RISK, and abort immediately on ABORT_CRITICAL_TRAP, ABORT_DRAINER_APPROVAL, or ABORT_WILL_REVERT.`,
    schema: PreflightGuardSchema,
  })
  async preflightGuard(
    walletProvider: WalletProvider,
    args: z.infer<typeof PreflightGuardSchema>,
  ): Promise<string> {
    try {
      const chain = inferForensicChain(walletProvider, args.chain);
      const from = args.from || walletProvider.getAddress();
      return await callNullClearApi(
        this.apiBaseUrl,
        "/v1/guard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain,
            from,
            ...(args.to ? { to: args.to } : {}),
            ...(args.data ? { data: args.data } : {}),
            ...(args.value ? { value: args.value } : {}),
            ...(args.typedData ? { typedData: args.typedData } : {}),
            ...(args.transaction ? { transaction: args.transaction } : {}),
          }),
        },
        this.apiKey,
      );
    } catch (error: unknown) {
      return `Error running NullClear preflight guard: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Audits a token contract across 7 chains for honeypots, hidden sell taxes, proxy risks, or Token-2022 hooks.
   *
   * @param walletProvider - The connected AgentKit wallet provider.
   * @param args - Token address and optional target chain.
   * @returns JSON token audit summary with `recommendedAgentAction`.
   */
  @CreateAction({
    name: "scan_token",
    description: `Audits an ERC-20, SPL, or Solana Token-2022 token BEFORE swapping or holding.
Detects honeypots, hidden buy/sell taxes, mutable proxies, blacklist hooks, and Token-2022 PermanentDelegate/TransferFee extensions across Base, Ethereum, Arbitrum, Optimism, Polygon, BSC, and Solana.
Chain is automatically inferred from the agent's active wallet network when omitted.`,
    schema: ScanTokenSchema,
  })
  async scanToken(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScanTokenSchema>,
  ): Promise<string> {
    try {
      const chain = inferForensicChain(walletProvider, args.chain);
      return await callNullClearApi(
        this.apiBaseUrl,
        `/v1/scan/${encodeURIComponent(chain)}/${encodeURIComponent(args.address)}`,
        { method: "GET" },
        this.apiKey,
      );
    } catch (error: unknown) {
      return `Error scanning token with NullClear: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Inspects an EVM smart contract's proxy slots, Sourcify ABI, and bytecode CFG risk flags.
   *
   * @param walletProvider - The connected AgentKit wallet provider.
   * @param args - Contract address and optional EVM chain.
   * @returns JSON inspection report.
   */
  @CreateAction({
    name: "inspect_contract",
    description: `Inspects an EVM smart contract (Base, Ethereum, Arbitrum, Optimism, Polygon, BSC) for EIP-1967/1822/Beacon/Diamond/Safe proxy implementations, Sourcify verified ABI selectors, and dangerous bytecode patterns (SELFDESTRUCT, DELEGATECALL).`,
    schema: InspectContractSchema,
  })
  async inspectContract(
    walletProvider: WalletProvider,
    args: z.infer<typeof InspectContractSchema>,
  ): Promise<string> {
    try {
      const chain = inferEvmChain(walletProvider, args.chain);
      return await callNullClearApi(
        this.apiBaseUrl,
        `/v1/inspect/${encodeURIComponent(chain)}/${encodeURIComponent(args.address)}`,
        { method: "GET" },
        this.apiKey,
      );
    } catch (error: unknown) {
      return `Error inspecting contract with NullClear: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Decodes hex calldata (with recursive Multicall3/Universal Router/Safe unwrapping) or revert bytes.
   *
   * @param walletProvider - The connected AgentKit wallet provider.
   * @param args - Hex input string and optional chain.
   * @returns JSON decoded call tree and spender trust flags.
   */
  @CreateAction({
    name: "decode_calldata",
    description: `Decodes raw hex calldata, recursively unwraps nested Multicall3/Universal Router/Safe bundles, flags unlimited approve() or setApprovalForAll() drainers, and translates custom Solidity revert errors.`,
    schema: DecodeCalldataSchema,
  })
  async decodeCalldata(
    walletProvider: WalletProvider,
    args: z.infer<typeof DecodeCalldataSchema>,
  ): Promise<string> {
    try {
      const chain = inferForensicChain(walletProvider, args.chain);
      return await callNullClearApi(
        this.apiBaseUrl,
        "/v1/decode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: args.input, chain }),
        },
        this.apiKey,
      );
    } catch (error: unknown) {
      return `Error decoding calldata with NullClear: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Runs stateful pre-execution simulation (`eth_simulateV1` on EVM or `simulateTransaction` on Solana).
   *
   * @param walletProvider - The connected AgentKit wallet provider.
   * @param args - Simulation parameters.
   * @returns JSON simulation report including predicted balance diffs and revert reasons.
   */
  @CreateAction({
    name: "simulate_tx",
    description: `Simulates an EVM transaction (via eth_simulateV1 with Transfer/Approval asset diffs) or a base64 Solana wire transaction BEFORE broadcast to verify state outcomes and avoid reverted gas loss.`,
    schema: SimulateTxSchema,
  })
  async simulateTx(
    walletProvider: WalletProvider,
    args: z.infer<typeof SimulateTxSchema>,
  ): Promise<string> {
    try {
      const chain = inferForensicChain(walletProvider, args.chain);
      const from = args.from || walletProvider.getAddress();
      return await callNullClearApi(
        this.apiBaseUrl,
        "/v1/simulate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain,
            from,
            ...(args.to ? { to: args.to } : {}),
            ...(args.data ? { data: args.data } : {}),
            ...(args.value ? { value: args.value } : {}),
            ...(args.transaction ? { transaction: args.transaction } : {}),
          }),
        },
        this.apiKey,
      );
    } catch (error: unknown) {
      return `Error simulating transaction with NullClear: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks whether NullClear supports the given AgentKit network.
   * Supports both EVM and Solana (SVM) protocol families.
   *
   * @param network - The network descriptor from WalletProvider.
   * @returns True for EVM and Solana networks.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" || network.protocolFamily === "svm";
}

/**
 * Factory function creating a {@link NullClearActionProvider} instance.
 *
 * @param config - Optional configuration with custom API URL or Prepaid Pass Bearer key (`nc_live_...`).
 * @returns A configured NullClearActionProvider instance.
 */
export const nullclearActionProvider = (config?: NullClearActionProviderConfig) =>
  new NullClearActionProvider(config);
