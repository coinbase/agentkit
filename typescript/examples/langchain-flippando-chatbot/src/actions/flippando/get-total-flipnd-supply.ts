import { z } from "zod"
import { ethers } from "ethers"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { GetAvailableFlippingTerritoriesAction } from "./get-available-networks"

// Import the ABI from FLIPND.sol
import FLIPNDABI from "../../abis/FLIPND.json"

const GET_TOTAL_FLIPND_SUPPLY_PROMPT = `
This action retrieves the total locked and unlocked supply of $FLIPND tokens across all chains where the game is deployed.
It uses the get-available-networks action to retrieve connection and contract data, then calculates the supply for each chain.
It also includes the price of FLIPND tokens on each chain.
`

export const GetTotalFlipndSupplySchema = z.object({})

export const GetTotalFlipndSupplyResponseSchema = z.object({
  chainSupplies: z.array(
    z.object({
      chainId: z.number(),
      humanReadableName: z.string(),
      lockedSupply: z.string(),
      unlockedSupply: z.string(),
      price: z.number(),
    }),
  ),
  totalLockedSupply: z.string(),
  totalUnlockedSupply: z.string(),
  message: z.string(),
})

function getPriceForChain(chainId: number): number {
  switch (chainId) {
    case 84532: // Sepolia
      return 0.03
    case 2737273595554000: // Saga Mainnet
      return 0.008
    case 2712667629718000: // Saga Devnet
      return 0.0003
    default:
      return 0 // Default price if chain is not recognized
  }
}

export class GetTotalFlipndSupplyAction
  implements FlippandoAction<typeof GetTotalFlipndSupplySchema, typeof GetTotalFlipndSupplyResponseSchema>
{
  name = "get_total_flipnd_supply"
  description = GET_TOTAL_FLIPND_SUPPLY_PROMPT
  argsSchema = GetTotalFlipndSupplySchema
  responseSchema = GetTotalFlipndSupplyResponseSchema

  async func(
    args: z.infer<typeof GetTotalFlipndSupplySchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof GetTotalFlipndSupplyResponseSchema>> {
    try {
      // Get available networks
      const getTerritoriesAction = new GetAvailableFlippingTerritoriesAction()
      const { territories } = await getTerritoriesAction.func(args, agentkit)

      let totalLockedSupply = ethers.BigNumber.from(0)
      let totalUnlockedSupply = ethers.BigNumber.from(0)
      const chainSupplies = []

      // Loop through each territory (chain)
      for (const territory of territories) {
        const provider = new ethers.providers.JsonRpcProvider(territory.rpcUrl)
        const flipndContract = new ethers.Contract(territory.flipndAddress, FLIPNDABI.abi, provider)

        // Get locked and unlocked supply using the correct functions
        const lockedSupply = await flipndContract.getTotalLockedSupply()
        const unlockedSupply = await flipndContract.totalSupply()

        totalLockedSupply = totalLockedSupply.add(lockedSupply)
        totalUnlockedSupply = totalUnlockedSupply.add(unlockedSupply)

        // Get price for the current chain
        const price = getPriceForChain(territory.chainId)

        chainSupplies.push({
          chainId: territory.chainId,
          humanReadableName: territory.humanReadableName,
          lockedSupply: ethers.utils.formatEther(lockedSupply),
          unlockedSupply: ethers.utils.formatEther(unlockedSupply),
          price: price,
        })
      }

      const message =
        `Total locked supply: ${ethers.utils.formatEther(totalLockedSupply)} FLIPND, ` +
        `Total unlocked supply: ${ethers.utils.formatEther(totalUnlockedSupply)} FLIPND`

      return {
        chainSupplies,
        totalLockedSupply: ethers.utils.formatEther(totalLockedSupply),
        totalUnlockedSupply: ethers.utils.formatEther(totalUnlockedSupply),
        message,
      }
    } catch (error) {
      console.error("Error getting total FLIPND supply:", error)
      throw new Error(`Error getting total FLIPND supply: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

