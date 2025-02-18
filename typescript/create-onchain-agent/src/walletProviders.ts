

export type WalletProviderChoice = 'CDP' | 'Viem' | 'Privy' | 'SolanaKeypair'

export const WalletProviderChoices: WalletProviderChoice[] = ['CDP', 'Viem', 'Privy', 'SolanaKeypair']

type WalletProviderRouteConfiguration = {
    env: string[];
    apiRoute: string
}
export const WalletProviderRouteConfigurations: Record<WalletProviderChoice, WalletProviderRouteConfiguration> = {
    CDP: {
        env: ['NETWORK_ID', 'CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY'],
        apiRoute: 'agent/cdp/route.ts'
    },
    Viem: {
        env: ['NETWORK_ID', 'PRIVATE_KEY'],
        apiRoute: 'agent/viem/route.ts'
    },
    Privy: {
        env: ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'PRIVY_WALLET_ID', 'CHAIN_ID', 'PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY', 'PRIVY_WALLET_AUTHORIZATION_KEY_ID'],
        apiRoute: 'agent/privy/route.ts'
    },
    SolanaKeypair: {
        env: ['NETWORK_ID', 'SOLANA_RPC_URL', 'SOLANA_PRIVATE_KEY'],
        apiRoute: 'agent/solanaKeypair/route.ts'
    },
}