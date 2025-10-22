import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  encodeFunctionData,
  parseEther,
  zeroAddress,
  Address,
  formatEther,
  maxUint160,
  Hex,
  zeroHash,
  parseUnits,
  encodeAbiParameters,
} from "viem";
import { base } from "viem/chains";
import {
  FlaunchSchema,
  BuyCoinWithETHInputSchema,
  BuyCoinWithCoinInputSchema,
  SellCoinSchema,
} from "./schemas";
import { generateTokenUri } from "./metadata_utils";
import { ethRequiredToFlaunch, getMemecoinAddressFromReceipt } from "./client_utils";
import {
  getAmountWithSlippage,
  memecoinToEthWithPermit2,
  getSwapAmountsFromReceipt,
  buyFlaunchCoin,
} from "./swap_utils";
import {
  FlaunchPositionManagerV1_1Address,
  FLETHHooksAddress,
  FLETHAddress,
  QuoterAddress,
  UniversalRouterAddress,
  QUOTER_ABI,
  UNIVERSAL_ROUTER_ABI,
  Permit2Address,
  PERMIT2_ABI,
  PERMIT_TYPES,
  ERC20_ABI,
  FlaunchZapAddress,
  FLAUNCH_ZAP_ABI,
  AddressFeeSplitManagerAddress,
  TOTAL_SUPPLY,
} from "./constants";
import { PermitSingle, SellSwapAmounts } from "./types";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * FlaunchActionProvider provides actions for flaunch operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 */
export class FlaunchActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the FlaunchActionProvider.
   *
   */
  constructor() {
    super("flaunch", []);
  }

  /**
   * Launches a new memecoin using the flaunch protocol.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by FlaunchSchema
   * @returns A promise that resolves to a string describing the transaction result
   */
  @CreateAction({
    name: "flaunch",
    description: `
This tool allows launching a new memecoin using the flaunch protocol.

It takes:
- name: The name of the token
- symbol: The symbol of the token
- image: Local image file path or URL to the token image
- description: Description of the token
- fairLaunchPercent: The percentage of tokens for fair launch (defaults to 60%)
- fairLaunchDuration: The duration of the fair launch in minutes (defaults to 30 minutes)
- initialMarketCapUSD: The initial market cap in USD (defaults to 10000 USD)
- preminePercent: The percentage of total supply to premine (defaults to 0%, max is equal to fairLaunchPercent)
- creatorFeeAllocationPercent: The percentage of fees allocated to creator and optional receivers (defaults to 80%)
- creatorSplitPercent: The percentage of fees allocated to the creator (defaults to 100%), remainder goes to fee split recipients
- splitReceivers: Array of fee split recipients with address and percentage (optional)
- websiteUrl: URL to the token website (optional)
- discordUrl: URL to the token Discord (optional)
- twitterUrl: URL to the token Twitter (optional)
- telegramUrl: URL to the token Telegram (optional)

Note:
- splitReceivers must add up to exactly 100% if provided.
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

      // Validate that premineAmount does not exceed fairLaunchPercent
      if (args.preminePercent > args.fairLaunchPercent) {
        throw new Error(
          `premineAmount (${args.preminePercent}%) cannot exceed fairLaunchPercent (${args.fairLaunchPercent}%)`,
        );
      }

      // Prepare launch parameters
      const initialMCapInUSDCWei = parseUnits(args.initialMarketCapUSD.toString(), 6);
      const initialPriceParams = encodeAbiParameters([{ type: "uint256" }], [initialMCapInUSDCWei]);

      const fairLaunchInBps = BigInt(args.fairLaunchPercent * 100);

      // Convert premine percentage to token amount and calculate ETH required
      const premineAmount = (TOTAL_SUPPLY * BigInt(Math.floor(args.preminePercent * 100))) / 10000n;
      const ethRequired =
        args.preminePercent > 0
          ? await ethRequiredToFlaunch(walletProvider, {
              premineAmount,
              initialPriceParams,
              slippagePercent: 5,
            })
          : 0n;

      // Check ETH balance
      if (ethRequired > 0n) {
        const ethBalance = await walletProvider.getBalance();
        if (ethBalance < ethRequired) {
          throw new Error(
            `Insufficient ETH balance. Required: ${formatEther(ethRequired)} ETH, Available: ${formatEther(ethBalance)} ETH`,
          );
        }
      }

      // Upload image & token uri to ipfs
      const tokenUri = await generateTokenUri(args.name, args.symbol, {
        metadata: {
          image: args.image,
          description: args.description,
          websiteUrl: args.websiteUrl,
          discordUrl: args.discordUrl,
          twitterUrl: args.twitterUrl,
          telegramUrl: args.telegramUrl,
        },
      });

      // Fee split configuration
      const creatorFeeAllocationInBps = args.creatorFeeAllocationPercent * 100;
      let creatorShare = 10000000n;
      let recipientShares: { recipient: Address; share: bigint }[] = [];
      if (args.creatorSplitPercent !== undefined && args.splitReceivers !== undefined) {
        const VALID_SHARE_TOTAL = 10000000n; // 5 decimals as BigInt, 100 * 10^5
        creatorShare = (BigInt(args.creatorSplitPercent) * VALID_SHARE_TOTAL) / 100n;

        recipientShares = args.splitReceivers.map(receiver => {
          return {
            recipient: receiver.address as Address,
            share: (BigInt(receiver.percent) * VALID_SHARE_TOTAL) / 100n,
          };
        });

        const totalRecipientShares = recipientShares.reduce((acc, curr) => acc + curr.share, 0n);
        const totalRecipientPercent = (totalRecipientShares * 100n) / VALID_SHARE_TOTAL;

        // Check that recipient shares add up to 100%
        if (totalRecipientPercent !== 100n) {
          throw new Error(
            `Recipient shares must add up to exactly 100%, but they add up to ${totalRecipientPercent}%`,
          );
        }

        const remainderShares = VALID_SHARE_TOTAL - totalRecipientShares;
        creatorShare += remainderShares;
      }

      const initializeData = encodeAbiParameters(
        [
          {
            type: "tuple",
            name: "params",
            components: [
              { type: "uint256", name: "creatorShare" },
              {
                type: "tuple[]",
                name: "recipientShares",
                components: [
                  { type: "address", name: "recipient" },
                  { type: "uint256", name: "share" },
                ],
              },
            ],
          },
        ],
        [
          {
            creatorShare,
            recipientShares,
          },
        ],
      );

      const flaunchParams = {
        name: args.name,
        symbol: args.symbol,
        tokenUri,
        initialTokenFairLaunch: (TOTAL_SUPPLY * fairLaunchInBps) / 10000n,
        fairLaunchDuration: BigInt(args.fairLaunchDuration * 60),
        premineAmount,
        creator: walletProvider.getAddress() as Address,
        creatorFeeAllocation: creatorFeeAllocationInBps,
        flaunchAt: 0n,
        initialPriceParams,
        feeCalculatorParams: "0x" as Hex,
      };

      const treasuryManagerParams = {
        manager: AddressFeeSplitManagerAddress[chainId],
        initializeData,
        depositData: "0x" as Hex,
      };

      const whitelistParams = {
        merkleRoot: zeroHash,
        merkleIPFSHash: "",
        maxTokens: 0n,
      };

      const airdropParams = {
        airdropIndex: 0n,
        airdropAmount: 0n,
        airdropEndTime: 0n,
        merkleRoot: zeroHash,
        merkleIPFSHash: "",
      };

      const data = encodeFunctionData({
        abi: FLAUNCH_ZAP_ABI,
        functionName: "flaunch",
        args: [flaunchParams, whitelistParams, airdropParams, treasuryManagerParams],
      });

      const hash = await walletProvider.sendTransaction({
        to: FlaunchZapAddress[chainId],
        data,
        value: ethRequired,
      });
      const receipt = await walletProvider.waitForTransactionReceipt(hash);

      const memecoinAddress = getMemecoinAddressFromReceipt(receipt, chainId);
      const chainSlug = Number(chainId) === base.id ? "base" : "base-sepolia";

      return `Flaunched\n ${JSON.stringify({
        coinSymbol: `$${args.symbol}`,
        coinName: args.name,
        coinAddress: memecoinAddress,
        flaunchCoinUrl: `https://flaunch.gg/${chainSlug}/coin/${memecoinAddress}`,
        transactionHash: hash,
        transactionUrl: `${NETWORK_ID_TO_VIEM_CHAIN[networkId].blockExplorers?.default.url}/tx/${hash}`,
      })}`;
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
    return buyFlaunchCoin(
      walletProvider,
      args.coinAddress,
      "EXACT_IN",
      { amountIn: args.amountIn },
      args.slippagePercent,
    );
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
    return buyFlaunchCoin(
      walletProvider,
      args.coinAddress,
      "EXACT_OUT",
      { amountOut: args.amountOut },
      args.slippagePercent,
    );
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

      const quoteResult = await walletProvider.getPublicClient().simulateContract({
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
                hooks: FlaunchPositionManagerV1_1Address[chainId],
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
 * @returns A new FlaunchActionProvider instance
 */
export const flaunchActionProvider = () => new FlaunchActionProvider();
