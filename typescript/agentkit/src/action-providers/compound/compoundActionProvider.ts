import { z } from "zod";
import { encodeFunctionData, formatUnits, parseUnits } from "viem";

import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import { COMET_ABI } from "./constants";
import {
  CompoundSupplySchema,
  CompoundWithdrawSchema,
  CompoundBorrowSchema,
  CompoundRepaySchema,
  CompoundPortfolioSchema,
} from "./schemas";
import {
  getCollateralBalance,
  getHealthRatio,
  getHealthRatioAfterBorrow,
  getHealthRatioAfterWithdraw,
  getTokenBalance,
  getTokenDecimals,
  getTokenSymbol,
  getPortfolioDetailsMarkdown,
  getCometAddress,
  getAssetAddress,
  getBaseTokenAddress,
} from "./utils";

/**
 * CompoundActionProvider is an action provider for Compound protocol interactions.
 */
export class CompoundActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new CompoundActionProvider instance.
   */
  constructor() {
    super("compound", []);
  }

  /**
   * Supplies collateral assets to Compound.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "supply",
    description: `
This tool allows supplying collateral assets to Compound.
It takes:
- assetId: The asset to supply, one of 'weth', 'cbeth', 'cbbtc', 'wsteth', or 'usdc'
- amount: The amount of tokens to supply in human-readable format
Examples:
- 1 WETH
- 0.1 WETH
- 0.01 WETH
Important notes:
- Use the exact amount provided
- The token must be an approved collateral asset for the Compound market
    `,
    schema: CompoundSupplySchema,
  })
  async supply(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CompoundSupplySchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const cometAddress = getCometAddress(network);
      const tokenAddress = getAssetAddress(network, args.assetId);

      if (!tokenAddress) {
        throw new Error(`Token address undefined for assetId ${args.assetId}`);
      }

      const decimals = await getTokenDecimals(wallet, tokenAddress);
      const amountAtomic = parseUnits(args.amount, decimals);

      // Check wallet balance before proceeding
      const walletBalance = await getTokenBalance(wallet, tokenAddress);
      if (walletBalance < amountAtomic) {
        const humanBalance = formatUnits(walletBalance, decimals);
        return `Error: Insufficient balance. You have ${humanBalance}, but trying to supply ${args.amount}`;
      }

      // Get current health ratio for reference
      const currentHealth = await getHealthRatio(wallet, cometAddress);

      // Approve Compound to spend tokens
      const approvalResult = await approve(wallet, tokenAddress, cometAddress, amountAtomic);
      if (approvalResult.startsWith("Error")) {
        return `Error approving token: ${approvalResult}`;
      }

      // Supply tokens to Compound
      const data = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "supply",
        args: [tokenAddress, amountAtomic],
      });

      const txHash = await wallet.sendTransaction({
        to: cometAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get new health ratio and token symbol
      const newHealth = await getHealthRatio(wallet, cometAddress);
      const tokenSymbol = await getTokenSymbol(wallet, tokenAddress);

      // Only add the health ratio message if at least one of the values is not Infinity
      const healthMessage =
        currentHealth.eq(Infinity) && newHealth.eq(Infinity)
          ? ""
          : `\nHealth ratio changed from ${currentHealth.toFixed(2)} to ${newHealth.toFixed(2)}`;

      return `Supplied ${args.amount} ${tokenSymbol} to Compound.\nTransaction hash: ${txHash}${healthMessage}`;
    } catch (error) {
      return `Error supplying to Compound: ${
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? `Error: ${error.message}`
            : error
      }`;
    }
  }

  /**
   * Withdraws collateral assets from Compound.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool allows withdrawing collateral assets from Compound.
It takes:
- assetId: The asset to withdraw, one of 'weth', 'cbeth', 'cbbtc', 'wsteth', or 'usdc'
- amount: The amount of tokens to withdraw in human-readable format
Examples:
- 1 WETH
- 0.1 WETH
- 0.01 WETH
Important notes:
- Use the exact amount provided
- The token must be a collateral asset you have supplied to the Compound market
    `,
    schema: CompoundWithdrawSchema,
  })
  async withdraw(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CompoundWithdrawSchema>,
  ): Promise<string> {
    try {
      const cometAddress = getCometAddress(wallet.getNetwork());
      const tokenAddress = getAssetAddress(wallet.getNetwork(), args.assetId);

      const decimals = await getTokenDecimals(wallet, tokenAddress);
      const amountAtomic = parseUnits(args.amount, decimals);

      // Check that there is enough collateral supplied to withdraw
      const collateralBalance = await getCollateralBalance(wallet, cometAddress, tokenAddress);
      if (amountAtomic > collateralBalance) {
        const humanBalance = formatUnits(collateralBalance, decimals);
        return `Error: Insufficient balance. Trying to withdraw ${args.amount}, but only have ${humanBalance} supplied`;
      }

      // Check if position would be healthy after withdrawal
      const projectedHealthRatio = await getHealthRatioAfterWithdraw(
        wallet,
        cometAddress,
        tokenAddress,
        amountAtomic,
      );
      if (projectedHealthRatio.lessThan(1)) {
        return `Error: Withdrawing ${args.amount} would result in an unhealthy position. Health ratio would be ${projectedHealthRatio.toFixed(2)}`;
      }

      // Withdraw from Compound
      const data = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "withdraw",
        args: [tokenAddress, amountAtomic],
      });

      const txHash = await wallet.sendTransaction({
        to: cometAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get current and new health ratios and token symbol
      const currentHealth = await getHealthRatio(wallet, cometAddress);
      const newHealth = await getHealthRatio(wallet, cometAddress);
      const tokenSymbol = await getTokenSymbol(wallet, tokenAddress);

      return (
        `Withdrawn ${args.amount} ${tokenSymbol} from Compound.\n` +
        `Transaction hash: ${txHash}\n` +
        `Health ratio changed from ${currentHealth.toFixed(2)} to ${newHealth.toFixed(2)}`
      );
    } catch (error) {
      return `Error withdrawing from Compound: ${error instanceof Error ? error : error && typeof error === "object" && "message" in error ? `Error: ${error.message}` : error}`;
    }
  }

  /**
   * Borrows base assets from Compound.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "borrow",
    description: `
This tool allows borrowing base assets from Compound.
It takes:
- assetId: The asset to borrow, either 'weth' or 'usdc'
- amount: The amount of base tokens to borrow in human-readable format
Examples:
- 1000 USDC
- 0.5 WETH
Important notes:
- Use the exact amount provided
- Ensure you have sufficient collateral to borrow
    `,
    schema: CompoundBorrowSchema,
  })
  async borrow(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CompoundBorrowSchema>,
  ): Promise<string> {
    try {
      const cometAddress = getCometAddress(wallet.getNetwork());
      const baseTokenAddress = await getBaseTokenAddress(wallet, cometAddress);
      const decimals = await getTokenDecimals(wallet, baseTokenAddress);

      // Convert human-readable amount to atomic units
      const amountAtomic = parseUnits(args.amount, decimals);

      // Get current health ratio for reference
      const currentHealth = await getHealthRatio(wallet, cometAddress);
      const currentHealthStr = currentHealth.eq(Infinity) ? "Inf.%" : currentHealth.toFixed(2);

      // Check if position would be healthy after borrow
      const projectedHealthRatio = await getHealthRatioAfterBorrow(
        wallet,
        cometAddress,
        amountAtomic,
      );
      if (projectedHealthRatio.lessThan(1)) {
        return `Error: Borrowing ${args.amount} USDC would result in an unhealthy position. Health ratio would be ${projectedHealthRatio.toFixed(2)}`;
      }

      // Use the withdraw method to borrow from Compound
      const data = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "withdraw",
        args: [baseTokenAddress, amountAtomic],
      });

      const txHash = await wallet.sendTransaction({
        to: cometAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get new health ratio
      const newHealth = await getHealthRatio(wallet, cometAddress);
      const newHealthStr = newHealth.eq(Infinity) ? "Inf.%" : newHealth.toFixed(2);

      return (
        `Borrowed ${args.amount} USDC from Compound.\n` +
        `Transaction hash: ${txHash}\n` +
        `Health ratio changed from ${currentHealthStr} to ${newHealthStr}`
      );
    } catch (error) {
      return `Error borrowing from Compound: ${error instanceof Error ? error : error && typeof error === "object" && "message" in error ? `Error: ${error.message}` : error}`;
    }
  }

  /**
   * Repays borrowed assets to Compound.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "repay",
    description: `
This tool allows repaying borrowed assets to Compound.
It takes:
- assetId: The asset to repay, either 'weth' or 'usdc'
- amount: The amount of tokens to repay in human-readable format
Examples:
- 1000 USDC
- 0.5 WETH
Important notes:
- Use the exact amount provided
- Ensure you have sufficient balance of the asset to repay
    `,
    schema: CompoundRepaySchema,
  })
  async repay(
    wallet: EvmWalletProvider,
    args: z.infer<typeof CompoundRepaySchema>,
  ): Promise<string> {
    try {
      const cometAddress = getCometAddress(wallet.getNetwork());
      const tokenAddress = getAssetAddress(wallet.getNetwork(), args.assetId);

      const tokenDecimals = await getTokenDecimals(wallet, tokenAddress);
      const amountAtomic = parseUnits(args.amount, tokenDecimals);
      const tokenBalance = await getTokenBalance(wallet, tokenAddress);

      if (tokenBalance < amountAtomic) {
        const humanBalance = formatUnits(tokenBalance, tokenDecimals);
        return `Error: Insufficient balance. You have ${humanBalance}, but trying to repay ${args.amount}`;
      }

      // Get current health ratio for reference
      const currentHealth = await getHealthRatio(wallet, cometAddress);

      // Approve Compound to spend tokens
      const approvalResult = await approve(wallet, tokenAddress, cometAddress, amountAtomic);
      if (approvalResult.startsWith("Error")) {
        return `Error approving token: ${approvalResult}`;
      }

      // Repay debt by supplying tokens to Compound
      const data = encodeFunctionData({
        abi: COMET_ABI,
        functionName: "supply",
        args: [tokenAddress, amountAtomic],
      });

      const txHash = await wallet.sendTransaction({
        to: cometAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get new health ratio and token symbol
      const newHealth = await getHealthRatio(wallet, cometAddress);
      const tokenSymbol = await getTokenSymbol(wallet, tokenAddress);

      return (
        `Repaid ${args.amount} ${tokenSymbol} to Compound.\n` +
        `Transaction hash: ${txHash}\n` +
        `Health ratio improved from ${currentHealth.toFixed(2)} to ${newHealth.toFixed(2)}`
      );
    } catch (error) {
      return `Error repaying to Compound: ${error instanceof Error ? error : error && typeof error === "object" && "message" in error ? `Error: ${error.message}` : error}`;
    }
  }

  /**
   * Retrieves portfolio details from Compound.
   *
   * @param wallet - The wallet instance to fetch portfolio details.
   * @param _ - No input is required for this action.
   * @returns A Markdown formatted string with portfolio details or an error message.
   */
  @CreateAction({
    name: "get_portfolio",
    description: `
This tool allows getting portfolio details from Compound.
Returns portfolio details including:
- Collateral balances and USD values
- Borrowed amounts and USD values
Formatted in Markdown for readability.
    `,
    schema: CompoundPortfolioSchema,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPortfolio(
    wallet: EvmWalletProvider,
    _: z.infer<typeof CompoundPortfolioSchema>,
  ): Promise<string> {
    try {
      const cometAddress = getCometAddress(wallet.getNetwork());
      return await getPortfolioDetailsMarkdown(wallet, cometAddress);
    } catch (error) {
      return `Error getting portfolio details: ${error && typeof error === "object" && "message" in error ? error.message : error}`;
    }
  }

  /**
   * Checks if the Compound action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is supported, false otherwise.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (network.networkId === "base-mainnet" || network.networkId === "base-sepolia");
}

/**
 * Factory function to create a new instance of CompoundActionProvider.
 *
 * @returns A new CompoundActionProvider instance.
 */
export const compoundActionProvider = (): CompoundActionProvider => new CompoundActionProvider();
