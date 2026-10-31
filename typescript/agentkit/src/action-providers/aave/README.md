# Aave Action Provider

This directory contains the **AaveActionProvider** implementation, which provides actions to interact with the **Aave V3 Protocol** for lending and borrowing operations.

## Directory Structure

```
aave/
├── aaveActionProvider.ts         # Main provider with Aave functionality
├── aaveActionProvider.test.ts    # Test file for Aave provider
├── schemas.ts                    # Aave action schemas
├── constants.ts                  # Contract addresses and ABIs
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Actions

### Supply

`supply` - Supply assets to Aave as collateral

- **assetId**: The asset to supply (`weth`, `usdc`, `cbeth`, `wsteth`, `dai`, `usdt`)
- **amount**: The amount of tokens to supply in human-readable format

Example: "Supply 1 WETH to Aave"

### Withdraw

`withdraw` - Withdraw previously supplied assets from Aave

- **assetId**: The asset to withdraw
- **amount**: The amount of tokens to withdraw

Example: "Withdraw 1000 USDC from Aave"

### Borrow

`borrow` - Borrow assets from Aave against your collateral

- **assetId**: The asset to borrow (`weth`, `usdc`, `dai`, `usdt`)
- **amount**: The amount of tokens to borrow
- **interestRateMode**: Either `stable` or `variable` (default: variable)

Example: "Borrow 500 USDC with variable interest rate"

### Repay

`repay` - Repay borrowed assets to Aave

- **assetId**: The asset to repay
- **amount**: The amount of tokens to repay
- **interestRateMode**: The interest rate mode of the debt

Example: "Repay 500 USDC variable rate debt"

### Get User Data

`get_user_data` - Get the user's account summary from Aave

Returns:
- Total collateral in USD
- Total debt in USD
- Available borrows in USD
- Loan-to-Value ratio
- Liquidation threshold
- Health factor with status indicator

## Network Support

The Aave provider supports:
- **Base Mainnet** (`base-mainnet`)
- **Ethereum Mainnet** (`ethereum-mainnet`)

## Supported Assets

| Asset | Symbol | Base | Ethereum |
|-------|--------|------|----------|
| Wrapped ETH | WETH | ✅ | ✅ |
| USD Coin | USDC | ✅ | ✅ |
| Coinbase Wrapped ETH | cbETH | ✅ | ✅ |
| Wrapped stETH | wstETH | ✅ | ✅ |
| DAI Stablecoin | DAI | ✅ | ✅ |
| Tether USD | USDT | ✅ | ✅ |

## Important Notes

### Health Factor

The health factor represents the safety of your position:

| Health Factor | Status |
|---------------|--------|
| > 2.0 | ✅ Very Safe |
| 1.5 - 2.0 | 🟢 Safe |
| 1.1 - 1.5 | 🟡 Moderate Risk |
| 1.0 - 1.1 | 🟠 High Risk |
| < 1.0 | 🔴 Liquidation Risk |

### Interest Rate Modes

- **Variable**: Rate changes based on market supply/demand
- **Stable**: Fixed rate (may be higher than variable)

### Gas Considerations

- Supply and repay require token approval before the transaction
- All transactions require sufficient ETH for gas

## Example Usage

```typescript
import { aaveActionProvider } from "@coinbase/agentkit";

const aave = aaveActionProvider();

// Supply collateral
await aave.supply(wallet, { assetId: "weth", amount: "1" });

// Check account status
await aave.getUserData(wallet, {});

// Borrow against collateral
await aave.borrow(wallet, { 
  assetId: "usdc", 
  amount: "1000", 
  interestRateMode: "variable" 
});

// Repay debt
await aave.repay(wallet, { 
  assetId: "usdc", 
  amount: "1000", 
  interestRateMode: "variable" 
});

// Withdraw collateral
await aave.withdraw(wallet, { assetId: "weth", amount: "1" });
```

## References

- [Aave V3 Documentation](https://docs.aave.com/developers/getting-started/readme)
- [Aave V3 on Base](https://docs.aave.com/developers/deployed-contracts/v3-mainnet/base)
- [Aave Risk Parameters](https://docs.aave.com/risk/asset-risk/risk-parameters)

