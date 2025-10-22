import { Decimal } from "decimal.js";
import { Address, formatUnits } from "viem";

import { EvmWalletProvider } from "../../wallet-providers";
import { ERC20_ABI, COMET_ABI, PRICE_FEED_ABI } from "./constants";
import { Network } from "../../network";
import { COMET_ADDRESSES, ASSET_ADDRESSES } from "./constants";

/**
 * Get token decimals from contract
 *
 * @param wallet - The wallet provider instance
 * @param tokenAddress - The address of the token contract
 * @returns The number of decimals for the token
 */
export const getTokenDecimals = async (
  wallet: EvmWalletProvider,
  tokenAddress: Address,
): Promise<number> => {
  const decimals = await wallet.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  return Number(decimals);
};

/**
 * Get token symbol from contract
 *
 * @param wallet - The wallet provider instance
 * @param tokenAddress - The address of the token contract
 * @returns The symbol of the token
 */
export const getTokenSymbol = async (
  wallet: EvmWalletProvider,
  tokenAddress: Address,
): Promise<string> => {
  const symbol = await wallet.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
  });

  return symbol;
};

/**
 * Get token balance for an address
 *
 * @param wallet - The wallet provider instance
 * @param tokenAddress - The address of the token contract
 * @returns The token balance as a bigint
 */
export const getTokenBalance = async (
  wallet: EvmWalletProvider,
  tokenAddress: Address,
): Promise<bigint> => {
  const balance = await wallet.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [wallet.getAddress() as `0x${string}`],
  });

  return balance;
};

/**
 * Get collateral balance for an address
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @param tokenAddress - The address of the token contract
 * @returns The collateral balance as a bigint
 */
export const getCollateralBalance = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
  tokenAddress: Address,
): Promise<bigint> => {
  const balance = await wallet.readContract({
    address: cometAddress,
    abi: COMET_ABI,
    functionName: "collateralBalanceOf",
    args: [(await wallet.getAddress()) as `0x${string}`, tokenAddress],
  });

  return balance;
};

/**
 * Get health ratio for an account
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @returns The health ratio as a Decimal
 */
export const getHealthRatio = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
): Promise<Decimal> => {
  const borrowDetails = await getBorrowDetails(wallet, cometAddress);
  const supplyDetails = await getSupplyDetails(wallet, cometAddress);

  const borrowValue = borrowDetails.borrowAmount.mul(borrowDetails.price);
  let totalAdjustedCollateral = new Decimal(0);

  for (const supply of supplyDetails) {
    const collateralValue = supply.supplyAmount.mul(supply.price);
    const adjustedValue = collateralValue.mul(supply.collateralFactor);
    totalAdjustedCollateral = totalAdjustedCollateral.add(adjustedValue);
  }

  return borrowValue.eq(0) ? new Decimal(Infinity) : totalAdjustedCollateral.div(borrowValue);
};

/**
 * Get health ratio after a hypothetical withdraw
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @param tokenAddress - The address of the token contract
 * @param amount - The amount to withdraw
 * @returns The health ratio after withdraw as a Decimal
 */
export const getHealthRatioAfterWithdraw = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
  tokenAddress: Address,
  amount: bigint,
): Promise<Decimal> => {
  const borrowDetails = await getBorrowDetails(wallet, cometAddress);
  const supplyDetails = await getSupplyDetails(wallet, cometAddress);
  const borrowValue = borrowDetails.borrowAmount.mul(borrowDetails.price);
  let totalAdjustedCollateral = new Decimal(0);

  for (const supply of supplyDetails) {
    const supplyTokenSymbol = supply.tokenSymbol;
    const withdrawTokenSymbol = await getTokenSymbol(wallet, tokenAddress);

    if (supplyTokenSymbol === withdrawTokenSymbol) {
      const decimals = await getTokenDecimals(wallet, tokenAddress);
      const withdrawAmountHuman = new Decimal(formatUnits(amount, decimals));
      const newSupplyAmount = supply.supplyAmount.sub(withdrawAmountHuman);
      const assetValue = newSupplyAmount.mul(supply.price);
      totalAdjustedCollateral = totalAdjustedCollateral.add(
        assetValue.mul(supply.collateralFactor),
      );
    } else {
      totalAdjustedCollateral = totalAdjustedCollateral.add(
        supply.supplyAmount.mul(supply.price).mul(supply.collateralFactor),
      );
    }
  }

  return borrowValue.eq(0) ? new Decimal(Infinity) : totalAdjustedCollateral.div(borrowValue);
};

/**
 * Get health ratio after a hypothetical borrow
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @param amount - The amount to borrow
 * @returns The health ratio after borrow as a Decimal
 */
export const getHealthRatioAfterBorrow = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
  amount: bigint,
): Promise<Decimal> => {
  const borrowDetails = await getBorrowDetails(wallet, cometAddress);
  const supplyDetails = await getSupplyDetails(wallet, cometAddress);

  const baseToken = await getBaseTokenAddress(wallet, cometAddress);
  const baseDecimals = await getTokenDecimals(wallet, baseToken);

  const additionalBorrow = new Decimal(formatUnits(amount, baseDecimals));
  const newBorrow = borrowDetails.borrowAmount.add(additionalBorrow);
  const newBorrowValue = newBorrow.mul(borrowDetails.price);

  let totalAdjustedCollateral = new Decimal(0);
  for (const supply of supplyDetails) {
    totalAdjustedCollateral = totalAdjustedCollateral.add(
      supply.supplyAmount.mul(supply.price).mul(supply.collateralFactor),
    );
  }

  return newBorrowValue.eq(0) ? new Decimal(Infinity) : totalAdjustedCollateral.div(newBorrowValue);
};

/**
 * Get portfolio details in markdown format
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @returns A markdown formatted string with portfolio details
 */
export const getPortfolioDetailsMarkdown = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
): Promise<string> => {
  let markdownOutput = "# Portfolio Details\n\n";
  markdownOutput += "## Supply Details\n\n";
  let totalSupplyValue = new Decimal(0);
  const supplyDetails = await getSupplyDetails(wallet, cometAddress);

  if (supplyDetails.length > 0) {
    for (const supply of supplyDetails) {
      const token = supply.tokenSymbol;
      const supplyAmount = supply.supplyAmount;
      const price = supply.price;
      const decimals = supply.decimals;
      const collateralFactor = supply.collateralFactor;
      const assetValue = supplyAmount.mul(price);

      markdownOutput += `### ${token}\n`;
      markdownOutput += `- **Supply Amount:** ${supplyAmount.toFixed(decimals)}\n`;
      markdownOutput += `- **Price:** $${price.toFixed(2)}\n`;
      markdownOutput += `- **Collateral Factor:** ${collateralFactor.toFixed(2)}\n`;
      markdownOutput += `- **Asset Value:** $${assetValue.toFixed(2)}\n\n`;
      totalSupplyValue = totalSupplyValue.add(assetValue);
    }
  } else {
    markdownOutput += "No supplied assets found in your Compound position.\n\n";
  }

  markdownOutput += `### Total Supply Value: $${totalSupplyValue.toFixed(2)}\n\n`;
  markdownOutput += "## Borrow Details\n\n";
  const borrowDetails = await getBorrowDetails(wallet, cometAddress);

  if (borrowDetails.borrowAmount.gt(0)) {
    const token = borrowDetails.tokenSymbol;
    const price = borrowDetails.price;
    const borrowValue = borrowDetails.borrowAmount.mul(price);
    markdownOutput += `### ${token}\n`;
    markdownOutput += `- **Borrow Amount:** ${borrowDetails.borrowAmount.toFixed(6)}\n`;
    markdownOutput += `- **Price:** $${price.toFixed(2)}\n`;
    markdownOutput += `- **Borrow Value:** $${borrowValue.toFixed(2)}\n\n`;
  } else {
    markdownOutput += "No borrowed assets found in your Compound position.\n\n";
  }

  markdownOutput += "## Overall Health\n\n";
  const healthRatio = await getHealthRatio(wallet, cometAddress);
  markdownOutput += `- **Health Ratio:** ${healthRatio.toFixed(2)}\n`;

  return markdownOutput;
};

/**
 * Fetch the latest price feed data.
 *
 * @param wallet - The wallet provider instance
 * @param priceFeedAddress - The address of the price feed contract
 * @returns A tuple containing the price and timestamp
 */
const getPriceFeedData = async (
  wallet: EvmWalletProvider,
  priceFeedAddress: Address,
): Promise<[string, number]> => {
  const latestData = await wallet.readContract({
    address: priceFeedAddress,
    abi: PRICE_FEED_ABI,
    functionName: "latestRoundData",
    args: [],
  });

  const answer = latestData[1].toString();
  const updatedAt = Number(latestData[3]);
  return [answer, updatedAt];
};

/**
 * Retrieve borrow details: amount, base token symbol, and price.
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @returns An object containing borrow details
 */
const getBorrowDetails = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
): Promise<{ tokenSymbol: string; borrowAmount: Decimal; price: Decimal }> => {
  const borrowAmountRaw = await wallet.readContract({
    address: cometAddress,
    abi: COMET_ABI,
    functionName: "borrowBalanceOf",
    args: [(await wallet.getAddress()) as `0x${string}`],
  });

  const baseToken = await getBaseTokenAddress(wallet, cometAddress);
  const baseDecimals = await getTokenDecimals(wallet, baseToken);
  const baseTokenSymbol = await getTokenSymbol(wallet, baseToken);

  const basePriceFeed = await wallet.readContract({
    address: cometAddress,
    abi: COMET_ABI,
    functionName: "baseTokenPriceFeed",
    args: [],
  });

  const [basePriceRaw] = await getPriceFeedData(wallet, basePriceFeed);
  const humanBorrowAmount = new Decimal(formatUnits(borrowAmountRaw, baseDecimals));
  const price = new Decimal(basePriceRaw).div(new Decimal(10).pow(8));

  return { tokenSymbol: baseTokenSymbol, borrowAmount: humanBorrowAmount, price };
};

/**
 * Retrieve supply details across all collateral assets.
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @returns An array of supply details for each asset
 */
const getSupplyDetails = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
): Promise<
  Array<{
    tokenSymbol: string;
    supplyAmount: Decimal;
    price: Decimal;
    collateralFactor: Decimal;
    decimals: number;
  }>
> => {
  const numAssets = await wallet.readContract({
    address: cometAddress,
    abi: COMET_ABI,
    functionName: "numAssets",
    args: [],
  });

  const supplyDetails: Array<{
    tokenSymbol: string;
    supplyAmount: Decimal;
    price: Decimal;
    collateralFactor: Decimal;
    decimals: number;
  }> = [];

  for (let i = 0; i < numAssets; i++) {
    const assetInfo = await wallet.readContract({
      address: cometAddress,
      abi: COMET_ABI,
      functionName: "getAssetInfo",
      args: [i],
    });

    const assetAddress = assetInfo.asset;
    const collateralBalance = await getCollateralBalance(wallet, cometAddress, assetAddress);

    if (collateralBalance > 0n) {
      const tokenSymbol = await getTokenSymbol(wallet, assetAddress);
      const decimals = await getTokenDecimals(wallet, assetAddress);
      const [priceRaw] = await getPriceFeedData(wallet, assetInfo.priceFeed);
      const humanSupplyAmount = new Decimal(formatUnits(collateralBalance, decimals));
      const price = new Decimal(priceRaw).div(new Decimal(10).pow(8));
      const collateralFactor = new Decimal(assetInfo.borrowCollateralFactor.toString()).div(
        new Decimal(10).pow(18),
      );

      supplyDetails.push({
        tokenSymbol,
        supplyAmount: humanSupplyAmount,
        price,
        collateralFactor,
        decimals,
      });
    }
  }

  return supplyDetails;
};

/**
 * Gets the Comet address for the current network.
 *
 * @param network - The network instance
 * @returns The Comet contract address
 */
export const getCometAddress = (network: Network): Address => {
  if (!network.networkId) {
    throw new Error("Network ID is required");
  }

  if (network.networkId === "base-mainnet") {
    return COMET_ADDRESSES["base-mainnet"];
  } else if (network.networkId === "base-sepolia") {
    return COMET_ADDRESSES["base-sepolia"];
  }

  throw new Error(`Network ${network.networkId} not supported`);
};

/**
 * Gets the asset address for a given assetId on the current network.
 *
 * @param network - The network instance
 * @param assetId - The identifier of the asset
 * @returns The asset contract address
 */
export const getAssetAddress = (network: Network, assetId: string): Address => {
  if (!network.networkId) {
    throw new Error("Network ID is required");
  }

  const normalizedAssetId = assetId.toLowerCase();

  if (network.networkId === "base-mainnet") {
    const address = ASSET_ADDRESSES["base-mainnet"][normalizedAssetId];
    if (!address) {
      throw new Error(`Asset ${assetId} not supported on Base Mainnet`);
    }
    return address;
  } else if (network.networkId === "base-sepolia") {
    const address = ASSET_ADDRESSES["base-sepolia"][normalizedAssetId];
    if (!address) {
      throw new Error(`Asset ${assetId} not supported on Base Sepolia`);
    }
    return address;
  }

  throw new Error(`Network ${network.networkId} not supported`);
};

/**
 * Get the base token address for a Compound market
 *
 * @param wallet - The wallet provider instance
 * @param cometAddress - The address of the Comet contract
 * @returns The base token address
 */
export const getBaseTokenAddress = async (
  wallet: EvmWalletProvider,
  cometAddress: Address,
): Promise<Address> => {
  const baseToken = await wallet.readContract({
    address: cometAddress,
    abi: COMET_ABI,
    functionName: "baseToken",
    args: [],
  });

  return baseToken;
};
