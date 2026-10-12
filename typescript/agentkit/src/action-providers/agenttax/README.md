# AgentTax Action Provider

This directory contains the **AgentTaxActionProvider** implementation, which exposes the [AgentTax](https://agenttax.io) tax-compliance API as AgentKit actions and ships a tax-compliant USDC remittance action on Base.

Every onchain transaction submitted through this provider carries the **AgentTax Base Builder Code** (`bc_626v2pr2`) in its calldata (ERC-8021), so the agent's tax-compliant activity attributes back to AgentTax for analytics and Base ecosystem rewards.

## Why

Agent-to-agent commerce on Base is growing fast, but every marketplace, micropayment service, and x402-powered API has the same unsolved problem: **who collects and remits sales tax on these transactions?**

AgentTax is the compliance layer for the agent economy. This action provider lets any AgentKit agent:

1. Calculate the correct US sales tax on a transaction (51-jurisdiction coverage, 105+ zip-level local rates)
2. Check nexus status across states
3. Export IRS Form 1099-DA data
4. Remit collected tax onchain as a USDC transfer on Base — with Builder Code attribution

## Directory Structure

```
agenttax/
├── agentTaxActionProvider.ts        # Main provider + 5 actions
├── agentTaxActionProvider.test.ts   # Unit tests
├── schemas.ts                        # Zod schemas + AgentTaxConfig
├── constants.ts                      # Builder Code suffix + USDC addresses
├── index.ts                          # Public exports
└── README.md                         # This file
```

## Configuration

```typescript
import { agentTaxActionProvider, AgentTaxConfig } from "@coinbase/agentkit";

const config: AgentTaxConfig = {
  // Optional. Public actions work without a key.
  // With a key, check_nexus_status and export_1099_da return real data
  // for the authenticated entity (instead of AgentTax demo data), and
  // remit_tax_onchain logs the remittance to the AgentTax audit trail.
  // Get a key at https://agenttax.io/dashboard
  apiKey: process.env.AGENTTAX_API_KEY,

  // Override for staging / self-hosted. Defaults to https://agenttax.io
  baseUrl: "https://agenttax.io",

  // Default treasury wallet for remit_tax_onchain when no recipient is supplied
  reserveWallet: "0xYourTreasuryWallet",

  // Whether to append the AgentTax Base Builder Code to onchain transactions.
  // Defaults to true. Disable only if you want to attribute elsewhere.
  builderCodeEnabled: true,
};

const provider = agentTaxActionProvider(config);
```

All config fields are optional. The provider also reads `AGENTTAX_API_KEY` from the environment when no explicit `apiKey` is passed.

## Actions

### `calculate_tax`

Calculates US sales tax for an agent transaction.

**Inputs**
- `amount` (number): Amount in whole USD (e.g. `10.5`)
- `buyerState` (string): Two-letter state code (e.g. `"TX"`)
- `buyerZip` (string, optional): 5- or 9-digit ZIP for zip-level precision
- `transactionType` (enum): one of
  `compute`, `api_access`, `data_purchase`, `saas`, `ai_labor`, `storage`,
  `digital_good`, `consulting`, `data_processing`, `cloud_infrastructure`,
  `ai_model_access`, `marketplace_fee`, `subscription`, `license`, `service`
- `counterpartyId` (string, **required**): Buyer identifier (wallet address, agent ID) for audit trail
- `isB2B` (boolean, optional): Defaults to `false`

**Example**
```typescript
await agent.run("calculate_tax", {
  amount: 10,
  buyerState: "TX",
  buyerZip: "77001",
  transactionType: "compute",
  counterpartyId: "agent_abc123",
});
```

### `get_local_rate`

Looks up the combined (state + local) sales tax rate for a ZIP code.

**Inputs**
- `zip` (string): 5- or 9-digit US ZIP code

**Example**
```typescript
await agent.run("get_local_rate", { zip: "77001" });
```

### `check_nexus_status`

Checks sales tax nexus status across one or more states.

Without an `apiKey`, returns AgentTax demo data. With an `apiKey`, returns nexus data for the authenticated entity.

**Inputs**
- `states` (string[]): States to check

**Example**
```typescript
await agent.run("check_nexus_status", { states: ["TX", "CA", "NY"] });
```

### `export_1099_da`

Exports IRS Form 1099-DA draft data for a given tax year. Without an `apiKey`, returns demo data. With an `apiKey`, returns real data for the authenticated entity.

**Inputs**
- `year` (number): Tax year (e.g. `2026`)

**Example**
```typescript
await agent.run("export_1099_da", { year: 2026 });
```

### `remit_tax_onchain`

Remits collected sales tax as a USDC transfer on Base. The transaction carries the AgentTax Base Builder Code in its calldata (ERC-8021). If `apiKey` is configured, the remittance is also logged to the AgentTax audit trail (best-effort — failures do not block the transfer).

**Supported networks:** `base-mainnet`, `base-sepolia`

**Inputs**
- `amountUsdc` (number): Amount of USDC to remit in whole units
- `recipient` (string, optional): Treasury wallet — defaults to `reserveWallet` from provider config
- `jurisdiction` (string, optional): Two-letter state code for the jurisdiction being remitted to
- `reference` (string, optional): External reference (e.g. AgentTax transaction ID) for audit trail

**Example**
```typescript
await agent.run("remit_tax_onchain", {
  amountUsdc: 2.5,
  jurisdiction: "TX",
  reference: "txn_abc123",
});
```

## Base Builder Code

This provider participates in the [Base Builder Codes](https://docs.base.org/base-chain/builder-codes/builder-codes) program. Every onchain transaction it submits appends the ERC-8021 suffix:

```
0x62635f36323676327072320b0080218021802180218021802180218021
```

Decoded: `bc_626v2pr2` (ascii) + length byte (`0x0b`) + ERC-8021 magic pattern.

Gas overhead: ~450 gas per transaction (16 gas per non-zero byte). Smart contracts ignore the suffix, so there is no behavioral impact on the transfer itself.

To disable attribution, set `builderCodeEnabled: false` in the provider config.

## End-to-End Example

```typescript
import { AgentKit, agentTaxActionProvider, erc20ActionProvider, walletActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    walletActionProvider(),
    erc20ActionProvider(),
    agentTaxActionProvider({
      apiKey: process.env.AGENTTAX_API_KEY,
      reserveWallet: "0xYourTreasuryWallet",
    }),
  ],
});

// Agent workflow:
// 1. calculate_tax for the current sale
// 2. collect payment from the buyer via erc20 transfer
// 3. remit_tax_onchain to treasury (Builder Code attached automatically)
```

## Links

- **AgentTax website:** https://agenttax.io
- **AgentTax dashboard:** https://agenttax.io/dashboard
- **AgentTax docs:** https://agenttax.io/docs
- **Base Builder Codes:** https://docs.base.org/base-chain/builder-codes/builder-codes
- **ERC-8021 spec:** https://eips.ethereum.org/EIPS/eip-8021
