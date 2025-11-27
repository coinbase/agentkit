/**
 * Vaultsfyi Action Provider
 *
 * This file contains the implementation of the VaultsfyiActionProvider,
 * which provides actions for vaultsfyi operations.
 *
 * @module vaultsfyi
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  executeStepActionSchema,
  transactionContextActionSchema,
  VaultDetailsActionSchema,
  VaultHistoricalDataActionSchema,
  VaultsActionSchema,
  claimRewardsActionSchema,
  benchmarkActionSchema,
  historicalBenchmarkActionSchema,
  totalVaultReturnsActionSchema,
  userEventsActionSchema,
} from "./schemas";
import { executeActions, transformApy, transformApyObject, transformVault } from "./utils";
import { getNetworkNameFromChainId, SUPPORTED_CHAIN_IDS } from "./constants";
import { getVaultsSdk } from "./sdk";

/**
 * Configuration options for the VaultsfyiActionProvider.
 */
export interface VaultsfyiActionProviderConfig {
  /**
   * vaults.fyi API Key.
   */
  apiKey?: string;
}

/**
 * VaultsfyiActionProvider provides actions for vaultsfyi operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class VaultsfyiActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey: string;

  /**
   * Constructor for the VaultsfyiActionProvider.
   *
   * @param config - Configuration options for the provider
   */
  constructor(config: VaultsfyiActionProviderConfig = {}) {
    super("vaultsfyi", []);
    const apiKey = config.apiKey || process.env.VAULTSFYI_API_KEY;
    if (!apiKey) {
      throw new Error("VAULTSFYI_API_KEY is not configured.");
    }
    this.apiKey = apiKey;
  }

  /**
   * vaults action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: token, network...
   * @returns A list of vaults.
   */
  @CreateAction({
    name: "vaults",
    description: `
      This action returns a list of available vaults. All asset/lp token amounts returned are in the smallest unit of the token.
      Small vaults (under 100k TVL) are probably best avoided as they may be more risky. Unless the user is looking for high-risk, high-reward opportunities, don't include them.
      When the user asks for best vaults, optimize for apy, and if the user asks for safest/reliable vaults, optimize for TVL.
      Include vaults.fyi links for each vault.
      By default, it's best to check only the vaults for the users network (check with another action if you're not sure).
      Examples:
      User: "Show me the best vaults"
      args: { sort: { field: 'apy7day', direction: 'desc' }, perPage: 5 }
      User: "Show me the safest vaults"
      args: { sort: { field: 'tvl', direction: 'desc' }, perPage: 5 }
      User: "Show me the best vaults on Arbitrum"
      args: { allowedNetworks: ['arbitrum'], sort: { field: 'apy7day', direction: 'desc' }, perPage: 5 }
      User: "I want to earn yield on my usdc on base!"
      args: { allowedAssets: ['usdc'], allowedNetworks: ['base'], sort: { field: 'apy7day', direction: 'desc' }, perPage: 5 }
      User: "What are some of the most profitable degen vaults on polygon"
      args: { allowedNetworks: ['polygon'], sort: { field: 'apy7day', direction: 'desc' }, perPage: 5, minTvl: 0 }
      User: "Show me some more of those"
      args: { allowedNetworks: ['polygon'], sort: { field: 'apy7day', direction: 'desc' }, perPage: 5, minTvl: 0, page: 2 }
      All optional fields should be null if not specified.
    `,
    schema: VaultsActionSchema,
  })
  async vaults(
    wallet: EvmWalletProvider,
    args: z.infer<typeof VaultsActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const vaults = await sdk.getAllVaults({
        query: {
          page: args.page || 1,
          perPage: args.perPage || 5,
          allowedAssets: args.allowedAssets ? args.allowedAssets : undefined,
          allowedNetworks: args.allowedNetworks ? args.allowedNetworks : undefined,
          allowedProtocols: args.allowedProtocols ? args.allowedProtocols : undefined,
          minTvl: args.minTvl ?? 100_000,
          onlyTransactional: true,
          sortBy: args.sort?.field,
          sortOrder: args.sort?.direction,
        },
      });

      const transformedVaults = vaults.data.map(transformVault);

      return JSON.stringify({
        ...vaults,
        data: transformedVaults,
      });
    } catch (error) {
      return `Failed to fetch vaults: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * vault details action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: address, network, apyRange
   * @returns A detailed view of a single vault.
   */
  @CreateAction({
    name: "detailed_vault",
    description: `This action returns single vault details.
      All asset/lp token amounts returned are in the smallest unit of the token.
    `,
    schema: VaultDetailsActionSchema,
  })
  async vaultDetails(
    wallet: EvmWalletProvider,
    args: z.infer<typeof VaultDetailsActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const vault = await sdk.getVault({
        path: {
          vaultAddress: args.vaultAddress,
          network: args.network,
        },
      });
      return JSON.stringify(transformVault(vault));
    } catch (error) {
      return `Failed to fetch vault: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * vault historical data action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: address, network, date, apyRange
   * @returns A detailed view of a single vault.
   */
  @CreateAction({
    name: "vault_historical_data",
    description: `
      This action returns a historical APY, TVL and share price of a vault. 
      It returns an array of data points with the requested granularity. (hourly, daily weekly), 
      The pricing is 3 credits base and 3 credits for each datapoint. 
      Estimate the credits usage and warn the user before executing the action.
      All asset/lp token amounts returned are in the smallest unit of the token.
`,
    schema: VaultHistoricalDataActionSchema,
  })
  async vaultHistoricalData(
    wallet: EvmWalletProvider,
    args: z.infer<typeof VaultHistoricalDataActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const data = await sdk.getVaultHistoricalData({
        path: {
          vaultAddress: args.vaultAddress,
          network: args.network,
        },
        query: {
          granularity: args.granularity,
          fromTimestamp: Math.floor(new Date(args.fromDate).getTime() / 1000),
          toTimestamp: Math.floor(new Date(args.toDate).getTime() / 1000),
          apyInterval: args.apyInterval,
          page: args.page,
          perPage: args.perPage,
        },
      });
      return JSON.stringify({
        ...data,
        data: data.data.map(d => ({
          ...d,
          timestamp: new Date(d.timestamp * 1000).toISOString(),
          apy: transformApy(d.apy),
        })),
      });
    } catch (error) {
      return `Failed to fetch vault historical data: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Transaction context action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments
   * @returns A result message
   */
  @CreateAction({
    name: "transaction_context",
    description: `
      This action returns the transaction context for a given vault. It returns a list of steps for a deposit/redeem from a vault. 
      These steps can be executed using the execute_step action. Check the "redeemStepsType"/"depositStepsType" to see if it's "instant" or "complex". 
      Complex steps might require delay between steps like request and claim flows. Status of these can usually be found in the "vaultSpecificData" field of the context.
      All asset/lp token amounts returned are in the smallest unit of the token. For example, USDC has 6 decimals, so 1000 USDC is 1000000000. Use smallest unit for the amount field in the execute_step action.
      Usage examples:
      User: "Deposit 1000 USDC into the vault"
      actions:
       - check if the wallet has 1000 USDC
       - check vault context to see the deposit steps
       - execute the deposit steps sequentially
      User: "I want more yield on my DAI"
      actions:
       - check positions that the user already has for dai
       - find high yield vaults for dai
       - if there is a vault with higher yield available, redeem from the current vault and deposit into the new vault
       - if users dai wasn't in a vault to begin with, deposit into the new vault
      User: "I want to create a diversified yield strategy"
      actions:
       - check wallet balances for all assets
       - find a couple vaults for each asset, preferably from different protocols
       - create a diversified strategy using the users assets
       - propose the strategy to the user before executing
    `,
    schema: transactionContextActionSchema,
  })
  async transactionContext(
    wallet: EvmWalletProvider,
    args: z.infer<typeof transactionContextActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const context = await sdk.getTransactionsContext({
        path: {
          userAddress: wallet.getAddress(),
          vaultAddress: args.vaultAddress,
          network: args.network,
        },
      });
      return JSON.stringify(context);
    } catch (error) {
      return `Failed to fetch transaction context: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Deposit action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments
   * @returns A result message
   */
  @CreateAction({
    name: "execute_step",
    description: `
      This action executes a given step on a vault. If you're not sure what steps are available, use the transaction context to get more information.
      The amount should be a in smallest unit of the token (f.e. 1000000 for 1 USDC) and for redeeming should be the amount of lpTokens in smallest units.
      If you want to redeem all shares, use {"amount":"all"}.
      Even if you received the balance from some other source, double-check the user balance with idle_assets/positions/context actions before deposit/redeem.`,
    schema: executeStepActionSchema,
  })
  async executeStep(
    wallet: EvmWalletProvider,
    args: z.infer<typeof executeStepActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const amount = args.amount === "all" ? 0 : args.amount;
      const actions = await sdk.getActions({
        path: {
          action: args.action,
          userAddress: wallet.getAddress(),
          vaultAddress: args.vaultAddress,
          network: args.network,
        },
        query: {
          assetAddress: args.assetAddress,
          amount: amount ? amount.toString() : undefined,
          all: args.amount === "all",
        },
      });

      await executeActions(wallet, actions);

      return `Successfully executed ${args.action} step`;
    } catch (error) {
      return `Failed to execute step: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Returns the users wallet token balances.
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @returns A record of the users balances
   */
  @CreateAction({
    name: "user_idle_assets",
    description: `
    This action returns the users wallet balances of all tokens supported by vaults.fyi. Useful when you don't know token addresses but want to check if the user has an asset.
    All asset/lp token amounts returned are in the smallest unit of the token.
    Example queries:
    User: "What tokens do I have?"
    User: "What tokens do I have on Arbitrum?"
    User: "Whats my balance of USDC?"
    `,
    schema: z.object({}),
  })
  async idleAssets(wallet: EvmWalletProvider): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const idleAssets = await sdk.getIdleAssets({
        path: {
          userAddress: wallet.getAddress(),
        },
      });

      return JSON.stringify(idleAssets);
    } catch (error) {
      return `Failed to fetch idle assets: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Returns the users positions.
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @returns A record of the users positions
   */
  @CreateAction({
    name: "positions",
    description: `
      This action returns the users positions in vaults.
      All asset/lp token amounts returned are in the smallest unit of the token.
      Example queries:
      User: "Show me my positions"
      User: "What vaults am i invested in?"
      User: "What's my average yield?"
      User: "What vaults do I have rewards in?"
    `,
    schema: z.object({}),
  })
  async positions(wallet: EvmWalletProvider): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const positions = await sdk.getPositions({
        path: {
          userAddress: wallet.getAddress(),
        },
      });

      return JSON.stringify(positions);
    } catch (error) {
      return `Failed to fetch positions: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Rewards context action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @returns A record of rewards that are available to the user each with a unique claim id
   */
  @CreateAction({
    name: "rewards_context",
    description: `
      This action returns a record of rewards that are available to the user each with a unique claim id. You can use these ids in the claim_rewards action to claim specific rewards.
      All asset/lp token amounts returned are in the smallest unit of the token.
    `,
    schema: z.object({}),
  })
  async rewardsContext(wallet: EvmWalletProvider): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const context = await sdk.getRewardsTransactionsContext({
        path: {
          userAddress: wallet.getAddress(),
        },
      });
      return JSON.stringify(context);
    } catch (error) {
      return `Failed to fetch rewards context: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Claim rewards action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: claimIds
   * @returns A message indicating the success of the claim
   */
  @CreateAction({
    name: "claim_rewards",
    description: `
      This action claims rewards for a given reward id.
    `,
    schema: claimRewardsActionSchema,
  })
  async claimRewards(
    wallet: EvmWalletProvider,
    args: z.infer<typeof claimRewardsActionSchema>,
  ): Promise<string> {
    const chainId = wallet.getNetwork().chainId;
    if (!chainId) return "Invalid network";
    const networkName = getNetworkNameFromChainId(chainId);
    if (!networkName) return "Invalid network";
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const actions = await sdk.getRewardsClaimActions({
        path: {
          userAddress: wallet.getAddress(),
        },
        query: {
          claimIds: args.claimIds,
        },
      });

      if (Object.keys(actions).some(network => network !== networkName)) {
        return `Error: You're trying to claim rewards from a different network. Agent network is ${networkName}.`;
      }
      if (!actions[networkName]) return "No actions found";
      await executeActions(wallet, actions[networkName]);

      return `Successfully claimed rewards for ${args.claimIds.length} rewards`;
    } catch (error) {
      return `Failed to claim rewards: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Benchmark APY action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: network, benchmarkCode
   * @returns benchmark APY data
   */
  @CreateAction({
    name: "benchmark_apy",
    description: `
      This action retrieves benchmark APY data for the specified network and benchmark code. It's a weighted average of top yields for the network and asset. Can be used to benchmark vaults against.
    `,
    schema: benchmarkActionSchema,
  })
  async benchmarkApy(
    wallet: EvmWalletProvider,
    args: z.infer<typeof benchmarkActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const benchmark = await sdk.getBenchmarks({
        path: {
          network: args.network,
        },
        query: {
          code: args.benchmarkCode,
        },
      });
      return JSON.stringify({
        ...benchmark,
        apy: benchmark.apy ? transformApyObject(benchmark.apy) : null,
        timestamp: new Date(benchmark.timestamp * 1000).toISOString(),
      });
    } catch (error) {
      return `Failed to fetch benchmark: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Historical benchmark APY action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: network, benchmarkCode, fromDate, toDate, page, perPage
   * @returns A list of historical benchmark APY data
   */
  @CreateAction({
    name: "historical_benchmark_apy",
    description: `
      This action retrieves historical benchmark APY data for the specified network and benchmark code. It's a weighted average of top yields for the network and asset. Can be used to benchmark vaults against.
    `,
    schema: historicalBenchmarkActionSchema,
  })
  async historicalBenchmarkApy(
    wallet: EvmWalletProvider,
    args: z.infer<typeof historicalBenchmarkActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const historicalBenchmarks = await sdk.getHistoricalBenchmarks({
        path: {
          network: args.network,
        },
        query: {
          code: args.benchmarkCode,
          fromTimestamp: Math.floor(new Date(args.fromDate).getTime() / 1000),
          toTimestamp: Math.floor(new Date(args.toDate).getTime() / 1000),
          page: args.page,
          perPage: args.perPage,
        },
      });
      return JSON.stringify({
        ...historicalBenchmarks,
        data: historicalBenchmarks.data.map(d => ({
          timestamp: new Date(d.timestamp * 1000).toISOString(),
          apy: d.apy ? transformApyObject(d.apy) : null,
        })),
      });
    } catch (error) {
      return `Failed to fetch historical benchmark: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Total vault returns action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: vaultAddress, network, userAddress
   * @returns An amount of the users total returns
   */
  @CreateAction({
    name: "total_vault_returns",
    description: `
      This action retrieves the total returns earned by a given user for a given vault. Uses your address if userAddress not specified.
      "returnsNative" amounts returned are in the smallest unit of the token.
    `,
    schema: totalVaultReturnsActionSchema,
  })
  async totalVaultReturns(
    wallet: EvmWalletProvider,
    args: z.infer<typeof totalVaultReturnsActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const totalReturns = await sdk.getUserVaultTotalReturns({
        path: {
          vaultAddress: args.vaultAddress,
          network: args.network,
          userAddress: args.userAddress || wallet.getAddress(),
        },
      });
      return JSON.stringify(totalReturns);
    } catch (error) {
      return `Failed to fetch total vault returns: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * User events action
   *
   * @param wallet - The wallet provider instance for blockchain interactions
   * @param args - Input arguments: vaultAddress, network, userAddress
   * @returns A list of the users actions on a vault
   */
  @CreateAction({
    name: "user_events",
    description: `
      This action retrieves historical actions performed by a given user on a given vault.
      All asset/lp token amounts returned are in the smallest unit of the token.
    `,
    schema: userEventsActionSchema,
  })
  async userEvents(
    wallet: EvmWalletProvider,
    args: z.infer<typeof userEventsActionSchema>,
  ): Promise<string> {
    try {
      const sdk = getVaultsSdk(this.apiKey);
      const userEvents = await sdk.getUserVaultEvents({
        path: {
          vaultAddress: args.vaultAddress,
          network: args.network,
          userAddress: args.userAddress || wallet.getAddress(),
        },
      });
      return JSON.stringify({
        ...userEvents,
        data: userEvents.data.map(d => ({
          ...d,
          timestamp: new Date(d.timestamp * 1000).toISOString(),
        })),
      });
    } catch (error) {
      return `Failed to fetch user events: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily == "evm" &&
      (network.chainId ? SUPPORTED_CHAIN_IDS.includes(network.chainId) : false)
    );
  }
}

/**
 * Factory function to create a new VaultsfyiActionProvider instance.
 *
 * @param config - Configuration options for the provider
 * @returns A new VaultsfyiActionProvider instance
 */
export const vaultsfyiActionProvider = (config: VaultsfyiActionProviderConfig) =>
  new VaultsfyiActionProvider(config);
