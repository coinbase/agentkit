import { z } from "zod";

/**
 * Action schemas for the baseSqlApi action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the baseSqlApi action provider.
 */

/**
 * Example action schema demonstrating various field types and validations.
 * Replace or modify this with your actual action schemas.
 */
export const BaseSqlApiSchema = z.object({
  /**
   * A descriptive name for the field
   */
  sqlQuery: z.string().describe("The sql query to execute, using the defined tables and fields"),
});
