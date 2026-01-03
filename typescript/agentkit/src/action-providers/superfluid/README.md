# Superfluid Action Provider

This directory contains the implementation for [Superfluid](https://docs.superfluid.org/), broken up by functionality:

### Superfluid Pool Action Provider
- Create pool
- Update member units

### Superfluid Stream Action Provider
- Create stream
- Update stream flow rate
- Close stream

### Superfluid Query Action Provider
- Query open streams

### Superfluid Super Token Creator Action Provider
- Creates a Super Token (a streamable token) wrapper for an existing ERC20

### Superfluid Wrapper Action Provider
- Wraps an existing ERC20 into its Super Token implementation

## Overview

The SuperfluidActionProvider is designed to work with EvmWalletProvider for blockchain interactions. It provides a set of actions that enable creating and editing a stream, creating and editing pools, creating a SuperToken wrapper around an existing ERC20, wrapping an ERC20 to a SuperToken, and querying SuperToken streams.

Most Superfluid contracts (with the exception of the Super Token Factory) are deployed at the same addresses across different chains.  Make sure to verify you are interacting with the right address on the right chain by viewing the [Superfluid Deployments](https://docs.superfluid.org/docs/protocol/contract-addresses).

Ensure the flow rate is accurately calculated in wei per second when creating or updating a stream.  See Superfluid's [flow rate docs](https://docs.superfluid.org/docs/protocol/money-streaming/overview#calculating-flow-rates) for more information.

## Directory Structure
```
superfluid/
├── superfluidActionProvider.ts                         # Main provider wrapper for implementations
├── superfluidPoolActionProvider.ts                     # Provider for pool actions
├── superfluidPoolActionProvider.test.ts                # Pool provider test suite
├── superfluidQueryActionProvider.ts                    # Provider for query actions
├── superfluidQueryActionProvider.test.ts               # Query provider test suite
├── superfluidStreamActionProvider.ts                   # Provider for stream actions
├── superfluidStreamActionProvider.test.ts              # Stream provider test suite
├── superfluidSuperTokenCreatorActionProvider.ts        # Provider for super token creation actions
├── superfluidSuperTokenCreatorActionProvider.test.ts   # Super token creator provider test suite
├── superfluidWrapperActionProvider.ts                  # Provider for wrapping actions
├── superfluidWrapperActionProvider.test.ts             # Wrapper provider test suite
├── schemas.ts                                          # Action schemas and types
├── index.ts                                            # Package exports
├── graphQueries/
│   ├── endpoints.ts                                    # URL endpoints for graphql
│   ├── queries.ts                                      # graphql query strings
│   ├── superfluidGraphQueries.ts                       # Helper functions to call graphql queries
│   └── types.ts                                        # Types used in graphql queries
├── utils/
│   ├── parseLogs.ts                                    # Helper functions to parse returned Superfluid logs
└── README.md                                           # Documentation (this file)
```

## Actions

### Example Action
- `create-stream`: Create Stream action implementation
  - **Purpose**: Creates a superfluid stream of an ERC20 Super token to a recipient at a flow rate
  - **Input**:
    - `erc20TokenAddress` (address): The ERC20 super token to stream
    - `recipientAddress` (address): The recipient of the stream
    - `flowRate` (number): The flow rate
  - **Output**: String describing the stream result with a hash to the transaction
  - **Example**:
    ```typescript
    const result = await provider.createStream(walletProvider, {
      erc20TokenAddress: "0x1234",
      recipientAddress: "0x5678",
      flowRate: 100,
    });
    ```

## Implementation Details

### Network Support
This provider supports Base Mainnet.

### Wallet Provider Integration
This provider is specifically designed to work with EvmWalletProvider. Key integration points:
- Network compatibility checks
- Transaction signing and execution
- Stream token creation
- Stream token wrapping

## Adding New Actions

To add new actions:

1. Define the schema in `schemas.ts`:
   ```typescript
   export const NewActionSchema = z.object({
     // Define your action's parameters
   });
   ```

2. Implement the action in `superfluidActionProvider.ts`:
   ```typescript
   @CreateAction({
     name: "new_action",
     description: "Description of what your action does",
     schema: NewActionSchema,
   })
   async newAction(walletProvider: EvmWalletProvider, args: z.infer<typeof NewActionSchema>): Promise<string> {
     // Implement your action logic
   }
   ```

## Testing

When implementing new actions, ensure to:
1. Add unit tests for schema validations
2. Test network support

#### Example

##### Create Super Token
```
Prompt: Can you create a super token for this erc20: 0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38

-------------------
0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40
Created super token for 0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38.  Super token address at 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40  Transaction hash: 0xa9ea729bcbe30e3bb8610f9adf91fc4f4162e4cda5c33273c1f0d830388492da
-------------------
The super token has been successfully created for the ERC20 address `0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38`. 

- **Super token address**: `0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40`
- **Transaction hash**: `0xa9ea729bcbe30e3bb8610f9adf91fc4f4162e4cda5c33273c1f0d830388492da`

Let me know if you need further assistance!
-------------------
```

##### Wrap Super Token
```
Prompt: Can you wrap 1000 of this erc20 0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38 into this super token 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40 on base mainnet

-------------------
Wallet Details:
- Provider: cdp_evm_wallet_provider
- Address: 0x77841ee4399EFfc9b515c09cf239D784392F897F
- Network:
  * Protocol Family: evm
  * Network ID: base-mainnet
  * Chain ID: 8453
- Native Balance: 37507762138705 WEI
-------------------

-------------------
Wrapped 1000 of token 0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38 as a SuperToken.  Transaction hash: 0xd073bb4a85cbc79dc55f9996c500d141a257ccc2e173cce8f09017ec53b7cce6
-------------------
Successfully wrapped 1000 of the ERC20 token (0xe8E55A847Bb446d967ef92F4580162fb8f2d3F38) into the Super token. 

Transaction hash: **0xd073bb4a85cbc79dc55f9996c500d141a257ccc2e173cce8f09017ec53b7cce6**. 

If you have any more requests or questions, feel free to ask!
-------------------
```

##### Create Stream
```
Prompt: Can you create a superfluid stream of the super token 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40 at a rate of 100 to address 0x8F4359D1C2166452b5e7a02742D6fe9ca5448FDe

-------------------
Created stream of token 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40 to 0x8F4359D1C2166452b5e7a02742D6fe9ca5448FDe at a rate of 100. The link to the stream is https://app.superfluid.finance/stream/base-mainnet/0x77841ee4399EFfc9b515c09cf239D784392F897F-0x8F4359D1C2166452b5e7a02742D6fe9ca5448FDe-0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40.  Transaction hash: 0xe108156834b91a52ab431e92095e171c93800d02f590271c5364eac26561dda3
-------------------
The Superfluid stream has been successfully created! You are streaming the SuperToken (0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40) at a rate of 100 to the address **0x8F4359D1C2166452b5e7a02742D6fe9ca5448FDe**.

Here is the transaction hash for your reference: **0xe108156834b91a52ab431e92095e171c93800d02f590271c5364eac26561dda3**.

You can view the stream details using the following link: [View Stream](https://app.superfluid.finance/stream/base-mainnet/0x77841ee4399EFfc9b515c09cf239D784392F897F-0x8F4359D1C2166452b5e7a02742D6fe9ca5448FDe-0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40).
-------------------
```

##### Pools
```
Prompt: Can you create a pool of the token 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40

-------------------
Created pool of token 0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40 at 0x8651059749637291C4175d539d4eA62340aFBcAD.  Transaction hash: 0x0b717b24504452ebf18a3f707b882f247a25cff1d7302d21f71916f21b9379a5
-------------------
The pool for the token **0x2D92C37A341f9C7AE0438179ee2835B9Bb692e40** has been created successfully. 

- **Pool Address:** 0x8651059749637291C4175d539d4eA62340aFBcAD
- **Transaction Hash:** [0x0b717b24504452ebf18a3f707b882f247a25cff1d7302d21f71916f21b9379a5](https://etherscan.io/tx/0x0b717b24504452ebf18a3f707b882f247a25cff1d7302d21f71916f21b9379a5)

If you need any further assistance, feel free to ask!
-------------------
```