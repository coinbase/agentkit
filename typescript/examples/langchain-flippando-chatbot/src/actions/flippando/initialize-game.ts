import { z } from "zod"
import { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoGameMasterABI from "../../abis/FlippandoGameMaster.json"
import { FlippandoAgentkit } from "../../flippando-agentkit"

const INITIALIZE_GAME_PROMPT = `
This action initializes a Flippando game. It takes the game ID as input.
The action will interact with the FlippandoGameMaster contract to initialize the specified game.
`

export const InitializeGameSchema = z.object({
  gameId: z.string().describe("The ID of the game to initialize"),
})

export async function initializeGame(
  args: z.infer<typeof InitializeGameSchema>, agentkit: FlippandoAgentkit
): Promise<string> {
  const flippandoGameMaster = new ethers.Contract(
    agentkit.getFlippandoGameMasterAddress(),
    FlippandoGameMasterABI.abi,
    agentkit.getSigner(),
)

  try {
    const tx = await flippandoGameMaster.initializeGame(args.gameId)
    const receipt = await tx.wait()
    const event = receipt.events?.find((e: any) => e.event === "GameInitialized")
    if (!event) throw new Error("GameInitialized event not found")
    return `Game ${args.gameId} initialized successfully.`
  } catch (error) {
    return `Error initializing game: ${error instanceof Error ? error.message : String(error)}`
  }
}

export class InitializeGameAction implements FlippandoAction<typeof InitializeGameSchema> {
  name = "initialize_game"
  description = INITIALIZE_GAME_PROMPT
  argsSchema = InitializeGameSchema
  func = initializeGame
}

