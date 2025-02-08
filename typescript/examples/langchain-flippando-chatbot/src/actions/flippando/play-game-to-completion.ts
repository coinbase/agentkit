import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { ethers } from "ethers"
import FlippandoABI from "../../abis/Flippando.json"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { getNextPositions } from "../../utils/getNextPositions"

const PLAY_GAME_TO_COMPLETION_PROMPT = `
This action plays a Flippando game to completion. It takes the game ID as input and
repeatedly calls the flipTiles function until the game is solved. The action uses an
intelligent strategy to select tiles to flip, keeping track of the total time spent
solving the game and the total number of tries.
`

export const PlayGameToCompletionSchema = z.object({
  gameId: z.string().describe("The ID of the game to play"),
})

export const PlayGameToCompletionResponseSchema = z.object({
  message: z.string(),
  finalState: z.object({
    totalTime: z.number(),
    totalTries: z.number(),
    solvedBoard: z.array(z.number()),
  }),
})

function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
  
  function findMatchingTiles(board: number[], solvedBoard: number[]): number[] | null {
    const unsolvedPositions: number[] = []
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== 0 && solvedBoard[i] === 0) {
        unsolvedPositions.push(i)
      }
    }
  
    for (let i = 0; i < unsolvedPositions.length; i++) {
      for (let j = i + 1; j < unsolvedPositions.length; j++) {
        if (board[unsolvedPositions[i]] === board[unsolvedPositions[j]]) {
          return [unsolvedPositions[i], unsolvedPositions[j]]
        }
      }
    }
  
    return null
  }
  
  function getUnsolvedTiles(solvedBoard: number[]): number[] {
    return solvedBoard.reduce((acc: number[], tile: number, index: number) => {
      if (tile === 0) acc.push(index)
      return acc
    }, [])
  }
  
  export async function playGameToCompletion(
    args: z.infer<typeof PlayGameToCompletionSchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof PlayGameToCompletionResponseSchema>> {
    console.log("Starting playGameToCompletion with args:", args)
    console.log("Flippando address:", agentkit.getFlippandoAddress())
    const startTime = Date.now()
    let tries = 0
    let isGameSolved = false
  
    const flippando = new ethers.Contract(agentkit.getFlippandoAddress(), FlippandoABI.abi, agentkit.getSigner())
  
    let currentBoard: number[] = []
    let currentSolvedBoard: number[] = []
  
    while (!isGameSolved && tries < 100) {
      console.log(`Starting iteration ${tries + 1}`)
      try {
        console.log("Current Board before getNextPositions:", currentBoard)
        console.log("Current Solved Board before getNextPositions:", currentSolvedBoard)
        console.log("Remaining unsolved:", currentSolvedBoard.filter((tile) => tile === 0).length)
        console.log("Board size:", currentBoard.length)
  
        let positions: number[] | null
  
        const boardSize = currentBoard.length
        const sqrtBoardSize = Math.sqrt(boardSize)
        const unsolvedTiles = getUnsolvedTiles(currentSolvedBoard)
  
        if (unsolvedTiles.length <= sqrtBoardSize && unsolvedTiles.length > 0) {
          // Pick the first two unsolved tiles
          positions = unsolvedTiles.slice(0, 2)
          console.log("Final stage: picking unsolved tiles in order:", positions)
        } else {
          // First, try to find matching tiles
          positions = findMatchingTiles(currentBoard, currentSolvedBoard)
  
          // If no matching tiles found, use getNextPositions
          if (!positions) {
            positions = tries === 0 ? [0, 1] : getNextPositions(currentBoard, currentSolvedBoard)
          }
        }
  
        if (!positions || positions.length !== 2) {
          console.log("No valid positions to flip. Game might be in an invalid state.")
          break
        }
  
        console.log("Positions to flip:", positions)
        console.log(`Flipping tiles for game ${args.gameId}, positions: ${positions.join(", ")}`)
  
        const tx = await flippando.flipTiles(args.gameId, positions)
        console.log(`Transaction sent: ${tx.hash}`)
        const receipt = await tx.wait()
  
        const gameStateEvent = receipt.events?.find((e: any) => e.event === "GameState")
        const gameSolvedEvent = receipt.events?.find((e: any) => e.event === "GameSolved")
  
        if (!gameStateEvent) {
          console.error("GameState event not found")
          break // Exit the loop if GameState event is not found
        }
  
        const gameStruct = gameStateEvent.args[1]
        const previousBoard = [...currentBoard]
        const previousSolvedBoard = [...currentSolvedBoard]
        currentBoard = gameStruct.board
        currentSolvedBoard = gameStruct.solvedBoard
  
        if (arraysEqual(currentBoard, previousBoard) && arraysEqual(currentSolvedBoard, previousSolvedBoard)) {
          console.warn("Board state did not change after flip!")
        }
  
        if (currentBoard.length === 0 || currentSolvedBoard.length === 0) {
          console.error("Board or solvedBoard is empty!")
          console.log("Full gameStruct:", gameStruct)
        }
  
        console.log("Current Board after flip:", currentBoard)
        console.log("Current Solved Board after flip:", currentSolvedBoard)
  
        if (gameSolvedEvent && gameSolvedEvent.args.id === args.gameId) {
          isGameSolved = true
          console.log("Game solved!")
        } else {
          const solvedTiles = currentSolvedBoard.filter((tile: number) => tile !== 0).length
          const totalTiles = currentSolvedBoard.length
          const solvedPercentage = Math.round((solvedTiles / totalTiles) * 100)
          console.log(`Game progress: ${solvedPercentage}% solved`)
        }
      } catch (error) {
        console.error(`Error in playGameToCompletion (try ${tries + 1}):`, error)
        if (error instanceof Error) {
          console.error("Error message:", error.message)
          console.error("Error stack:", error.stack)
        }
        // Don't throw here, just log the error and continue the loop
      } finally {
        tries++
        console.log(`Completed iteration ${tries}, isGameSolved: ${isGameSolved}`)
      }
    }
  
    const endTime = Date.now()
    const totalTime = endTime - startTime
  
    console.log(`Game completion attempt finished. Total tries: ${tries}, isGameSolved: ${isGameSolved}`)
  
    return {
      message: isGameSolved ? "Game completed successfully" : "Game could not be completed within the try limit",
      finalState: {
        totalTime,
        totalTries: tries,
        solvedBoard: currentSolvedBoard,
      },
    }
  }


export class PlayGameToCompletionAction
  implements FlippandoAction<typeof PlayGameToCompletionSchema, typeof PlayGameToCompletionResponseSchema>
{
  name = "play_game_to_completion"
  description = PLAY_GAME_TO_COMPLETION_PROMPT
  argsSchema = PlayGameToCompletionSchema
  responseSchema = PlayGameToCompletionResponseSchema
  func = playGameToCompletion
}

