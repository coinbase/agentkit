import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SUPPORTED_NETWORKS,
  WOW_ABI,
  WOW_FACTORY_ABI,
  GENERIC_TOKEN_METADATA_URI,
  getFactoryAddress,
} from "./constants";
import { getBuyQuote, getSellQuote } from "./utils";
import { getHasGraduated } from "./uniswap/utils";
import { encodeFunctionData } from "viem";
import { WowBuyTokenInput, WowCreateTokenInput, WowSellTokenInput } from "./schemas";

/**
 * WowActionProvider is an action provider for Wow protocol interactions.
 */
export class WowActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the WowActionProvider class.
   */
  constructor() {
    super("wow", []);
  }

  /**
   * Buys a Zora Wow ERC20 memecoin with ETH.
   *
   * @param walletProvider - The wallet to create the token from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token purchase details.
   */
  @CreateAction({
    name: "buy_token",
    description: `
This tool can only be used to buy a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) with ETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Address to receive the tokens  
- Amount of ETH to spend (in wei)

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action. 
- 1 wei = 0.000000000000000001 ETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')`,
    schema: WowBuyTokenInput,
  })
  async buyToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WowBuyTokenInput>,
  ): Promise<string> {
    try {
      const tokenQuote = await getBuyQuote(
        walletProvider,
        args.contractAddress,
        args.amountEthInWei,
      );

      // Multiply by 99/100 and floor to get 99% of quote as minimum
      const minTokens = BigInt(Math.floor(Number(tokenQuote) * 99)) / BigInt(100);

      const hasGraduated = await getHasGraduated(walletProvider, args.contractAddress);

      const data = encodeFunctionData({
        abi: WOW_ABI,
        functionName: "buy",
        args: [
          walletProvider.getAddress(),
          walletProvider.getAddress(),
          "0x0000000000000000000000000000000000000000",
          "",
          hasGraduated ? 1n : 0n,
          minTokens,
          0n,
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: args.contractAddress as `0x${string}`,
        data,
        value: BigInt(args.amountEthInWei),
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Purchased WoW ERC20 memecoin with transaction hash: ${txHash}`;
    } catch (error) {
      return `Error buying Zora Wow ERC20 memecoin: ${error}`;
    }
  }

  /**
   * Creates a Zora Wow ERC20 memecoin.
   *
   * @param wallet - The wallet to create the token from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token creation details.
   */
  @CreateAction({
    name: "create_token",
    description: `
This tool can only be used to create a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) using the WoW factory.
Do not use this tool for any other purpose, or for creating other types of tokens.

Inputs:
- Token name (e.g. WowCoin)
- Token symbol (e.g. WOW) 
- Token URI (optional) - Contains metadata about the token

Important notes:
- Uses a bonding curve - no upfront liquidity needed
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')`,
    schema: WowCreateTokenInput,
  })
  async createToken(
    wallet: EvmWalletProvider,
    args: z.infer<typeof WowCreateTokenInput>,
  ): Promise<string> {
    const factoryAddress = getFactoryAddress(wallet.getNetwork().networkId!);

    try {
      const data = encodeFunctionData({
        abi: WOW_FACTORY_ABI,
        functionName: "deploy",
        args: [
          wallet.getAddress(),
          "0x0000000000000000000000000000000000000000",
          args.tokenUri || GENERIC_TOKEN_METADATA_URI,
          args.name,
          args.symbol,
        ],
      });

      const txHash = await wallet.sendTransaction({
        to: factoryAddress as `0x${string}`,
        data,
      });

      await wallet.waitForTransactionReceipt(txHash);

      return `Created WoW ERC20 memecoin ${args.name} with symbol ${
        args.symbol
      } on network ${wallet.getNetwork().networkId}.\nTransaction hash: ${txHash}`;
    } catch (error) {
      return `Error creating Zora Wow ERC20 memecoin: ${error}`;
    }
  }

  /**
   * Sells WOW tokens for ETH.
   *
   * @param walletProvider - The wallet to sell the tokens from.
   * @param args - The input arguments for the action.
   * @returns A message confirming the sale with the transaction hash.
   */
  @CreateAction({
    name: "sell_token",
    description: `
This tool can only be used to sell a Zora Wow ERC20 memecoin (also can be referred to as a bonding curve token) for ETH.
Do not use this tool for any other purpose, or trading other assets.

Inputs:
- WOW token contract address
- Amount of tokens to sell (in wei)

Important notes:
- The amount is a string and cannot have any decimal points, since the unit of measurement is wei.
- Make sure to use the exact amount provided, and if there's any doubt, check by getting more information before continuing with the action. 
- 1 wei = 0.000000000000000001 ETH
- Minimum purchase amount is 100000000000000 wei (0.0000001 ETH)
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')`,
    schema: WowSellTokenInput,
  })
  async sellToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WowSellTokenInput>,
  ): Promise<string> {
    try {
      const ethQuote = await getSellQuote(
        walletProvider,
        args.contractAddress,
        args.amountTokensInWei,
      );
      const hasGraduated = await getHasGraduated(walletProvider, args.contractAddress);

      // Multiply by 98/100 and floor to get 98% of quote as minimum
      const minEth = BigInt(Math.floor(Number(ethQuote) * 98)) / BigInt(100);

      const data = encodeFunctionData({
        abi: WOW_ABI,
        functionName: "sell",
        args: [
          BigInt(args.amountTokensInWei),
          walletProvider.getAddress(),
          "0x0000000000000000000000000000000000000000",
          "",
          hasGraduated ? 1n : 0n,
          minEth,
          0n,
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: args.contractAddress as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Sold WoW ERC20 memecoin with transaction hash: ${txHash}`;
    } catch (error) {
      return `Error selling Zora Wow ERC20 memecoin: ${error}`;
    }
  }

  /**
   * Checks if the Wow action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Wow action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const wowActionProvider = () => new WowActionProvider();
