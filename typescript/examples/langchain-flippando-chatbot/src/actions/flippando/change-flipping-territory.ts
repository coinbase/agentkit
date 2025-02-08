import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"

const CHANGE_FLIPPING_TERRITORY_PROMPT = `
This action changes the network (chain) and contract addresses for Flippando operations.
It updates the chainId, rpcUrl, FlippandoGameMaster address, FlippandoBundler address, Flipnd (Erc20 token) address and Flippando address.
`

export const ChangeFlippingTerritorySchema = z.object({
  chainId: z.number().int().positive().describe("The new chain ID"),
  rpcUrl: z.string().url().describe("The new RPC URL for the chain"),
  flippandoGameMasterAddress: z.string().describe("The new FlippandoGameMaster contract address"),
  flippandoAddress: z.string().describe("The new Flippando contract address"),
  flippandoBundlerAddress: z.string().describe("The new FlippandoBundler contract address"),
  flipndAddress: z.string().describe("The new Flipnd contract address"),
})

export const ChangeFlippingTerritoryResponseSchema = z.object({
  message: z.string(),
})

export class ChangeFlippingTerritoryAction
  implements FlippandoAction<typeof ChangeFlippingTerritorySchema, typeof ChangeFlippingTerritoryResponseSchema>
{
  name = "change_flipping_territory"
  description = CHANGE_FLIPPING_TERRITORY_PROMPT
  argsSchema = ChangeFlippingTerritorySchema
  responseSchema = ChangeFlippingTerritoryResponseSchema

  async func(
    args: z.infer<typeof ChangeFlippingTerritorySchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof ChangeFlippingTerritoryResponseSchema>> {
    try {
      await agentkit.updateNetwork(
        args.chainId, 
        args.rpcUrl, 
        args.flippandoGameMasterAddress, 
        args.flippandoAddress,
        args.flippandoBundlerAddress,
        args.flipndAddress)

      return {
        message: `Successfully changed flipping territory to chain ${args.chainId} with new contract addresses.`,
      }
    } catch (error) {
      console.error("Error changing flipping territory:", error)
      throw new Error(`Error changing flipping territory: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

