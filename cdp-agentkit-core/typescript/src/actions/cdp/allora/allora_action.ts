import { z } from "zod";
import { AlloraAPIClient } from "@alloralabs/allora-sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AlloraActionSchemaAny = z.ZodObject<any, any, any, any>;

/**
 * Represents the base structure for Allora Actions.
 */
export interface AlloraAction<TActionSchema extends AlloraActionSchemaAny> {
  /**
   * The name of the action.
   */
  name: string;

  /**
   * A description of what the action does
   */
  description: string;

  /**
   * Schema for validating action arguments
   */
  argsSchema: TActionSchema;

  /**
   * The function to execute for this action
   */
  func:
    | ((client: AlloraAPIClient, args: z.infer<TActionSchema>) => Promise<string>)
    | ((args: z.infer<TActionSchema>) => Promise<string>);
}
