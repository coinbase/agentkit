import type { ethers } from "ethers"
import type { FlippandoGameState } from "./types"

/**
 * Converts a BigNumber to a regular number
 * @param bn BigNumber to convert
 * @returns number
 */
export function bigNumberToNumber(bn: ethers.BigNumber): number {
  return bn.toNumber()
}

/**
 * Calculates the percentage of the game that has been completed
 * @param gameState Current state of the game
 * @returns number Percentage of game completed (0-100)
 */
export function calculateGameProgress(gameState: FlippandoGameState): number {
  const totalTiles = gameState.board.length
  const solvedTiles = gameState.solvedBoard.filter((tile) => tile !== 0).length
  return (solvedTiles / totalTiles) * 100
}

/**
 * Formats a timestamp into a human-readable date string
 * @param timestamp Unix timestamp
 * @returns string Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

/**
 * Truncates an Ethereum address for display purposes
 * @param address Full Ethereum address
 * @returns string Truncated address
 */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Retries a promise-based function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param delay Initial delay in milliseconds
 * @returns Promise<T>
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let retries = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (retries >= maxRetries) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, retries)))
      retries++
    }
  }
}

