import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoABI from "../../abis/Flippando.json"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const MAKE_ART_PROMPT = `
This action will create an art NFT, using the tokenIds provided. It also needs the boardWidth and boardHeight of the new art NFT.
These properties are influenced by the total number of existing basic NFTs, and it's enforced on chain.
The minimum size is 2x2, the maximum size is 8x8.
`

export const MakeArtSchema = z.object({
  boardWidth: z.number().describe("The width of the new art NFT board"),
  boardHeight: z.number().describe("The height of the new art NFT board"),
  tokenIds: z.array(z.number().describe("The array of tokenIds. Must match boardWidth x boardHeight"))
})

export const MakeArtResponseSchema = z.object({
    artTokenId: z.string(),
    tileTypes: z.string(),
    boards: z.string(),
  message: z.string(),
})

export async function makeArt(
  args: z.infer<typeof MakeArtSchema>, agentkit: FlippandoAgentkit
): Promise<z.infer<typeof MakeArtResponseSchema>> {
    const flippando = new ethers.Contract(
        agentkit.getFlippandoAddress(),
        FlippandoABI.abi,
        agentkit.getSigner(),
    )

  try {
    console.log(`Making Art with boardWidth ${args.boardWidth}, boardHeight ${args.boardWidth}`)
    const tx = await flippando.makeArt(args.boardWidth, args.boardHeight, args.tokenIds)
    console.log(`Transaction sent: ${tx.hash}`)
    const receipt = await tx.wait()
    //console.log(`Transaction confirmed: ${receipt.transactionHash}`)

    const artCreatedEvent = receipt.events?.find((e: any) => e.event === "ArtworkCreated")

    if (!artCreatedEvent) throw new Error("NftCrArtworkCreatedeated event not found")

    //console.log("GameState event found:", JSON.stringify(gameStateEvent, null, 2))

    const artTokenId = artCreatedEvent.args[0]
    const tileTypes = artCreatedEvent.args[1]
    const boards = artCreatedEvent.args[2]
    //console.log("Nft id:", nftId)

    let message: string
    message = `Art created with id: ${artTokenId}, tile types: ${tileTypes}, containing boards: ${boards}, `
    console.log("Final message:", message)

    return {
        artTokenId,
        tileTypes,
        boards,
      message,
    }
  } catch (error) {
    console.error("Error in makeArt:", error)
    throw new Error(`Error creting art nft: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class MakeArtAction implements FlippandoAction<typeof MakeArtSchema, typeof MakeArtResponseSchema> {
  name = "make_art"
  description = MAKE_ART_PROMPT
  argsSchema = MakeArtSchema
  responseSchema = MakeArtResponseSchema
  func = makeArt
}

