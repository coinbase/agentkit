# NEAR Action Provider

The NEAR action provider adds NEP-141 token and contract-call actions to a
`NearWalletProvider`:

- `get_nep141_balance` reads and formats a fungible-token balance.
- `transfer_nep141` transfers whole token units after checking the wallet balance.
- `call_contract` invokes a state-changing contract method with explicit gas and deposit.

Native NEAR balance and transfer are supplied by AgentKit's standard
`walletActionProvider`.

```ts
import {
  AgentKit,
  NearWalletProvider,
  NEAR_TESTNET_NETWORK_ID,
  nearActionProvider,
  walletActionProvider,
  x402ActionProvider,
} from "@coinbase/agentkit";

const walletProvider = new NearWalletProvider({
  accountId: process.env.NEAR_ACCOUNT_ID!,
  secretKey: process.env.NEAR_PRIVATE_KEY as `ed25519:${string}`,
  networkId: NEAR_TESTNET_NETWORK_ID,
});

const agent = await AgentKit.from({
  walletProvider,
  actionProviders: [
    walletActionProvider(),
    nearActionProvider(),
    x402ActionProvider({ registeredServices: ["https://example.com"] }),
  ],
});
```

`NearWalletProvider` also implements `ClientNearSigner` from `@x402/near`.
AgentKit's x402 provider detects it automatically and registers the NEAR exact
scheme. NEAR x402 payments are NEP-366 delegate actions: the payer signs the
token transfer while the facilitator, such as Solvador, relays it and sponsors
gas.

The configured key must be a full-access key. Keep it in a secret manager and
never expose it to a browser or model context.
