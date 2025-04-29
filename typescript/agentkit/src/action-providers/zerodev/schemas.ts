import { z } from "zod";

/**
 * Input schema for get CAB action.
 */
export const GetCABSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("networkFilter"),
    tokenTickers: z.array(z.string()).optional(),
    networks: z.array(z.number()).describe("The networks to get the balance for."),
  }),
  z.object({
    type: z.literal("networkType"),
    tokenTickers: z.array(z.string()).optional(),
    networkType: z
      .enum(["mainnet", "testnet"])
      .describe("The type of network to get the balance for."),
  }),
]);
