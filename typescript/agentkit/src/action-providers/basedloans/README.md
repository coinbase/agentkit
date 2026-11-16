# Based Loans Action Provider

This provider integrates [Based Loans](https://based.loans) into AgentKit. Based Loans is a fixed-term lending protocol on Base with no liquidations.

- **Borrowers** deposit a token as collateral and receive USDC right away. They can buy the collateral back at a fixed price any time before the due date. If they don't, they keep the USDC and the lenders receive the collateral. Price moves during the loan never sell the collateral early.
- **Lenders** deposit USDC and choose which tokens they lend against, with a USDC limit per token. They earn the buyback cost when borrowers repay, or the collateral when they don't.

The provider wraps the [`@basedloans/sdk`](https://www.npmjs.com/package/@basedloans/sdk) package. Every number is read live from Base mainnet, and contract addresses are read from the protocol at runtime. Write actions are signed by the agent's own wallet; the SDK never holds keys.

## Setup

No API key is needed. By default the SDK reads from Base's public RPC; pass your own for production use.

```typescript
import { AgentKit, basedLoansActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [basedLoansActionProvider({ rpcUrl: process.env.BASE_RPC_URL })],
});
```

## Actions

| Action | Description |
| --- | --- |
| `get_protocol_info` | Live loan fee, loan terms, buyback costs and size limits |
| `list_markets` | Tokens accepted as collateral, with price, max loan-to-value and USDC available |
| `get_risk_report` | A token's price sources, pool history and cost to move its price, with plain-language flags |
| `quote_borrow` | USDC received, fixed buyback cost and due date for a loan, without sending anything |
| `get_my_loans` | The wallet's loans with status, buyback remaining and due date |
| `get_my_lending` | The wallet's deposit, active loans, per-token limits and claimables |
| `request_token_listing` | Whether a token is accepted, and a link to request it if not |
| `borrow` | Deposit collateral and receive USDC (approves the token first if needed) |
| `buyback` | Pay USDC to get collateral back, in full or in part |
| `lend` | Deposit USDC to lend, optionally setting per-token limits |
| `set_lending_limits` | Add, change or remove per-token lending limits |
| `withdraw` | Withdraw USDC that is not in active loans |
| `claim_proceeds` | Claim repaid USDC from funded loans, or re-lend it |
| `claim_collateral` | Claim collateral from funded loans that passed their due date without a buyback |

Tokens can be passed by contract address (preferred) or symbol. Amounts are decimal strings in whole token units, e.g. `"0.5"` WETH or `"500"` USDC.

## Notes

- Supported network: `base-mainnet`.
- Agents should run `quote_borrow` and confirm the buyback cost and due date with the user before `borrow`, and run `get_risk_report` on each token before lending against it.
- `borrow` refuses loans the contracts would reject (for example below the minimum loan size) and explains why instead of sending a transaction.

## Links

- [Based Loans](https://based.loans)
- [Docs for AI agents](https://docs.based.loans/ai-agents)
- [SDK source](https://github.com/0xVarius/basedloans-agents)
