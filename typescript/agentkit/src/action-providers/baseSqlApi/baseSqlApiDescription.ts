const apiSchema = [
  {
    tableName: "base.blocks",
    fields: [
      { fieldName: "block_number", type: "uint64", description: "The number of the block" },
      {
        fieldName: "block_hash",
        type: "String",
        description: "The unique hash identifying this block",
      },
      { fieldName: "parent_hash", type: "String", description: "The hash of the parent block" },
      {
        fieldName: "timestamp",
        type: "DateTime",
        description: "The timestamp when this block was created",
      },
      {
        fieldName: "miner",
        type: "String",
        description: "The address of the miner/validator who created this block",
      },
      { fieldName: "nonce", type: "uint64", description: "The proof-of-work nonce value" },
      {
        fieldName: "sha3_uncles",
        type: "String",
        description: "The hash of the uncles list for this block",
      },
      {
        fieldName: "transactions_root",
        type: "String",
        description: "The root hash of the transactions trie",
      },
      { fieldName: "state_root", type: "String", description: "The root hash of the state trie" },
      {
        fieldName: "receipts_root",
        type: "String",
        description: "The root hash of the receipts trie",
      },
      {
        fieldName: "logs_bloom",
        type: "String",
        description: "The bloom filter for the logs of the block",
      },
      {
        fieldName: "gas_limit",
        type: "uint64",
        description: "The maximum gas allowed in this block",
      },
      {
        fieldName: "gas_used",
        type: "uint64",
        description: "The total gas used by all transactions in this block",
      },
      {
        fieldName: "base_fee_per_gas",
        type: "uint64",
        description: "The base fee per gas in this block (EIP-1559)",
      },
      {
        fieldName: "total_difficulty",
        type: "String",
        description: "The total difficulty of the chain up to this block",
      },
      { fieldName: "size", type: "uint64", description: "The size of this block in bytes" },
      { fieldName: "extra_data", type: "String", description: "Extra data field for this block" },
      { fieldName: "mix_hash", type: "String", description: "The mix hash for this block" },
      {
        fieldName: "withdrawals_root",
        type: "String",
        description: "The root hash of withdrawals (post-merge)",
      },
      {
        fieldName: "parent_beacon_block_root",
        type: "String",
        description: "The parent beacon block root (post-merge)",
      },
      {
        fieldName: "blob_gas_used",
        type: "uint64",
        description: "The amount of blob gas used in this block",
      },
      {
        fieldName: "excess_blob_gas",
        type: "uint64",
        description: "The excess blob gas in this block",
      },
      {
        fieldName: "transaction_count",
        type: "uint64",
        description: "The number of transactions in this block",
      },
      {
        fieldName: "action",
        type: "Int8",
        description: "Indicates if block was added (1) or removed (-1) due to chain reorganization",
      },
    ],
  },
  {
    tableName: "base.events",
    fields: [
      { fieldName: "block_number", type: "uint64", description: "The block number" },
      {
        fieldName: "block_hash",
        type: "String",
        description: "Keccak-256 hash of the block header; verifies block contents",
      },
      {
        fieldName: "timestamp",
        type: "DateTime64",
        description: "Time at which the block was created",
      },
      {
        fieldName: "transaction_hash",
        type: "String",
        description: "Keccak-256 hash of the signed transaction; unique tx identifier",
      },
      {
        fieldName: "transaction_to",
        type: "String",
        description: "Address the transaction is acting against (EOA or contract)",
      },
      { fieldName: "transaction_from", type: "String", description: "Originating address (EOA)" },
      {
        fieldName: "transaction_index",
        type: "uint64",
        description: "Order of the transaction within the block",
      },
      {
        fieldName: "log_index",
        type: "uint64",
        description: "Index of the log within the transaction (0-based)",
      },
      {
        fieldName: "address",
        type: "String",
        description: "Contract address that created the log",
      },
      {
        fieldName: "topics",
        type: "Array(String)",
        description: "Indexed params and the keccak256 of the event signature",
      },
      { fieldName: "event_name", type: "String", description: "Human-readable event name" },
      {
        fieldName: "event_signature",
        type: "String",
        description: "Full canonical declaration (name + parameter types)",
      },
      {
        fieldName: "parameters",
        type: "Map(String, Variant(Bool, Int256, String, uint256))",
        description: "Parameter name -> value",
      },
      {
        fieldName: "parameter_types",
        type: "Map(String, String)",
        description: "Parameter name -> ABI type",
      },
      {
        fieldName: "action",
        type: "Int8",
        description: "1 if created; −1 if reorged out; sum > 0 means still active",
      },
    ],
  },
  {
    tableName: "base.transactions",
    fields: [
      {
        fieldName: "block_number",
        type: "uint64",
        description: "The number of the block that contains this transaction",
      },
      {
        fieldName: "block_hash",
        type: "String",
        description: "The hash of the block that contains this transaction",
      },
      {
        fieldName: "transaction_hash",
        type: "String",
        description: "The unique hash identifying this transaction",
      },
      {
        fieldName: "transaction_index",
        type: "uint64",
        description: "Index position within the block",
      },
      { fieldName: "from_address", type: "String", description: "Originating address" },
      { fieldName: "to_address", type: "String", description: "Destination address" },
      { fieldName: "value", type: "String", description: "Transferred value" },
      { fieldName: "gas", type: "uint64", description: "Gas limit" },
      { fieldName: "gas_price", type: "uint64", description: "Gas price (wei)" },
      { fieldName: "input", type: "String", description: "Data payload" },
      {
        fieldName: "nonce",
        type: "uint64",
        description: "Count of prior transactions from the sender",
      },
      { fieldName: "type", type: "uint64", description: "Transaction type" },
      {
        fieldName: "max_fee_per_gas",
        type: "uint64",
        description: "Max fee per gas the sender will pay",
      },
      {
        fieldName: "max_priority_fee_per_gas",
        type: "uint64",
        description: "Max priority fee per gas",
      },
      { fieldName: "chain_id", type: "uint64", description: "Chain ID" },
      { fieldName: "v", type: "String", description: "Signature v" },
      { fieldName: "r", type: "String", description: "Signature r" },
      { fieldName: "s", type: "String", description: "Signature s" },
      {
        fieldName: "is_system_tx",
        type: "Bool",
        description: "Whether this is a system transaction",
      },
      { fieldName: "max_fee_per_blob_gas", type: "String", description: "Max fee per blob gas" },
      {
        fieldName: "blob_versioned_hashes",
        type: "Array(String)",
        description: "Versioned hashes for associated blobs",
      },
      {
        fieldName: "timestamp",
        type: "DateTime64",
        description: "When the tx was included in a block",
      },
      { fieldName: "action", type: "Int8", description: "1 if added, −1 if removed due to reorg" },
    ],
  },
  {
    tableName: "base.encoded_logs",
    fields: [
      { fieldName: "block_number", type: "uint64", description: "Block number containing the log" },
      {
        fieldName: "block_hash",
        type: "String",
        description: "Hash of the block containing the log",
      },
      { fieldName: "block_timestamp", type: "DateTime64", description: "Timestamp of that block" },
      {
        fieldName: "transaction_hash",
        type: "String",
        description: "Hash of the transaction containing the log",
      },
      {
        fieldName: "transaction_to",
        type: "String",
        description: "Transaction recipient (EOA or contract)",
      },
      { fieldName: "transaction_from", type: "String", description: "Transaction sender (EOA)" },
      {
        fieldName: "log_index",
        type: "uint32",
        description: "Log index within the transaction (0-based)",
      },
      {
        fieldName: "address",
        type: "String",
        description: "Contract address that created the log",
      },
      {
        fieldName: "topics",
        type: "Array(String)",
        description: "Indexed params / signature hash",
      },
      {
        fieldName: "action",
        type: "Enum8('removed' = -1, 'added' = 1)",
        description: "1 = created; −1 = reorged out; sum > 0 means active",
      },
    ],
  },
  {
    tableName: "base.transfers",
    fields: [
      {
        fieldName: "block_number",
        type: "uint64",
        description: "Block number containing the transfer",
      },
      { fieldName: "block_timestamp", type: "DateTime64", description: "Block timestamp" },
      { fieldName: "transaction_to", type: "String", description: "Transaction recipient address" },
      { fieldName: "transaction_from", type: "String", description: "Transaction sender address" },
      { fieldName: "log_index", type: "uint32", description: "Log index within the transaction" },
      { fieldName: "token_address", type: "String", description: "Token contract address" },
      {
        fieldName: "from_address",
        type: "String",
        description: "Address tokens were transferred from",
      },
      {
        fieldName: "to_address",
        type: "String",
        description: "Address tokens were transferred to",
      },
      { fieldName: "value", type: "uint256", description: "Amount of tokens transferred" },
      { fieldName: "action", type: "Enum8", description: "Action flag: 1 add, −1 reorg removal" },
    ],
  },
];

const schemaJson = JSON.stringify(apiSchema, null, 2);

export const description = `
    This action can call Coinbase's Base SQL API to retrieve onchain data on Base.
    The SQL API schema is a set of opinionated tables and columns used to organize onchain data for efficient retrieval.

    The supported table names, and fields in each table, for SQL queries are defined in the json string:
    
    ${schemaJson}
`;
