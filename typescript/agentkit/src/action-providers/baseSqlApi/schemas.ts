import { z } from "zod";

/**
 * Action schemas for the baseSqlApi action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the baseSqlApi action provider.
 */

export const BaseSqlApiSchema = z.object({
  /**
   * The SQL query to run
   */
  sqlQuery: z.string().describe("The sql query to execute, using the defined tables and fields"),
});
