# Peer Cash Action Provider

This directory contains the **PeerCashActionProvider** implementation, which provides actions to cash out **Base USDC to fiat** in the user's payment app (Venmo, Revolut, Wise, Zelle, and more) via the **Peer P2P protocol**, using the [@zkp2p/cash](https://www.npmjs.com/package/@zkp2p/cash) SDK.

## Directory Structure

```
peerCash/
├── peerCashActionProvider.ts       # Main provider with Peer Cash functionality
├── peerCashActionProvider.test.ts  # Test file for Peer Cash provider
├── schemas.ts                      # Action schemas
├── index.ts                        # Main exports
└── README.md                       # This file
```

## Actions

- `estimate`: Estimate the fiat amount a cash-out would deliver

  - Oracle market-rate estimate with zero spread
  - Optionally includes the historical median time to first fill
  - This is an estimate, not a locked quote; the binding rate resolves when a buyer fills

- `capabilities`: List payout platforms, currencies, payee format hints, and amount bounds

  - Optionally includes 30-day fill counts and median first-fill times per pair

- `cashout`: Create a cash-out order

  - Moves USDC from the wallet into the non-custodial Peer escrow contract
  - A buyer pays fiat to the payee handle and proves the payment to release the USDC
  - Supports a single currency or several currencies the buyer may choose between
  - Submits the required access policy transaction automatically for restricted platforms (Venmo, Cash App, PayPal)
  - Returns the **depositId**, the resume key for every later action

- `order_status`: Read the state of an order by deposit id

  - Lifecycle states: awaiting-buyer, matched, delivering, delivered, returned
  - Includes a plain-language explanation and the allowed next actions

- `list_orders`: List orders owned by a wallet

- `withdraw`: Withdraw USDC from an order back to the wallet

  - The single unwind verb: expired buyer intents are pruned automatically
  - Partial with an amount, or full close without

- `top_up`: Add USDC to a live order

- `configure_access_policy`: Recovery action for restricted cash-outs

  - Only needed when a cashout reports that the deposit was created but the access policy transaction failed

## Configuration

```typescript
import { peerCashActionProvider } from "@coinbase/agentkit";

const provider = peerCashActionProvider({
  environment: "production", // "production" (default) | "preproduction" | "staging"
  referralCode: "ABC123", // optional, earns the integration share
  referrer: "acme-app", // optional, analytics-only attribution
  rpcUrl: "https://mainnet.base.org", // optional Base RPC override
});
```

No API keys are required.

### Earning the integration share

`referralCode` is the six-character referral code from the Peer mobile or web app. When set, every deposit carries ERC-8021 attribution (`peer-ref-ABC123`) and the code owner earns 50 bps each time an order fills. The mapping is permanent. `referrer` is analytics-only attribution and carries no revenue share.

## Safety Notes

- **Non-custodial.** Funds move only between the user's wallet and the Peer escrow contract. Only the escrow holds funds, and only the maker can withdraw an unmatched deposit.
- **The wallet signs locally.** The SDK prepares unsigned transactions; this provider submits them through the AgentKit wallet provider. No keys or approvals leave the host.
- **An estimate is not a locked quote.** Orders fill at the live Chainlink oracle rate with zero spread. The rate binds when a buyer fills, not when the estimate is read.
- **Orders can take time to fill.** The `withdraw` action reclaims unfilled USDC at any time.
- Wise and PayPal payee handles must already be registered with Peer; registering a brand new handle for them requires an identity attestation this provider cannot produce.

## Network Support

The Peer Cash provider supports Base mainnet only. The `preproduction` and `staging` environments also settle on Base mainnet, using separate contracts and backend deployments.

## Adding New Actions

To add new Peer Cash actions:

1. Define your action schema in `schemas.ts`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema) for more information.
2. Implement the action in `peerCashActionProvider.ts`
3. Implement tests in `peerCashActionProvider.test.ts`

## Notes

- npm package: [@zkp2p/cash](https://www.npmjs.com/package/@zkp2p/cash)
- Documentation: [docs.peer.xyz/developer/peer-cash](https://docs.peer.xyz/developer/peer-cash)
- Integration prompt: [peer.xyz/cash-sdk](https://peer.xyz/cash-sdk)
- Support: [Peer Builders Club on Telegram](https://t.me/zk_p2p/167174)
