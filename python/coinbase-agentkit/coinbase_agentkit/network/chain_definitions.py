from pydantic import BaseModel


class NativeCurrency(BaseModel):
    """Represents the native currency for a blockchain network."""

    name: str
    symbol: str
    decimals: int


class RpcUrls(BaseModel):
    """Represents the RPC URLs for a blockchain network."""

    http: list[str]


class BlockExplorer(BaseModel):
    """Represents a block explorer for a blockchain network."""

    name: str
    url: str
    api_url: str


class Contract(BaseModel):
    """Represents a contract on a blockchain network."""

    address: str
    block_created: int | None = None


class Chain(BaseModel):
    """Represents a blockchain network."""

    id: str
    name: str
    network: str | None = None
    native_currency: NativeCurrency
    rpc_urls: dict[str, RpcUrls]
    block_explorers: dict[str, BlockExplorer]
    contracts: dict[str, Contract]
    testnet: bool | None = False


# Convert existing dictionaries to Chain instances
mainnet = Chain(
    id="1",
    name="Ethereum",
    native_currency={"name": "Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://eth.merkle.io"],
        },
    },
    block_explorers={
        "default": {
            "name": "Etherscan",
            "url": "https://etherscan.io",
            "api_url": "https://api.etherscan.io/api",
        },
    },
    contracts={
        "ens_registry": {
            "address": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        },
        "ens_universal_resolver": {
            "address": "0xce01f8eee7E479C928F8919abD53E553a36CeF67",
            "block_created": 19_258_213,
        },
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 14_353_601,
        },
    },
)

sepolia = Chain(
    id="11155111",
    name="Sepolia",
    native_currency={"name": "Sepolia Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://sepolia.drpc.org"],
        },
    },
    block_explorers={
        "default": {
            "name": "Etherscan",
            "url": "https://sepolia.etherscan.io",
            "api_url": "https://api-sepolia.etherscan.io/api",
        },
    },
    contracts={
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 751532,
        },
        "ens_registry": {"address": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"},
        "ens_universal_resolver": {
            "address": "0xc8Af999e38273D658BE1b921b88A9Ddf005769cC",
            "block_created": 5_317_080,
        },
    },
    testnet=True,
)

base_sepolia = Chain(
    id="84532",
    network="base-sepolia",
    name="Base Sepolia",
    native_currency={"name": "Sepolia Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://sepolia.base.org"],
        },
    },
    block_explorers={
        "default": {
            "name": "Basescan",
            "url": "https://sepolia.basescan.org",
            "api_url": "https://api-sepolia.basescan.org/api",
        },
    },
    contracts={
        "dispute_game_factory": {
            "address": "0xd6E6dBf4F7EA0ac412fD8b65ED297e64BB7a06E1",
        },
        "l2_output_oracle": {
            "address": "0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254",
        },
        "portal": {
            "address": "0x49f53e41452c74589e85ca1677426ba426459e85",
            "block_created": 4446677,
        },
        "l1_standard_bridge": {
            "address": "0xfd0Bf71F60660E2f608ed56e1659C450eB113120",
            "block_created": 4446677,
        },
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 1059647,
        },
    },
    testnet=True,
)

arbitrum_sepolia = Chain(
    id="421614",
    name="Arbitrum Sepolia",
    native_currency={
        "name": "Arbitrum Sepolia Ether",
        "symbol": "ETH",
        "decimals": 18,
    },
    rpc_urls={
        "default": {
            "http": ["https://sepolia-rollup.arbitrum.io/rpc"],
        },
    },
    block_explorers={
        "default": {
            "name": "Arbiscan",
            "url": "https://sepolia.arbiscan.io",
            "api_url": "https://api-sepolia.arbiscan.io/api",
        },
    },
    contracts={
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 81930,
        },
    },
    testnet=True,
)

optimism_sepolia = Chain(
    id="11155420",
    name="OP Sepolia",
    native_currency={"name": "Sepolia Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://sepolia.optimism.io"],
        },
    },
    block_explorers={
        "default": {
            "name": "Blockscout",
            "url": "https://optimism-sepolia.blockscout.com",
            "api_url": "https://optimism-sepolia.blockscout.com/api",
        },
    },
    contracts={
        "dispute_game_factory": {
            "address": "0x05F9613aDB30026FFd634f38e5C4dFd30a197Fa1",
        },
        "l2_output_oracle": {
            "address": "0x90E9c4f8a994a250F6aEfd61CAFb4F2e895D458F",
        },
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 1620204,
        },
        "portal": {
            "address": "0x16Fc5058F25648194471939df75CF27A2fdC48BC",
        },
        "l1_standard_bridge": {
            "address": "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1",
        },
    },
    testnet=True,
)

base = Chain(
    id="8453",
    name="Base",
    native_currency={"name": "Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://mainnet.base.org"],
        },
    },
    block_explorers={
        "default": {
            "name": "Basescan",
            "url": "https://basescan.org",
            "api_url": "https://api.basescan.org/api",
        },
    },
    contracts={
        "dispute_game_factory": {
            "address": "0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e",
        },
        "l2_output_oracle": {
            "address": "0x56315b90c40730925ec5485cf004d835058518A0",
        },
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 5022,
        },
        "portal": {
            "address": "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e",
            "block_created": 17482143,
        },
        "l1_standard_bridge": {
            "address": "0x3154Cf16ccdb4C6d922629664174b904d80F2C35",
            "block_created": 17482143,
        },
    },
)

arbitrum = Chain(
    id="42161",
    name="Arbitrum One",
    native_currency={"name": "Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://arb1.arbitrum.io/rpc"],
        },
    },
    block_explorers={
        "default": {
            "name": "Arbiscan",
            "url": "https://arbiscan.io",
            "api_url": "https://api.arbiscan.io/api",
        },
    },
    contracts={
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 7654707,
        },
    },
)

optimism = Chain(
    id="10",
    name="OP Mainnet",
    native_currency={"name": "Ether", "symbol": "ETH", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://mainnet.optimism.io"],
        },
    },
    block_explorers={
        "default": {
            "name": "Optimism Explorer",
            "url": "https://optimistic.etherscan.io",
            "api_url": "https://api-optimistic.etherscan.io/api",
        },
    },
    contracts={
        "dispute_game_factory": {
            "address": "0xe5965Ab5962eDc7477C8520243A95517CD252fA9",
        },
        "l2_output_oracle": {
            "address": "0xdfe97868233d1aa22e815a266982f2cf17685a27",
        },
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 4286263,
        },
        "portal": {
            "address": "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed",
        },
        "l1_standard_bridge": {
            "address": "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1",
        },
    },
)

polygon_mumbai = Chain(
    id="80001",
    name="Polygon Mumbai",
    native_currency={"name": "MATIC", "symbol": "MATIC", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://rpc.ankr.com/polygon_mumbai"],
        },
    },
    block_explorers={
        "default": {
            "name": "PolygonScan",
            "url": "https://mumbai.polygonscan.com",
            "api_url": "https://api-testnet.polygonscan.com/api",
        },
    },
    contracts={
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 25770160,
        },
    },
    testnet=True,
)

polygon = Chain(
    id="137",
    name="Polygon",
    native_currency={"name": "POL", "symbol": "POL", "decimals": 18},
    rpc_urls={
        "default": {
            "http": ["https://polygon-rpc.com"],
        },
    },
    block_explorers={
        "default": {
            "name": "PolygonScan",
            "url": "https://polygonscan.com",
            "api_url": "https://api.polygonscan.com/api",
        },
    },
    contracts={
        "multicall3": {
            "address": "0xca11bde05977b3631167028862be2a173976ca11",
            "block_created": 25770160,
        },
    },
)
