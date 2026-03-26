import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SUPPORTED_NETWORKS,
  MCV2_BOND_ABI,
  ERC20_ABI,
  getBondAddress,
} from "./constants";
import {
  getTokenBond,
  getTokenInfo,
  getBuyQuote,
  getSellQuote,
  getUsdRate,
  needsApproval,
} from "./utils";
import { encodeFunctionData, formatUnits } from "viem";
import {
  MintclubGetTokenInfoInput,
  MintclubGetTokenPriceInput,
  MintclubBuyTokenInput,
  MintclubSellTokenInput,
  MintclubCreateTokenInput,
} from "./schemas";

/**
 * MintclubActionProvider is an action provider for Mint Club V2 protocol interactions.
 *
 * Mint Club V2 is a permissionless bonding curve protocol on Base. Tokens are created
 * with programmable price curves backed by reserve assets. The protocol handles minting,
 * burning, and price discovery through smart contracts.
 *
 * @see https://mint.club
 * @see https://docs.mint.club
 */
export class MintclubActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the MintclubActionProvider class.
   */
  constructor() {
    super("mintclub", []);
  }

  /**
   * Gets detailed information about a Mint Club token including bonding curve details.
   *
   * @param walletProvider - The wallet provider to get token information from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token information.
   */
  @CreateAction({
    name: "get_token_info",
    description: `
This tool gets detailed information about a Mint Club V2 bonding curve token on Base.

Inputs:
- Token contract address

Returns token details (symbol, decimals, supply) and bonding curve details
(creator, reserve token, reserve balance, royalties).

Important notes:
- Only works with Mint Club V2 tokens that have bonding curves
- Supported on Base mainnet only`,
    schema: MintclubGetTokenInfoInput,
  })
  async getTokenInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintclubGetTokenInfoInput>,
  ): Promise<string> {
    try {
      const [tokenInfo, bondInfo] = await Promise.all([
        getTokenInfo(walletProvider, args.tokenAddress),
        getTokenBond(walletProvider, args.tokenAddress),
      ]);

      if (!tokenInfo) {
        return `Error: Could not fetch token information for ${args.tokenAddress}. Verify this is a valid ERC20 token address.`;
      }

      if (!bondInfo) {
        return `Error: ${args.tokenAddress} is not a Mint Club V2 token (no bonding curve found).`;
      }

      const reserveTokenInfo = await getTokenInfo(walletProvider, bondInfo.reserveToken);
      const reserveSymbol = reserveTokenInfo?.symbol || "Unknown";
      const reserveDecimals = reserveTokenInfo?.decimals || 18;
      const formattedReserveBalance = formatUnits(
        BigInt(bondInfo.reserveBalance),
        reserveDecimals,
      );

      return `Token Information for ${args.tokenAddress}:

Token: ${tokenInfo.symbol}
Decimals: ${tokenInfo.decimals}
Total Supply: ${tokenInfo.formattedSupply}
Creator: ${bondInfo.creator}
Reserve Token: ${reserveSymbol} (${bondInfo.reserveToken})
Reserve Balance: ${formattedReserveBalance} ${reserveSymbol}
Mint Royalty: ${(bondInfo.mintRoyalty / 100).toFixed(2)}%
Burn Royalty: ${(bondInfo.burnRoyalty / 100).toFixed(2)}%
Created: ${new Date(bondInfo.createdAt * 1000).toISOString()}`;
    } catch (error) {
      return `Error getting token information: ${error}`;
    }
  }

  /**
   * Gets the current price of a Mint Club token.
   *
   * @param walletProvider - The wallet provider to get price information from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token price information.
   */
  @CreateAction({
    name: "get_token_price",
    description: `
This tool gets the current price of a Mint Club V2 token on Base.

Inputs:
- Token contract address
- Amount of tokens to price (in whole units, e.g., "1" or "100")

Returns the cost in reserve tokens (including royalty) and USD estimate.

Important notes:
- Price depends on the bonding curve position — larger amounts have higher price impact
- Includes royalty fees in the total cost
- Supported on Base mainnet only`,
    schema: MintclubGetTokenPriceInput,
  })
  async getTokenPrice(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintclubGetTokenPriceInput>,
  ): Promise<string> {
    try {
      const [tokenInfo, bondInfo] = await Promise.all([
        getTokenInfo(walletProvider, args.tokenAddress),
        getTokenBond(walletProvider, args.tokenAddress),
      ]);

      if (!tokenInfo || !bondInfo) {
        return `Error: ${args.tokenAddress} is not a valid Mint Club V2 token.`;
      }

      const tokensInWei = BigInt(
        Math.floor(Number(args.amount) * 10 ** tokenInfo.decimals),
      ).toString();

      const buyQuote = await getBuyQuote(walletProvider, args.tokenAddress, tokensInWei);
      if (!buyQuote) {
        return `Error: Could not get price quote. The bonding curve may have insufficient remaining supply.`;
      }

      const reserveTokenInfo = await getTokenInfo(walletProvider, bondInfo.reserveToken);
      const reserveSymbol = reserveTokenInfo?.symbol || "Unknown";
      const reserveDecimals = reserveTokenInfo?.decimals || 18;

      const reserveCost = formatUnits(BigInt(buyQuote.reserveAmount), reserveDecimals);
      const royalty = formatUnits(BigInt(buyQuote.royalty), reserveDecimals);
      const totalCost = formatUnits(
        BigInt(buyQuote.reserveAmount) + BigInt(buyQuote.royalty),
        reserveDecimals,
      );

      // Get USD rate for the reserve token
      const usdRate = await getUsdRate(walletProvider, bondInfo.reserveToken);

      let result = `Price for ${args.amount} ${tokenInfo.symbol}:

Reserve Cost: ${reserveCost} ${reserveSymbol}
Royalty: ${royalty} ${reserveSymbol}
Total: ${totalCost} ${reserveSymbol}`;

      if (usdRate !== null && usdRate > 0) {
        const totalReserve =
          Number(buyQuote.reserveAmount) + Number(buyQuote.royalty);
        const usdValue = (totalReserve / 10 ** reserveDecimals) * usdRate;
        result += `\nUSD Value: ~$${usdValue.toFixed(2)}`;
      }

      return result;
    } catch (error) {
      return `Error getting token price: ${error}`;
    }
  }

  /**
   * Buys Mint Club tokens via the bonding curve.
   *
   * @param walletProvider - The wallet provider to buy tokens with.
   * @param args - The input arguments for the action.
   * @returns A message containing the purchase details.
   */
  @CreateAction({
    name: "buy_token",
    description: `
This tool buys (mints) Mint Club V2 tokens via the bonding curve on Base.
Do not use this tool for buying other types of tokens.

Inputs:
- Token contract address
- Amount of tokens to mint (in wei, e.g., "1000000000000000000" for 1 token with 18 decimals)
- Maximum reserve to spend (in wei, for slippage protection)

Important notes:
- Amounts are in wei (no decimal points). 1 token = 10^decimals wei.
- The max reserve amount protects against slippage — the transaction reverts if the cost exceeds this.
- If the reserve token is an ERC20, approval is handled automatically.
- Only supported on Base mainnet.`,
    schema: MintclubBuyTokenInput,
  })
  async buyToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintclubBuyTokenInput>,
  ): Promise<string> {
    try {
      const bondAddress = getBondAddress(walletProvider.getNetwork().networkId!);
      const recipient = args.recipient || walletProvider.getAddress();

      const bondInfo = await getTokenBond(walletProvider, args.tokenAddress);
      if (!bondInfo) {
        return `Error: ${args.tokenAddress} is not a valid Mint Club V2 token.`;
      }

      // Check and handle ERC20 approval for reserve token
      const approvalNeeded = await needsApproval(
        walletProvider,
        bondInfo.reserveToken,
        walletProvider.getAddress(),
        args.maxReserveAmount,
      );

      if (approvalNeeded) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [bondAddress as `0x${string}`, BigInt(args.maxReserveAmount)],
        });

        const approveTxHash = await walletProvider.sendTransaction({
          to: bondInfo.reserveToken as `0x${string}`,
          data: approveData,
        });

        await walletProvider.waitForTransactionReceipt(approveTxHash);
      }

      const mintData = encodeFunctionData({
        abi: MCV2_BOND_ABI,
        functionName: "mint",
        args: [
          args.tokenAddress as `0x${string}`,
          BigInt(args.tokensToMint),
          BigInt(args.maxReserveAmount),
          recipient as `0x${string}`,
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: bondAddress as `0x${string}`,
        data: mintData,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully minted Mint Club tokens. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error buying Mint Club tokens: ${error}`;
    }
  }

  /**
   * Sells Mint Club tokens via the bonding curve.
   *
   * @param walletProvider - The wallet provider to sell tokens from.
   * @param args - The input arguments for the action.
   * @returns A message containing the sale details.
   */
  @CreateAction({
    name: "sell_token",
    description: `
This tool sells (burns) Mint Club V2 tokens via the bonding curve on Base.
Do not use this tool for selling other types of tokens.

Inputs:
- Token contract address
- Amount of tokens to burn (in wei)
- Minimum refund to receive (in wei, for slippage protection)

Important notes:
- Amounts are in wei (no decimal points). 1 token = 10^decimals wei.
- The min refund protects against slippage — the transaction reverts if refund is less.
- Token approval for the Bond contract is handled automatically.
- Only supported on Base mainnet.`,
    schema: MintclubSellTokenInput,
  })
  async sellToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintclubSellTokenInput>,
  ): Promise<string> {
    try {
      const bondAddress = getBondAddress(walletProvider.getNetwork().networkId!);
      const recipient = args.recipient || walletProvider.getAddress();

      // Verify sufficient balance
      const balance = (await walletProvider.readContract({
        address: args.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletProvider.getAddress() as `0x${string}`],
      })) as bigint;

      if (balance < BigInt(args.tokensToBurn)) {
        return `Error: Insufficient balance. You have ${balance.toString()} wei but are trying to sell ${args.tokensToBurn} wei.`;
      }

      // Check and handle token approval
      const approvalNeeded = await needsApproval(
        walletProvider,
        args.tokenAddress,
        walletProvider.getAddress(),
        args.tokensToBurn,
      );

      if (approvalNeeded) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [bondAddress as `0x${string}`, BigInt(args.tokensToBurn)],
        });

        const approveTxHash = await walletProvider.sendTransaction({
          to: args.tokenAddress as `0x${string}`,
          data: approveData,
        });

        await walletProvider.waitForTransactionReceipt(approveTxHash);
      }

      const burnData = encodeFunctionData({
        abi: MCV2_BOND_ABI,
        functionName: "burn",
        args: [
          args.tokenAddress as `0x${string}`,
          BigInt(args.tokensToBurn),
          BigInt(args.minRefund),
          recipient as `0x${string}`,
        ],
      });

      const txHash = await walletProvider.sendTransaction({
        to: bondAddress as `0x${string}`,
        data: burnData,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully sold Mint Club tokens. Transaction hash: ${txHash}`;
    } catch (error) {
      return `Error selling Mint Club tokens: ${error}`;
    }
  }

  /**
   * Creates a new Mint Club token with a bonding curve.
   *
   * @param walletProvider - The wallet provider to create the token from.
   * @param args - The input arguments for the action.
   * @returns A message containing the token creation details.
   */
  @CreateAction({
    name: "create_token",
    description: `
This tool creates a new Mint Club V2 ERC20 token with a bonding curve on Base.

Inputs:
- Token name and symbol
- Reserve token address (the asset that backs the bonding curve)
- Maximum supply (in wei)
- Step ranges and step prices arrays (define the bonding curve shape)
- Mint and burn royalty (in basis points, e.g., 100 = 1%)

The bonding curve is defined by parallel arrays of step ranges and prices:
- stepRanges: cumulative supply thresholds (e.g., ["500000000000000000000000", "1000000000000000000000000"])
- stepPrices: price per token at each step (e.g., ["10000000000000000", "100000000000000000"])
The last stepRange must equal maxSupply.

Important notes:
- May require a creation fee (paid in ETH)
- Royalties are in basis points: 100 = 1%, 10000 = 100%
- Only supported on Base mainnet`,
    schema: MintclubCreateTokenInput,
  })
  async createToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MintclubCreateTokenInput>,
  ): Promise<string> {
    try {
      const bondAddress = getBondAddress(walletProvider.getNetwork().networkId!);

      // Check creation fee
      const creationFee = (await walletProvider.readContract({
        address: bondAddress as `0x${string}`,
        abi: MCV2_BOND_ABI,
        functionName: "creationFee",
        args: [],
      })) as bigint;

      const tokenParams = {
        name: args.name,
        symbol: args.symbol,
      };

      const bondParams = {
        mintRoyalty: args.mintRoyalty,
        burnRoyalty: args.burnRoyalty,
        reserveToken: args.reserveToken as `0x${string}`,
        maxSupply: BigInt(args.maxSupply),
        stepRanges: args.stepRanges.map((r: string) => BigInt(r)),
        stepPrices: args.stepPrices.map((p: string) => BigInt(p)),
      };

      const createData = encodeFunctionData({
        abi: MCV2_BOND_ABI,
        functionName: "createToken",
        args: [tokenParams, bondParams],
      });

      const txHash = await walletProvider.sendTransaction({
        to: bondAddress as `0x${string}`,
        data: createData,
        value: creationFee,
      });

      await walletProvider.waitForTransactionReceipt(txHash);

      return `Successfully created Mint Club token "${args.name}" (${args.symbol}). Transaction hash: ${txHash}

The token contract address can be found in the transaction logs (TokenCreated event).`;
    } catch (error) {
      return `Error creating Mint Club token: ${error}`;
    }
  }

  /**
   * Checks if the Mint Club action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is supported, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    SUPPORTED_NETWORKS.includes(network.networkId!);
}

export const mintclubActionProvider = () => new MintclubActionProvider();
