import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { GetAvailableNftsAction } from "./get-available-nfts"
import { GetFlipMetadataAction } from "./get-flip-metadata"

const MAKE_ART_SUGGESTIONS_PROMPT = `
This action suggests potential art combinations based on the available NFTs for a player.
It retrieves available NFTs, groups them by tile type, and generates suggestions for new art pieces.
`

export const MakeArtSuggestionsSchema = z.object({
  playerAddress: z.string().describe("The Ethereum address of the player"),
})

const ArtMetadataSchema = z.object({
  width: z.number().int().min(2).max(8),
  height: z.number().int().min(2).max(8),
  tileTypes: z.array(z.number().int().min(1).max(7)),
  boards: z.array(z.array(z.array(z.number().int().min(0)))),
})

export const MakeArtSuggestionsResponseSchema = z.object({
  suggestions: z.array(ArtMetadataSchema),
  message: z.string(),
})

const tileTypeMap: { [key: string]: number } = {
  "1": 1, // squareTile
  "2": 2, // greyGradient
  "3": 3, // redGradient
  "4": 4, // greenGradient
  "5": 5, // blueGradient
  "6": 6, // diceTile
  "7": 7, // hexagramTile
}

function groupNftsByTileType(nfts: Array<{ tokenId: string; metadata: any }>): { [key: string]: Array<any> } {
  const grouped: { [key: string]: Array<any> } = {}
  for (const nft of nfts) {
    const tileType = nft.metadata.game_tile_type
    if (!grouped[tileType]) {
      grouped[tileType] = []
    }
    grouped[tileType].push(nft)
  }
  console.log("Grouped NFTs:", JSON.stringify(grouped, null, 2))
  return grouped
}

function generateArtSuggestions(groupedNfts: { [key: string]: Array<any> }): z.infer<typeof ArtMetadataSchema>[] {
  const suggestions: z.infer<typeof ArtMetadataSchema>[] = []
  const totalNfts = Object.values(groupedNfts).reduce((sum, group) => sum + group.length, 0)

  if (totalNfts < 4) {
    return [] // Not enough NFTs to create art
  }

  // Determine the maximum possible size
  const maxSize = Math.min(8, Math.floor(Math.sqrt(totalNfts)))

  // Generate suggestions
  for (let size = 2; size <= maxSize; size++) {
    if (size * size > totalNfts) break

    const suggestion: z.infer<typeof ArtMetadataSchema> = {
      width: size,
      height: size,
      tileTypes: [],
      boards: [[]],
    }

    let availableTileTypes = Object.keys(groupedNfts).filter((type) => groupedNfts[type].length > 0)
    let nftsUsed = 0

    for (let i = 0; i < size * size; i++) {
      if (availableTileTypes.length === 0) {
        // If we've run out of available types, break the loop
        break
      }

      const tileTypeIndex = i % availableTileTypes.length
      const tileType = availableTileTypes[tileTypeIndex]
      const nft = groupedNfts[tileType][0]

      const tileTypeNumber = tileTypeMap[tileType]
      if (tileTypeNumber === undefined) {
        console.error(`Unknown tile type: ${tileType}`)
        continue
      }

      suggestion.tileTypes.push(tileTypeNumber)
      suggestion.boards[0].push(JSON.parse(nft.metadata.game_solved_board))

      // Remove the used NFT from the group
      groupedNfts[tileType] = groupedNfts[tileType].slice(1)
      nftsUsed++

      // If we've used all NFTs of this type, remove it from available types
      if (groupedNfts[tileType].length === 0) {
        availableTileTypes = availableTileTypes.filter((type) => type !== tileType)
      }
    }

    // Only add the suggestion if it has valid tileTypes and we've used all slots
    if (suggestion.tileTypes.length === size * size) {
      suggestions.push(suggestion)
    }

    // Break if we've used all NFTs
    if (nftsUsed === totalNfts) break
  }

  return suggestions
}

export async function makeArtSuggestions(
  args: z.infer<typeof MakeArtSuggestionsSchema>,
  agentkit: FlippandoAgentkit,
): Promise<z.infer<typeof MakeArtSuggestionsResponseSchema>> {
  try {
    // Step 1: Get available NFTs
    const getAvailableNftsAction = new GetAvailableNftsAction()
    const { tokenIds } = await getAvailableNftsAction.func({ player: args.playerAddress }, agentkit)

    // Step 2: Retrieve metadata for each NFT
    const getFlipMetadataAction = new GetFlipMetadataAction()
    const nftsWithMetadata = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const { metadata } = await getFlipMetadataAction.func({ tokenId }, agentkit)
        return { tokenId, metadata }
      }),
    )

    // Step 3: Group NFTs by tile type
    const groupedNfts = groupNftsByTileType(nftsWithMetadata)

    // Step 4: Generate art suggestions
    const suggestions = generateArtSuggestions(groupedNfts)

    return {
      suggestions,
      message: `Generated ${suggestions.length} art suggestions based on ${tokenIds.length} available NFTs.`,
    }
  } catch (error) {
    console.error("Error in makeArtSuggestions:", error)
    throw new Error(`Error making art suggestions: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class MakeArtSuggestionsAction
  implements FlippandoAction<typeof MakeArtSuggestionsSchema, typeof MakeArtSuggestionsResponseSchema>
{
  name = "make_art_suggestions"
  description = MAKE_ART_SUGGESTIONS_PROMPT
  argsSchema = MakeArtSuggestionsSchema
  responseSchema = MakeArtSuggestionsResponseSchema
  func = makeArtSuggestions
}

