# Sapien Vault Action Provider

This directory contains the **SapienVaultActionProvider**, which lets AgentKit agents deposit SAPIEN, withdraw or redeem vSAPIEN, transfer shares, and read vault totals and tranche position state on the Sapien Vault — an ERC-4626 vault on Base mainnet.

App: [https://vault.sapien.io](https://vault.sapien.io)

## Directory Structure

```
sapienVault/
├── sapienVaultActionProvider.ts         # Main provider
├── sapienVaultActionProvider.test.ts    # Unit tests
├── constants.ts                         # Base mainnet addresses and vault ABI
├── schemas.ts                           # Zod action schemas
├── utils.ts                             # Network guard and internal approve-if-needed
├── index.ts                             # Exports
└── README.md                            # This file
```

## Contracts (Base mainnet, EIP-55)

| Role | Address |
| --- | --- |
| Vault / vSAPIEN (ERC-4626) | `0x60Bf63729f688287a450299962b36Cef0aFfaa42` |
| Underlying SAPIEN | `0xC729777d0470F30612B1564Fd96E8Dd26f5814E3` |

## Actions

- `deposit`: ERC-4626 `deposit`. Approves SAPIEN internally only when allowance is insufficient (not a public action)
- `withdraw`: Exit by **asset** amount (`withdraw`)
- `redeem`: Exit by **share** amount (`redeem`)
- `transfer`: ERC-20 `transfer` of vSAPIEN shares to a destination (matured, unlocked shares only)
- `get_position`: Shares, assets, matured/pending tranches, available balance, locked stake, and `depositAgeStatus`
- `get_vault_totals`: Vault `totalAssets` and total shares (`totalSupply`)

There is no standalone `approve` action. ERC-20 approval is an implementation detail of `deposit`.

## Network Support

**Base mainnet only** (`networkId` `base-mainnet` or `chainId` `8453`).

`supportsNetwork` returns `false` on every other chain. Each action also returns a clear error if the connected wallet is not on Base mainnet (including Base Sepolia).

## Adding New Actions

1. Define the schema in `schemas.ts`
2. Implement the action in `sapienVaultActionProvider.ts`
3. Add tests in `sapienVaultActionProvider.test.ts`

## Notes

- Fresh deposits may be subject to `minDepositAge` before they can be withdrawn or transferred. Locked validator stake cannot be withdrawn or transferred until the engine unlocks it. Actions consult `maxDeposit` / `maxWithdraw` / `maxRedeem` / `maturedShares` / `availableBalance`.
- vSAPIEN share decimals are the underlying decimals plus an internal ERC-4626 offset. Share-denominated actions use the vault's `decimals()`.
- For protocol design, see the [SapienVault docs](https://github.com/Sapien-io/sapien-contracts/blob/main/docs/SapienVault.md).
