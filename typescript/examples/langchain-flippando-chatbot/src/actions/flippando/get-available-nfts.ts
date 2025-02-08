import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoABI from "../../abis/Flippando.json"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const GET_AVAILABLE_NFTS_PROMPT = `
This action gets the available basic NFTs (flips), which can be used to create art. 
It returns the an array of NFT tokenIds, not owned by the called, which can be used to assmeble a complex NFT.
`

export const GetAvailableNftsSchema = z.object({
    player: z.string().describe("The address of the player for which we're calling the function"),
})

export const GetAvailableNftsResponseSchema = z.object({
    tokenIds: z.array(z.string()),
    message: z.string(),
})

export async function getAvailableNfts(
  args: z.infer<typeof GetAvailableNftsSchema>, agentkit: FlippandoAgentkit
): Promise<z.infer<typeof GetAvailableNftsResponseSchema>> {
    const flippando = new ethers.Contract(
        agentkit.getFlippandoAddress(),
        FlippandoABI.abi,
        agentkit.getSigner(),
    )

  try {
    console.log(`Getting available Nft for player ${args.player}`)
    const availableTokens = await flippando.getAllBasicTokensForPlayer(args.player)
    // Convert BigNumber objects to strings
    const tokenIds = availableTokens.map((token: ethers.BigNumber) => token.toString())
    console.log(`Token Ids: ${tokenIds}`)


    const message = `Available NFTs retrieved for player: ${args.player}`
    console.log("Final message:", message)

    return {
      tokenIds,
      message,
    }
  } catch (error) {
    console.error("Error in getting available NFTs:", error)
    throw new Error(`Error getting available NFTs: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class GetAvailableNftsAction
  implements FlippandoAction<typeof GetAvailableNftsSchema, typeof GetAvailableNftsResponseSchema>
{
  name = "get_available_nfts"
  description = GET_AVAILABLE_NFTS_PROMPT
  argsSchema = GetAvailableNftsSchema
  responseSchema = GetAvailableNftsResponseSchema
  func = getAvailableNfts
}

