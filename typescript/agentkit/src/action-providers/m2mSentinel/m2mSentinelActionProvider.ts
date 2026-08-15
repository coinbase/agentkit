import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  AuditContractSchema,
  GetGasMetricsSchema,
  GetTokenPriceSchema,
  GetServiceStatusSchema,
  M2MSentinelConfig,
} from "./schemas";
import { SUPPORTED_NETWORKS, DEFAULT_BASE_URL } from "./constants";

/**
 * M2MSentinelActionProvider enables AI agents on Base to perform preflight bytecode
 * inspection, EIP-1967/UUPS proxy detection, token capability observations, and network metrics.
 */
export class M2MSentinelActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  /**
   * Creates an instance of M2MSentinelActionProvider.
   *
   * @param config - Optional configuration object
   */
  constructor(config?: M2MSentinelConfig) {
    super("m2m_sentinel", []);
    this.baseUrl = config?.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = config?.apiKey || process.env.M2M_SENTINEL_API_KEY;
  }

  /**
   * Checks if the target network is supported by M2M Sentinel.
   *
   * @param network - The network instance to validate
   * @returns True if network is Base mainnet or Base Sepolia
   */
  supportsNetwork(network: Network): boolean {
    const chainId = String(network.chainId || network.networkId || "");
    const protocolFamily = String(network.protocolFamily || "evm").toLowerCase();
    return (
      protocolFamily === "evm" &&
      (SUPPORTED_NETWORKS.includes(network.networkId || "") ||
        chainId === "8453" ||
        chainId === "84532")
    );
  }

  private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "CoinbaseAgentKit-M2MSentinel/1.1.0",
      ...(init?.headers as Record<string, string>),
    };
    if (this.apiKey && !headers["x-api-key"]) {
      headers["x-api-key"] = this.apiKey;
    }
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
  }

  /**
   * Inspects a Base target contract for bytecode capability observations, proxy implementation slots, and limitations.
   *
   * @param _wallet - The wallet provider instance (not consumed for read operations)
   * @param args - Arguments containing target contract address
   * @returns Factual audit observations and proxy resolution
   */
  @CreateAction({
    name: "audit_contract",
    description:
      "Inspect Base smart contract bytecode capability observations, proxy implementation slots, and limitations before executing transactions. Returns factual evidence, not a safety guarantee.",
    schema: AuditContractSchema,
  })
  async auditContract(
    _wallet: EvmWalletProvider,
    args: z.infer<typeof AuditContractSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchApi(`/v1/audit/${encodeURIComponent(args.address)}`);
      if (res.status === 402) {
        return JSON.stringify({
          status: "PAYMENT_REQUIRED",
          message: "Payment required. Authenticate with an M2M Sentinel API key or settle the x402 challenge.",
          notASafetyGuarantee: true,
        });
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return JSON.stringify({
          status: "ERROR",
          statusCode: res.status,
          message: errBody.message || `Audit request failed with HTTP ${res.status}`,
          notASafetyGuarantee: true,
        });
      }
      const data = await res.json();
      return JSON.stringify({
        status: "SUCCESS",
        data,
        notASafetyGuarantee: true,
      });
    } catch (err) {
      return JSON.stringify({
        status: "ERROR",
        message: err instanceof Error ? err.message : String(err),
        notASafetyGuarantee: true,
      });
    }
  }

  /**
   * Retrieves real-time Base network gas execution metrics.
   *
   * @param _wallet - The wallet provider instance
   * @param _args - Empty arguments
   * @returns Base network gas recommendations
   */
  @CreateAction({
    name: "get_gas_metrics",
    description: "Get real-time Base network gas execution metrics and fee recommendations before submitting transactions.",
    schema: GetGasMetricsSchema,
  })
  async getGasMetrics(
    _wallet: EvmWalletProvider,
    _args: z.infer<typeof GetGasMetricsSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchApi("/v1/gas/fees");
      if (!res.ok) {
        return JSON.stringify({ status: "ERROR", statusCode: res.status, message: "Failed to retrieve gas fees" });
      }
      return JSON.stringify(await res.json());
    } catch (err) {
      return JSON.stringify({ status: "ERROR", message: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Observes real-time Base DEX token price for slippage check and preflight valuation.
   *
   * @param _wallet - The wallet provider instance
   * @param args - Token symbol argument
   * @returns Token price observation
   */
  @CreateAction({
    name: "get_token_price",
    description: "Observe real-time Base DEX token price for slippage verification and valuation.",
    schema: GetTokenPriceSchema,
  })
  async getTokenPrice(
    _wallet: EvmWalletProvider,
    args: z.infer<typeof GetTokenPriceSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchApi(`/v1/token/price/${encodeURIComponent(args.symbol.toUpperCase())}`);
      if (!res.ok) {
        return JSON.stringify({ status: "ERROR", statusCode: res.status, message: `Failed to retrieve price for ${args.symbol}` });
      }
      return JSON.stringify(await res.json());
    } catch (err) {
      return JSON.stringify({ status: "ERROR", message: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Checks operational status of M2M Sentinel verification rails.
   *
   * @param _wallet - The wallet provider instance
   * @param _args - Empty arguments
   * @returns Service status response
   */
  @CreateAction({
    name: "get_service_status",
    description: "Check operational status of M2M Sentinel upstream verification rails and quorum.",
    schema: GetServiceStatusSchema,
  })
  async getServiceStatus(
    _wallet: EvmWalletProvider,
    _args: z.infer<typeof GetServiceStatusSchema>,
  ): Promise<string> {
    try {
      const res = await this.fetchApi("/v1/status");
      if (!res.ok) {
        return JSON.stringify({ status: "UNAVAILABLE", statusCode: res.status });
      }
      return JSON.stringify(await res.json());
    } catch (err) {
      return JSON.stringify({ status: "UNAVAILABLE", message: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const m2mSentinelActionProvider = (config?: M2MSentinelConfig) =>
  new M2MSentinelActionProvider(config);
