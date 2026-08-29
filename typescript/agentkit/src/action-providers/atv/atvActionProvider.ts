import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  ListVaultsSchema,
  GetVaultNavSchema,
  GetVaultTvlSchema,
  GetVaultApySchema,
  BuildDepositTxSchema,
  BuildWithdrawTxSchema,
} from "./schemas";

const ATV_BASE_URL = "https://atv-api.aarna.ai";

/**
 * AtvActionProvider provides access to Aarna Tokenized Vault (ATV) DeFi yield vaults.
 *
 * It enables AI agents to discover vaults, query performance metrics (NAV, TVL, APY),
 * and build deposit/withdraw transactions on Ethereum and Base.
 *
 * All endpoints require an ATV API key passed via the `x-api-key` header.
 * Get your key at https://aarna.ai or contact dev@aarnalab.dev.
 */
export class AtvActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super("atv", []);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? ATV_BASE_URL;
  }

  private async request(path: string, params?: Record<string, string>): Promise<string> {
    try {
      const url = new URL(path, this.baseUrl);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            url.searchParams.set(key, value);
          }
        }
      }

      const response = await fetch(url.toString(), {
        headers: { "x-api-key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error calling ATV API: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  @CreateAction({
    name: "atv_list_vaults",
    description: `This tool lists all available ATV DeFi yield vaults from Aarna.
It takes the following inputs:
- An optional chain filter (e.g. 'ethereum', 'base')
- An optional user wallet address to include token balances

Important notes:
- Returns vault metadata including address, chain, withdraw type, and supported deposit tokens
- If userAddress is provided, includes ERC-20 balances for each deposit token
- Vaults are available on Ethereum and Base networks`,
    schema: ListVaultsSchema,
  })
  async listVaults(args: z.infer<typeof ListVaultsSchema>): Promise<string> {
    const params: Record<string, string> = {};
    if (args.chain) params.chain = args.chain;
    if (args.userAddress) params.userAddress = args.userAddress;
    return this.request("/v1/vaults", params);
  }

  @CreateAction({
    name: "atv_get_vault_nav",
    description: `This tool gets the current Net Asset Value (NAV) price for an ATV vault.
It takes the following inputs:
- The vault contract address

Important notes:
- NAV represents the price per vault share in USD
- Reads directly from the on-chain vault contract`,
    schema: GetVaultNavSchema,
  })
  async getVaultNav(args: z.infer<typeof GetVaultNavSchema>): Promise<string> {
    return this.request(`/v1/vaults/${args.address}/nav`);
  }

  @CreateAction({
    name: "atv_get_vault_tvl",
    description: `This tool gets the current Total Value Locked (TVL) for an ATV vault.
It takes the following inputs:
- The vault contract address

Important notes:
- TVL is returned in USD
- Reads directly from the on-chain vault contract`,
    schema: GetVaultTvlSchema,
  })
  async getVaultTvl(args: z.infer<typeof GetVaultTvlSchema>): Promise<string> {
    return this.request(`/v1/vaults/${args.address}/tvl`);
  }

  @CreateAction({
    name: "atv_get_vault_apy",
    description: `This tool gets the current APY breakdown for an ATV vault.
It takes the following inputs:
- The vault contract address

Important notes:
- Returns base APY, reward APY, and total APY
- APY is calculated from on-chain vault performance data`,
    schema: GetVaultApySchema,
  })
  async getVaultApy(args: z.infer<typeof GetVaultApySchema>): Promise<string> {
    return this.request(`/v1/vaults/${args.address}/apy`);
  }

  @CreateAction({
    name: "atv_build_deposit_tx",
    description: `This tool builds the transaction calldata to deposit tokens into an ATV vault.
It takes the following inputs:
- The depositor's EVM wallet address
- The vault contract address
- The ERC-20 token address to deposit
- The human-readable deposit amount (e.g. '100' for 100 USDC)

Important notes:
- Returns an ordered array of transactions: first an ERC-20 approve, then the deposit
- Both transactions must be sent in order
- Check deposit status before calling to ensure deposits are not paused`,
    schema: BuildDepositTxSchema,
  })
  async buildDepositTx(args: z.infer<typeof BuildDepositTxSchema>): Promise<string> {
    return this.request("/v1/deposit-tx", {
      userAddress: args.userAddress,
      vaultAddress: args.vaultAddress,
      depositTokenAddress: args.depositTokenAddress,
      depositAmount: args.depositAmount,
    });
  }

  @CreateAction({
    name: "atv_build_withdraw_tx",
    description: `This tool builds the transaction calldata to withdraw from an ATV vault.
It takes the following inputs:
- The withdrawer's EVM wallet address
- The vault contract address
- The output token address to receive
- The number of vault shares to withdraw
- An optional slippage tolerance percentage

Important notes:
- Returns transaction calldata ready to be signed and sent
- Check withdraw status before calling to ensure withdrawals are not paused
- Slippage defaults to 0 if not specified`,
    schema: BuildWithdrawTxSchema,
  })
  async buildWithdrawTx(args: z.infer<typeof BuildWithdrawTxSchema>): Promise<string> {
    const params: Record<string, string> = {
      userAddress: args.userAddress,
      vaultAddress: args.vaultAddress,
      oTokenAddress: args.oTokenAddress,
      sharesToWithdraw: args.sharesToWithdraw,
    };
    if (args.slippage) params.slippage = args.slippage;
    return this.request("/v1/withdraw-tx", params);
  }

  /**
   * ATV is an API-based provider and works across all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Factory function to create an ATV action provider.
 *
 * @param apiKey - ATV API key (get one at https://aarna.ai or contact dev@aarnalab.dev)
 * @param baseUrl - Optional custom API base URL (defaults to https://atv-api.aarna.ai)
 * @returns A new AtvActionProvider instance
 */
export const atvActionProvider = (apiKey: string, baseUrl?: string) =>
  new AtvActionProvider(apiKey, baseUrl);
