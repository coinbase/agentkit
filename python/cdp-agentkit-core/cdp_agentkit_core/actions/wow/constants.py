WOW_FACTORY_ABI = [
    {
        "type": "constructor",
        "inputs": [
            {"name": "_tokenImplementation", "type": "address", "internalType": "address"},
            {"name": "_bondingCurve", "type": "address", "internalType": "address"},
        ],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "UPGRADE_INTERFACE_VERSION",
        "inputs": [],
        "outputs": [{"name": "", "type": "string", "internalType": "string"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "bondingCurve",
        "inputs": [],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "deploy",
        "inputs": [
            {"name": "_tokenCreator", "type": "address", "internalType": "address"},
            {"name": "_platformReferrer", "type": "address", "internalType": "address"},
            {"name": "_tokenURI", "type": "string", "internalType": "string"},
            {"name": "_name", "type": "string", "internalType": "string"},
            {"name": "_symbol", "type": "string", "internalType": "string"},
        ],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "payable",
    },
    {
        "type": "function",
        "name": "implementation",
        "inputs": [],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "initialize",
        "inputs": [{"name": "_owner", "type": "address", "internalType": "address"}],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "proxiableUUID",
        "inputs": [],
        "outputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "tokenImplementation",
        "inputs": [],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [{"name": "newOwner", "type": "address", "internalType": "address"}],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "upgradeToAndCall",
        "inputs": [
            {"name": "newImplementation", "type": "address", "internalType": "address"},
            {"name": "data", "type": "bytes", "internalType": "bytes"},
        ],
        "outputs": [],
        "stateMutability": "payable",
    },
    {
        "type": "event",
        "name": "Initialized",
        "inputs": [
            {"name": "version", "type": "uint64", "indexed": False, "internalType": "uint64"}
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": True,
                "internalType": "address",
            },
            {"name": "newOwner", "type": "address", "indexed": True, "internalType": "address"},
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "Upgraded",
        "inputs": [
            {
                "name": "implementation",
                "type": "address",
                "indexed": True,
                "internalType": "address",
            }
        ],
        "anonymous": False,
    },
    {
        "type": "error",
        "name": "AddressEmptyCode",
        "inputs": [{"name": "target", "type": "address", "internalType": "address"}],
    },
    {"type": "error", "name": "ERC1167FailedCreateClone", "inputs": []},
    {
        "type": "error",
        "name": "ERC1967InvalidImplementation",
        "inputs": [{"name": "implementation", "type": "address", "internalType": "address"}],
    },
    {"type": "error", "name": "ERC1967NonPayable", "inputs": []},
    {"type": "error", "name": "FailedInnerCall", "inputs": []},
    {"type": "error", "name": "InvalidInitialization", "inputs": []},
    {"type": "error", "name": "NotInitializing", "inputs": []},
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [{"name": "owner", "type": "address", "internalType": "address"}],
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [{"name": "account", "type": "address", "internalType": "address"}],
    },
    {"type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": []},
    {"type": "error", "name": "UUPSUnauthorizedCallContext", "inputs": []},
    {
        "type": "error",
        "name": "UUPSUnsupportedProxiableUUID",
        "inputs": [{"name": "slot", "type": "bytes32", "internalType": "bytes32"}],
    },
]

WOW_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_protocolFeeRecipient", "type": "address"},
            {"internalType": "address", "name": "_protocolRewards", "type": "address"},
            {"internalType": "address", "name": "_weth", "type": "address"},
            {"internalType": "address", "name": "_nonfungiblePositionManager", "type": "address"},
            {"internalType": "address", "name": "_swapRouter", "type": "address"},
        ],
        "stateMutability": "nonpayable",
        "type": "constructor",
    },
    {
        "inputs": [{"internalType": "address", "name": "target", "type": "address"}],
        "name": "AddressEmptyCode",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "AddressInsufficientBalance",
        "type": "error",
    },
    {"inputs": [], "name": "AddressZero", "type": "error"},
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "allowance", "type": "uint256"},
            {"internalType": "uint256", "name": "needed", "type": "uint256"},
        ],
        "name": "ERC20InsufficientAllowance",
        "type": "error",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "sender", "type": "address"},
            {"internalType": "uint256", "name": "balance", "type": "uint256"},
            {"internalType": "uint256", "name": "needed", "type": "uint256"},
        ],
        "name": "ERC20InsufficientBalance",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "address", "name": "approver", "type": "address"}],
        "name": "ERC20InvalidApprover",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "address", "name": "receiver", "type": "address"}],
        "name": "ERC20InvalidReceiver",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "address", "name": "sender", "type": "address"}],
        "name": "ERC20InvalidSender",
        "type": "error",
    },
    {
        "inputs": [{"internalType": "address", "name": "spender", "type": "address"}],
        "name": "ERC20InvalidSpender",
        "type": "error",
    },
    {"inputs": [], "name": "EthAmountTooSmall", "type": "error"},
    {"inputs": [], "name": "EthTransferFailed", "type": "error"},
    {"inputs": [], "name": "FailedInnerCall", "type": "error"},
    {"inputs": [], "name": "InitialOrderSizeTooLarge", "type": "error"},
    {"inputs": [], "name": "InsufficientFunds", "type": "error"},
    {"inputs": [], "name": "InsufficientLiquidity", "type": "error"},
    {"inputs": [], "name": "InvalidInitialization", "type": "error"},
    {"inputs": [], "name": "InvalidMarketType", "type": "error"},
    {"inputs": [], "name": "MarketAlreadyGraduated", "type": "error"},
    {"inputs": [], "name": "MarketNotGraduated", "type": "error"},
    {"inputs": [], "name": "NotInitializing", "type": "error"},
    {"inputs": [], "name": "OnlyPool", "type": "error"},
    {"inputs": [], "name": "OnlyWeth", "type": "error"},
    {"inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error"},
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "SafeERC20FailedOperation",
        "type": "error",
    },
    {"inputs": [], "name": "SlippageBoundsExceeded", "type": "error"},
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "owner", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "spender", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "value", "type": "uint256"},
        ],
        "name": "Approval",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": False, "internalType": "uint64", "name": "version", "type": "uint64"}
        ],
        "name": "Initialized",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "from", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "to", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "value", "type": "uint256"},
        ],
        "name": "Transfer",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "tokenAddress", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "poolAddress", "type": "address"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "totalEthLiquidity",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "totalTokenLiquidity",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "lpPositionId",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "enum IWow.MarketType",
                "name": "marketType",
                "type": "uint8",
            },
        ],
        "name": "WowMarketGraduated",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "buyer", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "recipient", "type": "address"},
            {
                "indexed": True,
                "internalType": "address",
                "name": "orderReferrer",
                "type": "address",
            },
            {"indexed": False, "internalType": "uint256", "name": "totalEth", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "ethFee", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "ethSold", "type": "uint256"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "tokensBought",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "buyerTokenBalance",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "string", "name": "comment", "type": "string"},
            {
                "indexed": False,
                "internalType": "enum IWow.MarketType",
                "name": "marketType",
                "type": "uint8",
            },
        ],
        "name": "WowTokenBuy",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": True,
                "internalType": "address",
                "name": "factoryAddress",
                "type": "address",
            },
            {"indexed": True, "internalType": "address", "name": "tokenCreator", "type": "address"},
            {
                "indexed": False,
                "internalType": "address",
                "name": "platformReferrer",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "address",
                "name": "protocolFeeRecipient",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "address",
                "name": "bondingCurve",
                "type": "address",
            },
            {"indexed": False, "internalType": "string", "name": "tokenURI", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "name", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "symbol", "type": "string"},
            {
                "indexed": False,
                "internalType": "address",
                "name": "tokenAddress",
                "type": "address",
            },
            {"indexed": False, "internalType": "address", "name": "poolAddress", "type": "address"},
        ],
        "name": "WowTokenCreated",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "tokenCreator", "type": "address"},
            {
                "indexed": True,
                "internalType": "address",
                "name": "platformReferrer",
                "type": "address",
            },
            {
                "indexed": True,
                "internalType": "address",
                "name": "orderReferrer",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "address",
                "name": "protocolFeeRecipient",
                "type": "address",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "tokenCreatorFee",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "platformReferrerFee",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "orderReferrerFee",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "uint256", "name": "protocolFee", "type": "uint256"},
        ],
        "name": "WowTokenFees",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "seller", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "recipient", "type": "address"},
            {
                "indexed": True,
                "internalType": "address",
                "name": "orderReferrer",
                "type": "address",
            },
            {"indexed": False, "internalType": "uint256", "name": "totalEth", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "ethFee", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "ethBought", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "tokensSold", "type": "uint256"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "sellerTokenBalance",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "string", "name": "comment", "type": "string"},
            {
                "indexed": False,
                "internalType": "enum IWow.MarketType",
                "name": "marketType",
                "type": "uint8",
            },
        ],
        "name": "WowTokenSell",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "from", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "to", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "fromTokenBalance",
                "type": "uint256",
            },
            {
                "indexed": False,
                "internalType": "uint256",
                "name": "toTokenBalance",
                "type": "uint256",
            },
            {"indexed": False, "internalType": "uint256", "name": "totalSupply", "type": "uint256"},
        ],
        "name": "WowTokenTransfer",
        "type": "event",
    },
    {
        "inputs": [],
        "name": "MAX_TOTAL_SUPPLY",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "MIN_ORDER_SIZE",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "ORDER_REFERRER_FEE_BPS",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "PLATFORM_REFERRER_FEE_BPS",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "PROTOCOL_FEE_BPS",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "TOKEN_CREATOR_FEE_BPS",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "TOTAL_FEE_BPS",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "WETH",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "address", "name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "bondingCurve",
        "outputs": [{"internalType": "contract BondingCurve", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokensToBurn", "type": "uint256"}],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "address", "name": "refundRecipient", "type": "address"},
            {"internalType": "address", "name": "orderReferrer", "type": "address"},
            {"internalType": "string", "name": "comment", "type": "string"},
            {"internalType": "enum IWow.MarketType", "name": "expectedMarketType", "type": "uint8"},
            {"internalType": "uint256", "name": "minOrderSize", "type": "uint256"},
            {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"},
        ],
        "name": "buy",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "currentExchangeRate",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "ethOrderSize", "type": "uint256"}],
        "name": "getEthBuyQuote",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "ethOrderSize", "type": "uint256"}],
        "name": "getEthSellQuote",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenOrderSize", "type": "uint256"}],
        "name": "getTokenBuyQuote",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenOrderSize", "type": "uint256"}],
        "name": "getTokenSellQuote",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "_tokenCreator", "type": "address"},
            {"internalType": "address", "name": "_platformReferrer", "type": "address"},
            {"internalType": "address", "name": "_bondingCurve", "type": "address"},
            {"internalType": "string", "name": "_tokenURI", "type": "string"},
            {"internalType": "string", "name": "_name", "type": "string"},
            {"internalType": "string", "name": "_symbol", "type": "string"},
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "marketType",
        "outputs": [{"internalType": "enum IWow.MarketType", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "nonfungiblePositionManager",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "bytes", "name": "", "type": "bytes"},
        ],
        "name": "onERC721Received",
        "outputs": [{"internalType": "bytes4", "name": "", "type": "bytes4"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "platformReferrer",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "poolAddress",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "protocolFeeRecipient",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "protocolRewards",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "tokensToSell", "type": "uint256"},
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "address", "name": "orderReferrer", "type": "address"},
            {"internalType": "string", "name": "comment", "type": "string"},
            {"internalType": "enum IWow.MarketType", "name": "expectedMarketType", "type": "uint8"},
            {"internalType": "uint256", "name": "minPayoutSize", "type": "uint256"},
            {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"},
        ],
        "name": "sell",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "state",
        "outputs": [
            {
                "components": [
                    {"internalType": "enum IWow.MarketType", "name": "marketType", "type": "uint8"},
                    {"internalType": "address", "name": "marketAddress", "type": "address"},
                ],
                "internalType": "struct IWow.MarketState",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "swapRouter",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "tokenCreator",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "from", "type": "address"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "value", "type": "uint256"},
        ],
        "name": "transferFrom",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "int256", "name": "amount0Delta", "type": "int256"},
            {"internalType": "int256", "name": "amount1Delta", "type": "int256"},
            {"internalType": "bytes", "name": "", "type": "bytes"},
        ],
        "name": "uniswapV3SwapCallback",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {"stateMutability": "payable", "type": "receive"},
]

WOW_FACTORY_CONTRACT_ADDRESSES = {
    "base-sepolia": "0x04870e22fa217Cb16aa00501D7D5253B8838C1eA",
    "base-mainnet": "0x997020E5F59cCB79C74D527Be492Cc610CB9fA2B",
}

addresses = {
    "base-sepolia": {
        "WowFactory": "0xB09c0b1b18369Ef62e896D5a49Af8d65EFa0A404",
        "WowFactoryImpl": "0xB522291f22FE7FA45D56797F7A685D5c637Edc32",
        "Wow": "0x15ba66e376856F3F6FE53dE9eeAb10dEF10E8C92",
        "BondingCurve": "0xCE00c75B9807A2aA87B2297cA7Dc1C0190137D6F",
        "NonfungiblePositionManager": "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
        "SwapRouter02": "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
        "WETH": "0x4200000000000000000000000000000000000006",
        "UniswapQuoter": "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
    },
    "base-mainnet": {
        "WowFactory": "0xA06262157905913f855573f53AD48DE2D4ba1F4A",
        "WowFactoryImpl": "0xe4c17055048aEe01D0d122804816fEe5E6ac4A67",
        "Wow": "0x293997C6a1f2A1cA3aB971f548c4D95585E46282",
        "BondingCurve": "0x264ece5D58A576cc775B719bf182F2946076bE78",
        "NonfungiblePositionManager": "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
        "SwapRouter02": "0x2626664c2603336E57B271c5C0b26F421741e481",
        "WETH": "0x4200000000000000000000000000000000000006",
        "UniswapQuoter": "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    },
}


def get_factory_address(network: str) -> str:
    """Get the Zora Wow ERC20 Factory contract address for the specified network.

    Args:
        network (str): The network ID to get the contract address for.
            Valid networks are: base-sepolia, base-mainnet.

    Returns:
        str: The contract address for the specified network.

    Raises:
        ValueError: If the specified network is not supported.

    """
    network = network.lower()
    if network not in WOW_FACTORY_CONTRACT_ADDRESSES:
        raise ValueError(
            f"Invalid network: {network}. Valid networks are: {', '.join(WOW_FACTORY_CONTRACT_ADDRESSES.keys())}"
        )
    return WOW_FACTORY_CONTRACT_ADDRESSES[network]


GENERIC_TOKEN_METADATA_URI = "ipfs://QmY1GqprFYvojCcUEKgqHeDj9uhZD9jmYGrQTfA9vAE78J"
