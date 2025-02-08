import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoABI from "../../abis/Flippando.json"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const FLIP_TILES_PROMPT = `
This action flips tiles in a Flippando game. It takes the game ID and an array of tile positions to flip.
The action will interact with the Flippando contract to flip the specified tiles.
It returns the updated board state, solved board state, and a message indicating if the flipped tiles match or if the game is solved.
`

export const FlipTilesSchema = z.object({
  gameId: z.string().describe("The ID of the game"),
  positions: z.array(z.number().int().nonnegative()).length(2).describe("The positions of the two tiles to flip"),
})

export const FlipTilesResponseSchema = z.object({
  message: z.string(),
  board: z.array(z.number()),
  solvedBoard: z.array(z.number()),
  isGameSolved: z.boolean(),
})

export async function flipTiles(
  args: z.infer<typeof FlipTilesSchema>, agentkit: FlippandoAgentkit
): Promise<z.infer<typeof FlipTilesResponseSchema>> {
    const flippando = new ethers.Contract(
        agentkit.getFlippandoAddress(),
        FlippandoABI.abi,
        agentkit.getSigner(),
    )

  try {
    console.log(`Flipping tiles for game ${args.gameId}, positions: ${args.positions.join(", ")}`)
    const tx = await flippando.flipTiles(args.gameId, args.positions)
    console.log(`Transaction sent: ${tx.hash}`)
    const receipt = await tx.wait()
    //console.log(`Transaction confirmed: ${receipt.transactionHash}`)

    const gameStateEvent = receipt.events?.find((e: any) => e.event === "GameState")
    const gameSolvedEvent = receipt.events?.find((e: any) => e.event === "GameSolved")

    if (!gameStateEvent) throw new Error("GameState event not found")

    //console.log("GameState event found:", JSON.stringify(gameStateEvent, null, 2))

    const gameStruct = gameStateEvent.args[1]
    //console.log("Game Struct:", JSON.stringify(gameStruct, null, 2))

    const board = gameStruct.board.map((tile: ethers.BigNumber | number) =>
      typeof tile === "number" ? tile : tile.toNumber(),
    )
    const solvedBoard = gameStruct.solvedBoard.map((tile: ethers.BigNumber | number) =>
      typeof tile === "number" ? tile : tile.toNumber(),
    )

    //console.log("Parsed Board:", board)
    //console.log("Parsed Solved Board:", solvedBoard)

    const chainPositions = gameStateEvent.args[2]
    //console.log("Chain Positions:", chainPositions)

    let message: string
    let isGameSolved = false

    if (gameSolvedEvent && gameSolvedEvent.args.id === args.gameId) {
      message = "Hooray, game solved!"
      isGameSolved = true
    } else {
      const [pos1, pos2] = chainPositions
      const tilesMatch = board[pos1] === board[pos2] && board[pos1] !== 0
      const solvedTiles = solvedBoard.filter((tile: number) => tile !== 0).length
      const totalTiles = solvedBoard.length
      const solvedPercentage = Math.round((solvedTiles / totalTiles) * 100)
      const baseMessage = tilesMatch ? "Tiles flipped, hooray!" : "Tiles not matching, need to try harder"
      message = `${baseMessage} Game solved: ${solvedPercentage}%`
    }

    console.log("Final message:", message)
    console.log("Is game solved:", isGameSolved)

    return {
      message,
      board,
      solvedBoard,
      isGameSolved,
    }
  } catch (error) {
    console.error("Error in flipTiles:", error)
    throw new Error(`Error flipping tiles: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class FlipTilesAction implements FlippandoAction<typeof FlipTilesSchema, typeof FlipTilesResponseSchema> {
  name = "flip_tiles"
  description = FLIP_TILES_PROMPT
  argsSchema = FlipTilesSchema
  responseSchema = FlipTilesResponseSchema
  func = flipTiles
}

