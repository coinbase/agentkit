/**
 * Flaunch Action Provider
 *
 * This file contains the implementation of the FlaunchActionProvider,
 * which provides actions for flaunch operations.
 *
 * @module flaunch
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  encodeFunctionData,
  decodeEventLog,
  parseEther,
  createPublicClient,
  http,
  zeroAddress,
  Address,
  formatEther,
  maxUint160,
  Hex,
} from "viem";
import { base } from "viem/chains";
import {
  FlaunchSchema,
  BuyCoinWithETHInputSchema,
  BuyCoinWithCoinInputSchema,
  SellCoinSchema,
} from "./schemas";
import {
  ethToMemecoin,
  generateTokenUri,
  getAmountWithSlippage,
  getSwapAmountsFromReceipt,
  memecoinToEthWithPermit2,
} from "./utils";
import {
  FastFlaunchZapAddress,
  FlaunchPositionManagerAddress,
  FLETHHooksAddress,
  FLETHAddress,
  QuoterAddress,
  UniversalRouterAddress,
  FAST_FLAUNCH_ZAP_ABI,
  POSITION_MANAGER_ABI,
  QUOTER_ABI,
  UNIVERSAL_ROUTER_ABI,
  Permit2Address,
  PERMIT2_ABI,
  PERMIT_TYPES,
  ERC20_ABI,
} from "./constants";
import { BuySwapAmounts, PermitSingle, SellSwapAmounts } from "./types";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * Configuration options for the FarcasterActionProvider.
 */
export interface FlaunchActionProviderConfig {
  /**
   * Pinata JWT.
   */
  pinataJwt?: string;
}

/**
 * FlaunchActionProvider provides actions for flaunch operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class FlaunchActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly pinataJwt: string;

  /**
   * Constructor for the FlaunchActionProvider.
   *
   * @param config - The configuration options for the FlaunchActionProvider.
   */
  constructor(config: FlaunchActionProviderConfig = {}) {
    super("flaunch", []);

    const pinataJwt = config.pinataJwt || process.env.PINATA_JWT;

    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not configured.");
    }

    this.pinataJwt = pinataJwt;
  }

  /**
   * Example action implementation.
   * Replace or modify this with your actual action.
   *
   * @description
   * This is a template action that demonstrates the basic structure.
   * Replace it with your actual implementation.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by FlaunchSchema
   * @returns A promise that resolves to a string describing the action result
   */
  @CreateAction({
    name: "flaunch",
    description: `
This tool allows launching a new memecoin using the flaunch protocol.

It takes:
- name: The name of the token
- symbol: The symbol of the token
- imageUrl: URL to the token image
- description: Description of the token

- websiteUrl: (optional) URL to the token website
- discordUrl: (optional) URL to the token Discord
- twitterUrl: (optional) URL to the token Twitter
- telegramUrl: (optional) URL to the token Telegram

Note:
- If the optional fields are not provided, don't include them in the call.
    `,
    schema: FlaunchSchema,
  })
  async flaunch(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof FlaunchSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const networkId = network.networkId;
      const chainId = network.chainId;

      if (!chainId || !networkId) {
        throw new Error("Chain ID is not set.");
      }

      // upload image & token uri to ipfs
      const tokenUri = await generateTokenUri(args.name, {
        pinataConfig: { jwt: this.pinataJwt },
        metadata: {
          imageUrl: args.imageUrl,
          description: args.description,
          websiteUrl: args.websiteUrl,
          discordUrl: args.discordUrl,
          twitterUrl: args.twitterUrl,
          telegramUrl: args.telegramUrl,
        },
      });

      const data = encodeFunctionData({
        abi: FAST_FLAUNCH_ZAP_ABI,
        functionName: "flaunch",
        args: [
          {
            name: args.name,
            symbol: args.symbol,
            tokenUri,
            creator: walletProvider.getAddress(),
          },
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: FastFlaunchZapAddress[chainId],
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      const filteredPoolCreatedEvent = receipt.logs
        .map(log => {
          try {
            if (
              log.address.toLowerCase() !== FlaunchPositionManagerAddress[chainId].toLowerCase()
            ) {
              return null;
            }

            const event = decodeEventLog({
              abi: POSITION_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
            });
            return event.eventName === "PoolCreated" ? event.args : null;
          } catch {
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null)[0];

      const memecoinAddress = filteredPoolCreatedEvent._memecoin;
      const chainSlug = Number(chainId) === base.id ? "base" : "base-sepolia";

      return `Flaunched $${args.symbol} (${args.name}) with transaction hash: [${hash}](${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash})\n
      View your $${args.symbol} on Flaunch: [${memecoinAddress}](https://flaunch.gg/${chainSlug}/coin/${memecoinAddress})`;
    } catch (error) {
      return `Error launching coin: ${error}`;
    }
  }

  /**
   * Buys a flaunch coin using ETH input.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by BuyCoinSchema
   * @returns A promise that resolves to a string describing the transaction result
   */
  @CreateAction({
    name: "buyCoinWithETHInput",
    description: `
This tool allows buying a flaunch coin using ETH, when the user has specified the ETH amount to spend.

It takes:
- coinAddress: The address of the flaunch coin to buy
- amountIn: The quantity of ETH to spend on the flaunch coin, in whole units
  Examples:
  - 0.001 ETH
  - 0.01 ETH
  - 1 ETH
- slippagePercent: (optional) The slippage percentage. Default to 5%
    `,
    schema: BuyCoinWithETHInputSchema,
  })
  async buyCoinWithETHInput(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuyCoinWithETHInputSchema>,
  ): Promise<string> {
    let amountIn: bigint | undefined;
    let amountOutMin: bigint | undefined;
    const swapType = "EXACT_IN";

    const network = walletProvider.getNetwork();
    const chainId = network.chainId;
    const networkId = network.networkId;

    if (!chainId || !networkId) {
      throw new Error("Chain ID is not set.");
    }

    try {
      const viemPublicClient = createPublicClient({
        chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
        transport: http(),
      });

      amountIn = parseEther(args.amountIn);

      const quoteResult = await viemPublicClient.simulateContract({
        address: QuoterAddress[chainId],
        abi: QUOTER_ABI,
        functionName: "quoteExactInput",
        args: [
          {
            exactAmount: amountIn,
            exactCurrency: zeroAddress, // ETH
            path: [
              {
                fee: 0,
                tickSpacing: 60,
                hookData: "0x",
                hooks: FLETHHooksAddress[chainId],
                intermediateCurrency: FLETHAddress[chainId],
              },
              {
                fee: 0,
                tickSpacing: 60,
                hooks: FlaunchPositionManagerAddress[chainId],
                hookData: "0x",
                intermediateCurrency: args.coinAddress,
              },
            ],
          },
        ],
      });
      amountOutMin = getAmountWithSlippage(
        quoteResult.result[0], // amountOut
        (args.slippagePercent / 100).toFixed(18).toString(),
        swapType,
      );

      const { commands, inputs } = ethToMemecoin({
        sender: walletProvider.getAddress() as Address,
        memecoin: args.coinAddress as Address,
        chainId: Number(chainId),
        referrer: zeroAddress,
        swapType: swapType!,
        amountIn: amountIn,
        amountOutMin: amountOutMin,
      });

      const data = encodeFunctionData({
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [commands, inputs],
      });

      const hash = await walletProvider.sendTransaction({
        to: UniversalRouterAddress[chainId],
        data,
        value: amountIn,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      const swapAmounts = getSwapAmountsFromReceipt({
        receipt,
        coinAddress: args.coinAddress as Address,
        chainId: Number(chainId),
      }) as BuySwapAmounts;

      const coinSymbol = await walletProvider.readContract({
        address: args.coinAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      });

      return `Bought ${formatEther(swapAmounts.coinsBought)} $${coinSymbol} for ${formatEther(swapAmounts.ethSold)} ETH\n
        Tx hash: [${hash}](${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash})`;
    } catch (error) {
      return `Error buying coin: ${error}`;
    }
  }

  /**
   * Buys a flaunch coin using Coin input.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by BuyCoinSchema
   * @returns A promise that resolves to a string describing the transaction result
   */
  @CreateAction({
    name: "buyCoinWithCoinInput",
    description: `
This tool allows buying a flaunch coin using ETH, when the user has specified the Coin amount to buy.

It takes:
- coinAddress: The address of the flaunch coin to buy
- amountOut: The quantity of the flaunch coin to buy, in whole units
  Examples:
  - 1000 coins
  - 1_000_000 coins
- slippagePercent: (optional) The slippage percentage. Default to 5%
    `,
    schema: BuyCoinWithCoinInputSchema,
  })
  async buyCoinWithCoinInput(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuyCoinWithCoinInputSchema>,
  ): Promise<string> {
    let amountIn: bigint | undefined;
    let amountOutMin: bigint | undefined;
    let amountOut: bigint | undefined;
    let amountInMax: bigint | undefined;
    const swapType = "EXACT_OUT";

    const network = walletProvider.getNetwork();
    const chainId = network.chainId;
    const networkId = network.networkId;

    if (!chainId || !networkId) {
      throw new Error("Chain ID is not set.");
    }

    try {
      const viemPublicClient = createPublicClient({
        chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
        transport: http(),
      });

      amountOut = parseEther(args.amountOut);

      const quoteResult = await viemPublicClient.simulateContract({
        address: QuoterAddress[chainId],
        abi: QUOTER_ABI,
        functionName: "quoteExactOutput",
        args: [
          {
            path: [
              {
                intermediateCurrency: zeroAddress,
                fee: 0,
                tickSpacing: 60,
                hookData: "0x",
                hooks: FLETHHooksAddress[chainId],
              },
              {
                intermediateCurrency: FLETHAddress[chainId],
                fee: 0,
                tickSpacing: 60,
                hooks: FlaunchPositionManagerAddress[chainId],
                hookData: "0x",
              },
            ],
            exactCurrency: args.coinAddress as Address,
            exactAmount: amountOut,
          },
        ],
      });
      amountInMax = getAmountWithSlippage(
        quoteResult.result[0], // amountIn
        (args.slippagePercent / 100).toFixed(18).toString(),
        swapType,
      );

      const { commands, inputs } = ethToMemecoin({
        sender: walletProvider.getAddress() as Address,
        memecoin: args.coinAddress as Address,
        chainId: Number(chainId),
        referrer: zeroAddress,
        swapType: swapType!,
        amountIn: amountIn,
        amountOutMin: amountOutMin,
        amountOut: amountOut,
        amountInMax: amountInMax,
      });

      const data = encodeFunctionData({
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [commands, inputs],
      });

      const hash = await walletProvider.sendTransaction({
        to: UniversalRouterAddress[chainId],
        data,
        value: amountInMax,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      const swapAmounts = getSwapAmountsFromReceipt({
        receipt,
        coinAddress: args.coinAddress as Address,
        chainId: Number(chainId),
      }) as BuySwapAmounts;

      const coinSymbol = await walletProvider.readContract({
        address: args.coinAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      });

      return `Bought ${formatEther(swapAmounts.coinsBought)} $${coinSymbol} for ${formatEther(swapAmounts.ethSold)} ETH\n
        Tx hash: [${hash}](${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash})`;
    } catch (error) {
      return `Error buying coin: ${error}`;
    }
  }

  /**
   * Sells a flaunch coin into ETH.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by SellCoinSchema
   * @returns A promise that resolves to a string describing the transaction result
   */
  @CreateAction({
    name: "sellCoin",
    description: `
This tool allows selling a flaunch coin into ETH, when the user has specified the Coin amount to sell.

It takes:
- coinAddress: The address of the flaunch coin to sell
- amountIn: The quantity of the flaunch coin to sell, in whole units
  Examples:
  - 1000 coins
  - 1_000_000 coins
- slippagePercent: (optional) The slippage percentage. Default to 5%
    `,
    schema: SellCoinSchema,
  })
  async sellCoin(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SellCoinSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const chainId = network.chainId;
    const networkId = network.networkId;

    if (!chainId || !networkId) {
      throw new Error("Chain ID is not set.");
    }

    try {
      const amountIn = parseEther(args.amountIn);

      // fetch permit2 allowance
      const [allowance, nonce] = await walletProvider.readContract({
        address: Permit2Address[chainId],
        abi: PERMIT2_ABI,
        functionName: "allowance",
        args: [
          walletProvider.getAddress() as Address,
          args.coinAddress as Address,
          UniversalRouterAddress[chainId],
        ],
      });

      let signature: Hex | undefined;
      let permitSingle: PermitSingle | undefined;

      // approve
      if (allowance < amountIn) {
        // 10 years in seconds
        const defaultDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10);

        const domain = {
          name: "Permit2",
          chainId: Number(chainId),
          verifyingContract: Permit2Address[chainId],
        };

        const message = {
          details: {
            token: args.coinAddress as Address,
            amount: maxUint160,
            expiration: Number(defaultDeadline),
            nonce,
          },
          spender: UniversalRouterAddress[chainId],
          sigDeadline: defaultDeadline,
        } as PermitSingle;

        const typedData = {
          primaryType: "PermitSingle",
          domain,
          types: PERMIT_TYPES,
          message,
        } as const;

        signature = await walletProvider.signTypedData(typedData);
        permitSingle = message;
      }

      const viemPublicClient = createPublicClient({
        chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
        transport: http(),
      });

      const quoteResult = await viemPublicClient.simulateContract({
        address: QuoterAddress[chainId],
        abi: QUOTER_ABI,
        functionName: "quoteExactInput",
        args: [
          {
            exactAmount: amountIn,
            exactCurrency: args.coinAddress as Address,
            path: [
              {
                fee: 0,
                tickSpacing: 60,
                hooks: FlaunchPositionManagerAddress[chainId],
                hookData: "0x",
                intermediateCurrency: FLETHAddress[chainId],
              },
              {
                fee: 0,
                tickSpacing: 60,
                hookData: "0x",
                hooks: FLETHHooksAddress[chainId],
                intermediateCurrency: zeroAddress,
              },
            ],
          },
        ],
      });
      const ethOutMin = getAmountWithSlippage(
        quoteResult.result[0], // amountOut
        (args.slippagePercent / 100).toFixed(18).toString(),
        "EXACT_IN",
      );

      const { commands, inputs } = memecoinToEthWithPermit2({
        chainId: Number(chainId),
        memecoin: args.coinAddress as Address,
        amountIn,
        ethOutMin,
        permitSingle,
        signature,
        referrer: zeroAddress,
      });

      const data = encodeFunctionData({
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [commands, inputs],
      });

      const hash = await walletProvider.sendTransaction({
        to: UniversalRouterAddress[chainId],
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      const swapAmounts = getSwapAmountsFromReceipt({
        receipt,
        coinAddress: args.coinAddress as Address,
        chainId: Number(chainId),
      }) as SellSwapAmounts;

      const coinSymbol = await walletProvider.readContract({
        address: args.coinAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      });

      return `Sold ${formatEther(swapAmounts.coinsSold)} $${coinSymbol} for ${formatEther(swapAmounts.ethBought)} ETH\n
        Tx hash: [${hash}](${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash})`;
    } catch (error) {
      return `Error selling coin: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // all protocol networks
    return network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
  }
}

/**
 * Factory function to create a new FlaunchActionProvider instance.
 *
 * @param config - Configuration options for the FlaunchActionProvider
 * @returns A new FlaunchActionProvider instance
 */
export const flaunchActionProvider = (config?: FlaunchActionProviderConfig) =>
  new FlaunchActionProvider(config);
