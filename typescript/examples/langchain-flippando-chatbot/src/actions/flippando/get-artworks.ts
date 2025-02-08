import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoBundlerABI from "../../abis/FlippandoBundler.json"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const GET_ARTWORKS_PROMPT = `
This action gets the available art NFTs. 
It returns the an array of NFT tokenIds, which can be used to assmeble a complex NFT.
`

export const GetArtworksSchema = z.object({})

export const GetArtworksResponseSchema = z.object({
    tokenIds: z.array(z.string()),
    message: z.string(),
})

export async function getArtworks(
  args: z.infer<typeof GetArtworksSchema>, agentkit: FlippandoAgentkit
): Promise<z.infer<typeof GetArtworksResponseSchema>> {
    const flippandoBundler = new ethers.Contract(
        agentkit.getFlippandoBundlerAddress(),
        FlippandoBundlerABI.abi,
        agentkit.getSigner(),
    )

  try {
    console.log(`Getting all artworks for the agent`)
    const artworksTokens = await flippandoBundler.getUserNFTs()
    // Convert BigNumber objects to strings
    const tokenIds = artworksTokens.map((token: ethers.BigNumber) => token.toString())
    console.log(`Token Ids: ${tokenIds}`)


    const message = `Artworks for this agent:`
    console.log("Final message:", message)

    return {
      tokenIds,
      message,
    }
  } catch (error) {
    console.error("Error in getting agent artworks:", error)
    throw new Error(`Error getting agent artworkss: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class GetArtworksAction
  implements FlippandoAction<typeof GetArtworksSchema, typeof GetArtworksResponseSchema>
{
  name = "get_artworks"
  description = GET_ARTWORKS_PROMPT
  argsSchema = GetArtworksSchema
  responseSchema = GetArtworksResponseSchema
  func = getArtworks
}

