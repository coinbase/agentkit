export const GET_CROSS_CHAIN_ADDRESS_DESCRIPTION = `
This tool computes a cross chain address of a particular type using the derivation path, network, NEAR account id and the type of address, returning the result in hex string format.

The derived address is compatible with ECDSA and can be used to interact with contracts or perform transactions on the specified chain.

# Inputs:
- account_id (string and optional): The NEAR account id. Default is the wallet's default address.
- network_id (string and optional): The NEAR network, either near- mainnet or near - testnet. Default is "near - mainnet".
- path (string and optional): The derivation path. Default is "account - 1".
- address type (string): The type of address based on the target chain and type of address for networks like Bitcoin (e.g., "evm" or "bitcoin - mainnet - legacy").

# Output:
- Returns the ECDSA-compatible address (string) for the specific address type.
`;

export const GET_CROSS_CHAIN_PUBLIC_KEY_DESCRIPTION = `
This tool computes a public key using the chain signature key derivation function, a given derivation path, network and a NEAR account id, returning the result in hex string format. 

The resulted public key is the key the user can sign for via chain signatures and can be further converted into a valid ECDSA address for any supported chain.

# Inputs:
- account_id (string and optional): The NEAR account id. Default is the wallet's default address.
- network_id (string and optional): The NEAR network, either "near-mainnet" or "near-testnet". Default is "near-mainnet".
- path (string and optional): The derivation path. Default is "account-1".

# Output:
- Returns a public key (hex string) that can be converted into a valid ECDSA address for supported chains.
`;

export const SIGN_PAYLOAD_DESCRIPTION = `
This tool signs a payload using the derivation path and produces a signed transaction in hex string format.

The payload can represent transaction data or a message, which is signed using chain signatures.

# Inputs:
- network_id (string and optional): The NEAR network, either "near-mainnet" or "near-testnet". Default is "near-mainnet".
- path (string): The derivation path.
- payload (string): The transaction data or message to be signed.

# Output:
- Returns a signed transaction (hex string) that can be used on NEAR or other supported chains that include EVM Chains and Bitcoin.
`;