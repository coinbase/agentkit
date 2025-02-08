export interface FlippandoGameState {
    gameId: string
    board: number[]
    solvedBoard: number[]
    gameType: number
    gameTileType: number
    gameLevel: number
    gameTiles: number[]
  }
  
  export interface NFTMetadata {
    tokenId: number
    imageUrl: string
    attributes: Record<string, any>
  }
  
  export interface TokenSupplyData {
    chain: string
    supply: number
    timestamp: number
  }
  
  export interface FlippandoAgentConfig {
    chainIds: number[]
    providerUrl: string
    privateKey: string
    twitterEnabled: boolean
    gameAnalysisEnabled: boolean
    artSuggestionsEnabled: boolean
    arbitrageTrackingEnabled: boolean
  }
  
  export interface FlippandoMemory {
    gameStates: Map<string, FlippandoGameState>
    nftCache: Map<number, NFTMetadata>
    tokenSupplyHistory: TokenSupplyData[]
  }
  
  