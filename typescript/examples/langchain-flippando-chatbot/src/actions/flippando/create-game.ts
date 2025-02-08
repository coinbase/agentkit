import { z } from "zod"
import { ethers } from "ethers"
import FlippandoGameMasterABI from "../../abis/FlippandoGameMaster.json"
import { FlippandoAction } from "../flippando"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const CREATE_GAME_PROMPT = `
This action creates a new Flippando game. It takes the board size, game type, and game tile type as inputs.
The action will interact with the FlippandoGameMaster contract to create a new game.
`

export const CreateGameSchema = z.object({
  boardSize: z.number().int().positive().describe("The size of the game board"),
  gameType: z.number().int().nonnegative().describe("The type of the game"),
  gameTileType: z.number().int().nonnegative().describe("The type of tiles used in the game"),
})

export async function createGame(args: z.infer<typeof CreateGameSchema>, agentkit: FlippandoAgentkit): Promise<string> {
    const flippandoGameMaster = new ethers.Contract(
      agentkit.getFlippandoGameMasterAddress(),
      FlippandoGameMasterABI.abi,
      agentkit.getSigner(),
    )
  
    try {
      const tx = await flippandoGameMaster.createGame(args.boardSize, args.gameType, args.gameTileType)
      const receipt = await tx.wait()
      const event = receipt.events?.find((e: any) => e.event === "GameCreated")
      if (!event) throw new Error("GameCreated event not found")
      const gameId = event.args.gameId
      return `Game created successfully on chain ${agentkit.getChainId()}. Game ID: ${gameId}`
    } catch (error) {
      return `Error creating game: ${error instanceof Error ? error.message : String(error)}`
    }
  }
export class CreateGameAction implements FlippandoAction <typeof CreateGameSchema> {
  public name = "create_game";
  public description = CREATE_GAME_PROMPT;
  public argsSchema = CreateGameSchema;
  public func = createGame
}

