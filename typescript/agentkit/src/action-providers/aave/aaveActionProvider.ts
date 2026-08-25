import { z } from "zod";
import { encodeFunctionData, formatUnits, parseUnits, Address } from "viem";

import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { approve } from "../../utils";
import { Network } from "../../network";
import {
  AAVE_POOL_ABI,
  AAVE_POOL_ADDRESSES,
  TOKEN_ADDRESSES,
  ERC20_ABI,
} from "./constants";
import {
  AaveSupplySchema,
  AaveWithdrawSchema,
  AaveBorrowSchema,
  AaveRepaySchema,
  AaveGetUserDataSchema,
  AaveGetReserveDataSchema,
} from "./schemas";

/**
 * Helper function to get the Aave Pool address for a network.
 */
function getPoolAddress(networkId: string): Address {
  const address = AAVE_POOL_ADDRESSES[networkId];
  if (!address) {
    throw new Error(`Aave Pool not available on network: ${networkId}`);
  }
  return address;
}

/**
 * Helper function to get token address.
 */
function getTokenAddress(networkId: string, assetId: string): Address {
  const networkTokens = TOKEN_ADDRESSES[networkId];
  if (!networkTokens) {
    throw new Error(`Network not supported: ${networkId}`);
  }
  const address = networkTokens[assetId];
  if (!address) {
    throw new Error(`Token ${assetId} not available on network: ${networkId}`);
  }
  return address;
}

/**
 * Convert interest rate mode string to number.
 */
function getInterestRateMode(mode: "stable" | "variable"): bigint {
  return mode === "stable" ? 1n : 2n;
}

/**
 * AaveActionProvider is an action provider for Aave V3 protocol interactions.
 */
export class AaveActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new AaveActionProvider instance.
   */
  constructor() {
    super("aave", []);
  }

  /**
   * Supplies assets to Aave as collateral.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "supply",
    description: `
This tool allows supplying assets to Aave V3 as collateral.
It takes:
- assetId: The asset to supply, one of 'weth', 'usdc', 'cbeth', 'wsteth', 'dai', 'usdt'
- amount: The amount of tokens to supply in human-readable format
Examples:
- 1 WETH
- 1000 USDC
- 0.5 cbETH
Important notes:
- Use the exact amount provided by the user
- The token will be supplied as collateral and can be used to borrow other assets
- Make sure you have sufficient token balance before supplying
    `,
    schema: AaveSupplySchema,
  })
  async supply(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AaveSupplySchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId!;
      const poolAddress = getPoolAddress(networkId);
      const tokenAddress = getTokenAddress(networkId, args.assetId);
      const walletAddress = await wallet.getAddress();

      // Get token decimals
      const decimals = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }) as number;

      const amountAtomic = parseUnits(args.amount, decimals);

      // Check wallet balance
      const balance = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }) as bigint;

      if (balance < amountAtomic) {
        const humanBalance = formatUnits(balance, decimals);
        return `Error: Insufficient balance. You have ${humanBalance} ${args.assetId.toUpperCase()}, but trying to supply ${args.amount}`;
      }

      // Approve Aave Pool to spend tokens
      const approvalResult = await approve(wallet, tokenAddress, poolAddress, amountAtomic);
      if (approvalResult.startsWith("Error")) {
        return `Error approving token: ${approvalResult}`;
      }

      // Supply to Aave
      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [tokenAddress, amountAtomic, walletAddress as Address, 0],
      });

      const txHash = await wallet.sendTransaction({
        to: poolAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get token symbol
      const symbol = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
        args: [],
      }) as string;

      return `Successfully supplied ${args.amount} ${symbol} to Aave.\nTransaction hash: ${txHash}\n\nYour supplied assets can now be used as collateral to borrow other assets.`;
    } catch (error) {
      return `Error supplying to Aave: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Withdraws assets from Aave.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId and amount.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool allows withdrawing assets from Aave V3.
It takes:
- assetId: The asset to withdraw, one of 'weth', 'usdc', 'cbeth', 'wsteth', 'dai', 'usdt'
- amount: The amount of tokens to withdraw in human-readable format
Examples:
- 1 WETH
- 1000 USDC
Important notes:
- You can only withdraw assets you have previously supplied
- Withdrawing may affect your health factor if you have outstanding borrows
- Use 'max' or a very large number to withdraw all available balance
    `,
    schema: AaveWithdrawSchema,
  })
  async withdraw(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AaveWithdrawSchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId!;
      const poolAddress = getPoolAddress(networkId);
      const tokenAddress = getTokenAddress(networkId, args.assetId);
      const walletAddress = await wallet.getAddress();

      // Get token decimals
      const decimals = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }) as number;

      const amountAtomic = parseUnits(args.amount, decimals);

      // Withdraw from Aave
      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "withdraw",
        args: [tokenAddress, amountAtomic, walletAddress as Address],
      });

      const txHash = await wallet.sendTransaction({
        to: poolAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get token symbol
      const symbol = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
        args: [],
      }) as string;

      return `Successfully withdrawn ${args.amount} ${symbol} from Aave.\nTransaction hash: ${txHash}`;
    } catch (error) {
      return `Error withdrawing from Aave: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Borrows assets from Aave.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId, amount, and interestRateMode.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "borrow",
    description: `
This tool allows borrowing assets from Aave V3.
It takes:
- assetId: The asset to borrow, one of 'weth', 'usdc', 'dai', 'usdt'
- amount: The amount of tokens to borrow in human-readable format
- interestRateMode: Either 'stable' or 'variable' (default: variable)
Examples:
- Borrow 1000 USDC with variable rate
- Borrow 0.5 WETH with stable rate
Important notes:
- You must have sufficient collateral supplied before borrowing
- Variable rate changes based on market conditions
- Stable rate provides predictable interest but may be higher
- Monitor your health factor to avoid liquidation
    `,
    schema: AaveBorrowSchema,
  })
  async borrow(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AaveBorrowSchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId!;
      const poolAddress = getPoolAddress(networkId);
      const tokenAddress = getTokenAddress(networkId, args.assetId);
      const walletAddress = await wallet.getAddress();

      // Get token decimals
      const decimals = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }) as number;

      const amountAtomic = parseUnits(args.amount, decimals);
      const interestRateMode = getInterestRateMode(args.interestRateMode || "variable");

      // Borrow from Aave
      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "borrow",
        args: [tokenAddress, amountAtomic, interestRateMode, 0, walletAddress as Address],
      });

      const txHash = await wallet.sendTransaction({
        to: poolAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get token symbol
      const symbol = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
        args: [],
      }) as string;

      return `Successfully borrowed ${args.amount} ${symbol} from Aave with ${args.interestRateMode || "variable"} interest rate.\nTransaction hash: ${txHash}\n\n⚠️ Remember to monitor your health factor and repay your debt to avoid liquidation.`;
    } catch (error) {
      return `Error borrowing from Aave: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Repays borrowed assets to Aave.
   *
   * @param wallet - The wallet instance to perform the transaction.
   * @param args - The input arguments including assetId, amount, and interestRateMode.
   * @returns A message indicating success or an error message.
   */
  @CreateAction({
    name: "repay",
    description: `
This tool allows repaying borrowed assets to Aave V3.
It takes:
- assetId: The asset to repay, one of 'weth', 'usdc', 'dai', 'usdt'
- amount: The amount of tokens to repay in human-readable format
- interestRateMode: The interest rate mode of the debt, 'stable' or 'variable'
Examples:
- Repay 1000 USDC variable rate debt
- Repay 0.5 WETH stable rate debt
Important notes:
- Make sure you have sufficient balance of the asset to repay
- Repaying improves your health factor
- Use 'max' or a very large number to repay all debt
    `,
    schema: AaveRepaySchema,
  })
  async repay(
    wallet: EvmWalletProvider,
    args: z.infer<typeof AaveRepaySchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId!;
      const poolAddress = getPoolAddress(networkId);
      const tokenAddress = getTokenAddress(networkId, args.assetId);
      const walletAddress = await wallet.getAddress();

      // Get token decimals
      const decimals = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
      }) as number;

      const amountAtomic = parseUnits(args.amount, decimals);
      const interestRateMode = getInterestRateMode(args.interestRateMode || "variable");

      // Check wallet balance
      const balance = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }) as bigint;

      if (balance < amountAtomic) {
        const humanBalance = formatUnits(balance, decimals);
        return `Error: Insufficient balance. You have ${humanBalance} ${args.assetId.toUpperCase()}, but trying to repay ${args.amount}`;
      }

      // Approve Aave Pool to spend tokens
      const approvalResult = await approve(wallet, tokenAddress, poolAddress, amountAtomic);
      if (approvalResult.startsWith("Error")) {
        return `Error approving token: ${approvalResult}`;
      }

      // Repay to Aave
      const data = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "repay",
        args: [tokenAddress, amountAtomic, interestRateMode, walletAddress as Address],
      });

      const txHash = await wallet.sendTransaction({
        to: poolAddress,
        data,
      });
      await wallet.waitForTransactionReceipt(txHash);

      // Get token symbol
      const symbol = await wallet.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
        args: [],
      }) as string;

      return `Successfully repaid ${args.amount} ${symbol} to Aave.\nTransaction hash: ${txHash}\n\nYour health factor has improved.`;
    } catch (error) {
      return `Error repaying to Aave: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets user account data from Aave.
   *
   * @param wallet - The wallet instance to fetch data.
   * @param _ - No input arguments required.
   * @returns User account data including collateral, debt, and health factor.
   */
  @CreateAction({
    name: "get_user_data",
    description: `
This tool retrieves the user's account data from Aave V3.
Returns:
- Total collateral in USD
- Total debt in USD
- Available borrows in USD
- Loan-to-Value ratio
- Liquidation threshold
- Health factor

The health factor indicates the safety of your position:
- Health factor > 1: Position is safe
- Health factor < 1: Position may be liquidated
    `,
    schema: AaveGetUserDataSchema,
  })
  async getUserData(
    wallet: EvmWalletProvider,
    _: z.infer<typeof AaveGetUserDataSchema>,
  ): Promise<string> {
    try {
      const network = wallet.getNetwork();
      const networkId = network.networkId!;
      const poolAddress = getPoolAddress(networkId);
      const walletAddress = await wallet.getAddress();

      const userData = await wallet.readContract({
        address: poolAddress,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [walletAddress as Address],
      }) as [bigint, bigint, bigint, bigint, bigint, bigint];

      const [
        totalCollateralBase,
        totalDebtBase,
        availableBorrowsBase,
        currentLiquidationThreshold,
        ltv,
        healthFactor,
      ] = userData;

      // Format values (Aave uses 8 decimals for USD values)
      const collateralUSD = formatUnits(totalCollateralBase, 8);
      const debtUSD = formatUnits(totalDebtBase, 8);
      const availableBorrowsUSD = formatUnits(availableBorrowsBase, 8);
      const healthFactorFormatted = formatUnits(healthFactor, 18);

      // Build response
      let response = `## Aave Account Summary\n\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Total Collateral | $${Number(collateralUSD).toLocaleString()} |\n`;
      response += `| Total Debt | $${Number(debtUSD).toLocaleString()} |\n`;
      response += `| Available to Borrow | $${Number(availableBorrowsUSD).toLocaleString()} |\n`;
      response += `| Loan-to-Value (LTV) | ${Number(ltv) / 100}% |\n`;
      response += `| Liquidation Threshold | ${Number(currentLiquidationThreshold) / 100}% |\n`;
      response += `| Health Factor | ${Number(healthFactorFormatted).toFixed(2)} |\n\n`;

      // Add health status
      const hf = Number(healthFactorFormatted);
      if (hf > 2) {
        response += `✅ **Position Status:** Very Safe`;
      } else if (hf > 1.5) {
        response += `🟢 **Position Status:** Safe`;
      } else if (hf > 1.1) {
        response += `🟡 **Position Status:** Moderate Risk`;
      } else if (hf > 1) {
        response += `🟠 **Position Status:** High Risk - Consider repaying debt`;
      } else {
        response += `🔴 **Position Status:** DANGER - Liquidation imminent!`;
      }

      return response;
    } catch (error) {
      return `Error getting user data from Aave: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Aave action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the network is supported, false otherwise.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (network.networkId === "base-mainnet" || network.networkId === "ethereum-mainnet");
}

/**
 * Factory function to create a new AaveActionProvider instance.
 *
 * @returns A new AaveActionProvider instance.
 */
export const aaveActionProvider = (): AaveActionProvider => new AaveActionProvider();

