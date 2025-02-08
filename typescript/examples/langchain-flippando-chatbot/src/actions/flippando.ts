import type { z } from "zod"
import type { FlippandoAgentkit } from "../flippando-agentkit"

/**
 * Type definition for any Flippando action schema
 */
export type FlippandoActionSchemaAny = z.ZodObject<any, any, any, any>
export type TResponseSchema = z.ZodType<any, any, any>

/**
 * Interface for Flippando actions
 */
export interface FlippandoAction<TActionSchema extends FlippandoActionSchemaAny,
    TResponseSchema extends z.ZodType<any, any, any> = z.ZodString> {
  /**
   * The name of the action
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
   * Optional schema for validating action response
   */
  responseSchema?: TResponseSchema;

  /**
   * The function to execute for this action
   */
  func: (args: z.infer<TActionSchema>, agentkit: FlippandoAgentkit) => Promise<z.infer<TResponseSchema>>
}
