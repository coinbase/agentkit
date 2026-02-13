import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SUPPORTED_NETWORKS,
  PUMPCLAW_FACTORY_ABI,
  PUMPCLAW_SWAPROUTER_ABI,
  ERC20_ABI,
  getFactoryAddress,
  getSwapRouterAddress,
} from "./constants";
import { encodeFunctionData, formatUnits } from "viem";
import {
  PumpclawCreateTokenInput,
  PumpclawGetTokenInfoInput,
  PumpclawListTokensInput,
  PumpclawBuyTokenInput,
  PumpclawSellTokenInput,
  PumpclawSetImageUrlInput,
} from "./schemas";

/**
 * PumpclawActionProvider is an action provider for PumpClaw protocol interactions.
 *
 * PumpClaw is a free token launcher on Base using Uniswap V4. It allows anyone to
 * create tokens with 0 ETH cost, 80% creator fees, and LP locked forever.
 *
 * @see https://pumpclaw.com
 */
export class PumpclawActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the PumpclawActionProvider class.
   */
  constructor() {
    super("pumpclaw", []);
  }

  /**
   * Creates a new token via PumpClaw factory.
   *
   * @param walletProvider - The wallet provider to create the token from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token creation details.
   */
  @CreateAction({
    name: "create_token",
    description: `
This tool creates a new ERC20 token on Base via PumpClaw with Uniswap V4 liquidity.

Inputs:
- Token name and symbol
- Image URL for the token
- Total supply (default: 1B tokens)
- Initial FDV (default: 10 ETH)
- Creator address (optional, defaults to sender)

PumpClaw advantages:
- FREE deployment (0 ETH cost)
- 80% creator fees on all trades
- LP locked forever (cannot rug)
- Built on Uniswap V4 for deep liquidity

Important notes:
- Amounts are in wei (no decimal points)
- Default total supply: 1,000,000,000 tokens (1B)
- Default initial FDV: 10 ETH
- Only supported on Base mainnet`,
    schema: PumpclawCreateTokenInput,
  })
  async createToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawCreateTokenInput>,
  ): Promise<string> {
    try {
      const factoryAddress = getFactoryAddress(walletProvider.getNetwork().networkId!);
      const creator = args.creator || walletProvider.getAddress();

      const createData = encodeFunctionData({
        abi: PUMPCLAW_FACTORY_ABI,
        functionName: "createToken",
        args: [
          args.name,
          args.symbol,
          args.imageUrl,
          BigInt(args.totalSupply),
          BigInt(args.initialFdv),
          creator as `0x${string}`,
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: factoryAddress as `0x${string}`,
        data: createData,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully created PumpClaw token "${args.name}" (${args.symbol}).

Transaction hash: ${txHash}

Key features:
- FREE deployment (0 ETH)
- 80% creator fees
- LP locked forever
- Built on Uniswap V4

The token contract address can be found in the transaction logs (TokenCreated event).`;
    } catch (error) {
      return `Error creating PumpClaw token: ${error}`;
    }
  }

  /**
   * Gets detailed information about a PumpClaw token.
   *
   * @param walletProvider - The wallet provider to get token information from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token information.
   */
  @CreateAction({
    name: "get_token_info",
    description: `
This tool gets detailed information about a PumpClaw token on Base.

Inputs:
- Token contract address

Returns token details including name, symbol, image URL, total supply,
creator address, pool address, and creation timestamp.

Important notes:
- Only works with PumpClaw tokens
- Supported on Base mainnet only`,
    schema: PumpclawGetTokenInfoInput,
  })
  async getTokenInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawGetTokenInfoInput>,
  ): Promise<string> {
    try {
      const factoryAddress = getFactoryAddress(walletProvider.getNetwork().networkId!);

      const tokenInfo = (await walletProvider.readContract({
        address: factoryAddress as `0x${string}`,
        abi: PUMPCLAW_FACTORY_ABI,
        functionName: "getTokenInfo",
        args: [args.tokenAddress as `0x${string}`],
      })) as [string, string, string, bigint, string, string, bigint];

      if (tokenInfo[6] === 0n) {
        return `Error: ${args.tokenAddress} is not a valid PumpClaw token (not found in registry).`;
      }

      const [name, symbol, imageUrl, totalSupply, creator, pool, createdAt] = tokenInfo;

      // Get decimals
      const decimals = (await walletProvider.readContract({
        address: args.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      })) as number;

      const formattedSupply = formatUnits(totalSupply, decimals);

      return `Token Information for ${args.tokenAddress}:

Name: ${name}
Symbol: ${symbol}
Image URL: ${imageUrl}
Total Supply: ${formattedSupply} ${symbol}
Creator: ${creator}
Pool Address: ${pool}
Created: ${new Date(Number(createdAt) * 1000).toISOString()}

PumpClaw features:
- FREE deployment (0 ETH)
- 80% creator fees
- LP locked forever`;
    } catch (error) {
      return `Error getting token information: ${error}`;
    }
  }

  /**
   * Lists all tokens created on PumpClaw.
   *
   * @param walletProvider - The wallet provider to list tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the list of tokens.
   */
  @CreateAction({
    name: "list_tokens",
    description: `
This tool lists all tokens created on PumpClaw.

Inputs:
- Offset: starting index (default: 0)
- Limit: number of tokens to return (default: 10, max: 100)

Returns a list of token contract addresses.

Important notes:
- Tokens are returned in creation order (oldest first)
- Use offset for pagination
- Supported on Base mainnet only`,
    schema: PumpclawListTokensInput,
  })
  async listTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawListTokensInput>,
  ): Promise<string> {
    try {
      const factoryAddress = getFactoryAddress(walletProvider.getNetwork().networkId!);

      const tokenCount = (await walletProvider.readContract({
        address: factoryAddress as `0x${string}`,
        abi: PUMPCLAW_FACTORY_ABI,
        functionName: "getTokenCount",
        args: [],
      })) as bigint;

      if (tokenCount === 0n) {
        return "No PumpClaw tokens have been created yet.";
      }

      const tokens = (await walletProvider.readContract({
        address: factoryAddress as `0x${string}`,
        abi: PUMPCLAW_FACTORY_ABI,
        functionName: "getTokens",
        args: [BigInt(args.offset), BigInt(args.limit)],
      })) as string[];

      if (tokens.length === 0) {
        return `No tokens found at offset ${args.offset}. Total token count: ${tokenCount.toString()}`;
      }

      let result = `PumpClaw Tokens (showing ${tokens.length} of ${tokenCount.toString()} total):\n\n`;

      for (let i = 0; i < tokens.length; i++) {
        result += `${args.offset + i + 1}. ${tokens[i]}\n`;
      }

      return result;
    } catch (error) {
      return `Error listing tokens: ${error}`;
    }
  }

  /**
   * Buys PumpClaw tokens with ETH via SwapRouter.
   *
   * @param walletProvider - The wallet provider to buy tokens with.
   * @param args - The input arguments for the action.
   * @returns A message containing the purchase details.
   */
  @CreateAction({
    name: "buy_token",
    description: `
This tool buys PumpClaw tokens with ETH via SwapRouter on Base.
Do not use this tool for buying other types of tokens.

Inputs:
- Token contract address
- Amount of ETH to spend (in wei)
- Minimum tokens to receive (in wei, for slippage protection)

Important notes:
- Amounts are in wei (no decimal points). 1 ETH = 10^18 wei.
- The minTokensOut protects against slippage — the transaction reverts if received amount is less.
- 80% of fees go to the token creator
- Only supported on Base mainnet`,
    schema: PumpclawBuyTokenInput,
  })
  async buyToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawBuyTokenInput>,
  ): Promise<string> {
    try {
      const swapRouterAddress = getSwapRouterAddress(
        walletProvider.getNetwork().networkId!,
      );

      const buyData = encodeFunctionData({
        abi: PUMPCLAW_SWAPROUTER_ABI,
        functionName: "buyTokens",
        args: [args.tokenAddress as `0x${string}`, BigInt(args.minTokensOut)],
      });

      const txHash = await walletProvider.sendTransaction({
        to: swapRouterAddress as `0x${string}`,
        data: buyData,
        value: BigInt(args.ethAmount),
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully bought PumpClaw tokens. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error buying PumpClaw tokens: ${error}`;
    }
  }

  /**
   * Sells PumpClaw tokens for ETH via SwapRouter.
   *
   * @param walletProvider - The wallet provider to sell tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the sale details.
   */
  @CreateAction({
    name: "sell_token",
    description: `
This tool sells PumpClaw tokens for ETH via SwapRouter on Base.
Do not use this tool for selling other types of tokens.

Inputs:
- Token contract address
- Amount of tokens to sell (in wei)
- Minimum ETH to receive (in wei, for slippage protection)

Important notes:
- Amounts are in wei (no decimal points). 1 token = 10^decimals wei.
- The minEthOut protects against slippage — the transaction reverts if received amount is less.
- Token approval for the SwapRouter is handled automatically.
- 80% of fees go to the token creator
- Only supported on Base mainnet`,
    schema: PumpclawSellTokenInput,
  })
  async sellToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawSellTokenInput>,
  ): Promise<string> {
    try {
      const swapRouterAddress = getSwapRouterAddress(
        walletProvider.getNetwork().networkId!,
      );

      // Check balance
      const balance = (await walletProvider.readContract({
        address: args.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletProvider.getAddress() as `0x${string}`],
      })) as bigint;

      if (balance < BigInt(args.tokensIn)) {
        return `Error: Insufficient balance. You have ${balance.toString()} wei but are trying to sell ${args.tokensIn} wei.`;
      }

      // Check and handle token approval
      const allowance = (await walletProvider.readContract({
        address: args.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [
          walletProvider.getAddress() as `0x${string}`,
          swapRouterAddress as `0x${string}`,
        ],
      })) as bigint;

      if (allowance < BigInt(args.tokensIn)) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [swapRouterAddress as `0x${string}`, BigInt(args.tokensIn)],
        });

        const approveTxHash = await walletProvider.sendTransaction({
          to: args.tokenAddress as `0x${string}`,
          data: approveData,
        });

        await walletProvider.waitForTransactionReceipt(approveTxHash);
      }

      const sellData = encodeFunctionData({
        abi: PUMPCLAW_SWAPROUTER_ABI,
        functionName: "sellTokens",
        args: [
          args.tokenAddress as `0x${string}`,
          BigInt(args.tokensIn),
          BigInt(args.minEthOut),
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: swapRouterAddress as `0x${string}`,
        data: sellData,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully sold PumpClaw tokens. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error selling PumpClaw tokens: ${error}`;
    }
  }

  /**
   * Updates the image URL of a PumpClaw token (creator only).
   *
   * @param walletProvider - The wallet provider to update the token from.
   * @param args - The input arguments for the action.
   * @returns A message containing the update details.
   */
  @CreateAction({
    name: "set_image_url",
    description: `
This tool updates the image URL of a PumpClaw token on Base.

Inputs:
- Token contract address
- New image URL

Important notes:
- Only the token creator can update the image URL
- The transaction will revert if called by a non-creator
- Only supported on Base mainnet`,
    schema: PumpclawSetImageUrlInput,
  })
  async setImageUrl(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PumpclawSetImageUrlInput>,
  ): Promise<string> {
    try {
      const factoryAddress = getFactoryAddress(walletProvider.getNetwork().networkId!);

      const setImageData = encodeFunctionData({
        abi: PUMPCLAW_FACTORY_ABI,
        functionName: "setImageUrl",
        args: [args.tokenAddress as `0x${string}`, args.imageUrl],
      });

      const txHash = await walletProvider.sendTransaction({
        to: factoryAddress as `0x${string}`,
        data: setImageData,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully updated image URL for token ${args.tokenAddress}. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error updating image URL: ${error}. Note: Only the token creator can update the image URL.`;
    }
  }

  /**
   * Checks if the PumpClaw action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is supported, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const pumpclawActionProvider = () => new PumpclawActionProvider();
