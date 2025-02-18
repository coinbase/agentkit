

export type WalletOption = 'CDP' | 'Viem' | 'Privy' | 'SolanaKeypair'

export const WalletOptions: WalletOption[] = ['CDP', 'Viem', 'Privy', 'SolanaKeypair']

type WalletProviderConfiguration = {
    env: string[];
    apiRoute: string
}

export const WalletOptionsLookup: Record<WalletOption, WalletProviderConfiguration> = {
    CDP: {
        env: ['CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY'],
        apiRoute: 'agent/cdp/route.ts'
    },
    Viem: {
        env: ['PRIVATE_KEY'],
        apiRoute: 'agent/viem/route.ts'
    },
    Privy: {
        env: [],
        apiRoute: 'agent/privy/route.ts'
    },
    SolanaKeypair: {
        env: ['SOLANA_RPC_URL', 'SOLANA_PRIVATE_KEY'],
        apiRoute: 'agent/solanaKeypair/route.ts'
    },
}