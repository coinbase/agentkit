# GBLIN Action Provider

Actions for interacting with [GBLIN](https://gblin.digital), a collateral-backed treasury index
on Base (cbBTC / WETH / USDC). The vault mints at NAV, redeems pro rata in kind and reduces the
weight of a basket asset on-chain when it draws down. It is intended for parking surplus agent
capital in managed crypto exposure — **not** a stablecoin and not financial advice.

| Contract | Address |
| --- | --- |
| Vault (share token) | [`0xc2181d975c05c8c724b334bcED0764c0b86B1D53`](https://basescan.org/address/0xc2181d975c05c8c724b334bcED0764c0b86B1D53#code) |
| Lens (quotes) | [`0xfCFea8027019E8551A1f09AD91532471F5D26f61`](https://basescan.org/address/0xfCFea8027019E8551A1f09AD91532471F5D26f61#code) |
| Zap (exit to ETH) | [`0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200`](https://basescan.org/address/0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200#code) |

## Actions

| Action | Description |
| --- | --- |
| `buy_gblin` | Buy GBLIN with ETH. Reads `quoteBuy` from the Lens and calls `buyGBLIN` on the vault with a slippage-bounded minimum output. |
| `sell_gblin_for_eth` | Redeem GBLIN back to ETH (e.g. to fund an x402 payment). Reads `quoteSell` from the Lens, approves the shares to the Zap if needed, and calls `GBLINZap.sellGBLINForEth`, which redeems in kind and sells every leg, all or nothing. |
| `get_gblin_state` | Read the ETH value of one GBLIN at NAV, the total supply, and whether the vault reports its NAV as reliable. |

Every state-changing action derives its minimum output from an on-chain quote, and both
refuse to trade while the vault reports its NAV as not reliable.

## Network support

Base mainnet (`base-mainnet`) only.

## Example

```typescript
import { gblinActionProvider } from "@coinbase/agentkit";

const provider = gblinActionProvider();
```

## Notes

- Fees: 0.10% on mint and a 0.50% yearly management fee accrued as new shares; redemption pays no protocol fee.
- The vault enforces a 20-second redemption cooldown after a mint for oneself.
- The vault is owned by a 48-hour timelock; its parameters can change through it.
