import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"

const GET_AVAILABLE_FLIPPING_TERRITORIES_PROMPT = `
This action returns the available networks (flipping territories) for Flippando operations.
It provides a list of networks with their chain IDs, RPC URLs, and contract addresses.
`

const FlippingTerritorySchema = z.object({
  humanReadableName: z.string().describe("A human-readable name for the network"),
  chainId: z.number().int().positive().describe("The chain ID"),
  rpcUrl: z.string().url().describe("The RPC URL for the chain"),
  flippandoGameMasterAddress: z.string().describe("The FlippandoGameMaster contract address"),
  flippandoAddress: z.string().describe("The Flippando contract address"),
  flippandoBundlerAddress: z.string().describe("The FlippandoBundler contract address"),
  flipndAddress: z.string().describe("The Flipnd contract address"),
})

export const GetAvailableFlippingTerritoriesSchema = z.object({})

export const GetAvailableFlippingTerritoriesResponseSchema = z.object({
  territories: z.array(FlippingTerritorySchema),
  message: z.string(),
})

export class GetAvailableFlippingTerritoriesAction
  implements
    FlippandoAction<typeof GetAvailableFlippingTerritoriesSchema, typeof GetAvailableFlippingTerritoriesResponseSchema>
{
  name = "get_available_flipping_territories"
  description = GET_AVAILABLE_FLIPPING_TERRITORIES_PROMPT
  argsSchema = GetAvailableFlippingTerritoriesSchema
  responseSchema = GetAvailableFlippingTerritoriesResponseSchema

  async func(
    args: z.infer<typeof GetAvailableFlippingTerritoriesSchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof GetAvailableFlippingTerritoriesResponseSchema>> {
    try {
      
      const availableTerritories = [
        {
          humanReadableName: "Saga Mainnet",
          chainId: 2737273595554000,
          rpcUrl: "https://flippandomainnet-2737273595554000-1.jsonrpc.sagarpc.io",
          flippandoGameMasterAddress: "0x7cC0769F7d234cE9A4903F5d219a1D9f444B3736",
          flippandoAddress: "0x29566Cf20B0bD7F1A7D17d18b0570a802019Cc35",
          flippandoBundlerAddress: "0x56Fc906D33F49f3BAd0aac73534e85F9059e55AC",
          flipndAddress: "0x36a68f905bCAA243d0f445738aC54beb9ddD5DC5",
        },
        {
          humanReadableName: "Saga Devnet (Testnet)",
          chainId: 2712667629718000,
          rpcUrl: "https://flippando-2712667629718000-1.jsonrpc.sagarpc.io",
          flippandoGameMasterAddress: "0xC4f29FD880d039D5BE3d99732c68c9782451997D",
          flippandoAddress: "0xA2882074738BC71F7b10c6ef37E5E98A99a46979",
          flippandoBundlerAddress: "0x0324efd1F38EEbEC556485B346fEb88445AD6E5A",
          flipndAddress: "0x40D309277d18D9177acC88990f1A6186c492FB2d",
        },
        {
            humanReadableName: "Base Sepolia (Testnet)",
            chainId: 84532,
            rpcUrl: "https://sepolia.base.org",
            flippandoGameMasterAddress: "0x6B1c326677B3be4cc7C6E48Bc39F697effa4B77F",
            flippandoAddress: "0x79571F1F15AdA2DC0Fbd71F916f75f8Be6aDFe14",
            flippandoBundlerAddress: "0x231282fdaD2874abbD518Be60802eD45E76dB10A",
            flipndAddress: "0x4d2617DE90452d05f3Bc6229fbC78a1870b41988",
        },
      ]

      return {
        territories: availableTerritories,
        message: `Retrieved ${availableTerritories.length} available flipping territories.`,
      }
    } catch (error) {
      console.error("Error getting available flipping territories:", error)
      throw new Error(
        `Error getting available flipping territories: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

