import { z } from "zod";

/**
 * Input schema for Fodda context layer query action
 */
export const FoddaQueryContextSchema = z.object({
  slug: z
    .string()
    .describe(
      "The exact slug for the knowledge graph or market intelligence report to retrieve (e.g. 'psfk-retail', 'food-beverage', 'hospitality').",
    ),
});
