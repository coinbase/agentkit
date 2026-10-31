/**
 * Main exports for the CDP Gemini package
 */

import { z } from "zod";
import { AgentKit, type Action } from "@coinbase/agentkit";
import type { FunctionDeclaration } from "@google/generative-ai";

/**
 * Converts a Zod schema to a Gemini-compatible OpenAPI 3.0 schema
 *
 * @param zodSchema - The Zod schema to convert
 * @returns OpenAPI 3.0 compatible schema object
 */
function zodToGeminiSchema(zodSchema: any): any {
  if (!zodSchema || !zodSchema._def) {
    return { type: "string" };
  }

  const zodType = zodSchema._def;

  switch (zodType.typeName) {
    case "ZodString":
      const stringSchema: any = { type: "string" };
      if (zodType.checks) {
        for (const check of zodType.checks) {
          if (check.kind === "min") {
            stringSchema.minLength = check.value;
          } else if (check.kind === "max") {
            stringSchema.maxLength = check.value;
          }
        }
      }
      return stringSchema;

    case "ZodNumber":
      const numberSchema: any = { type: "number" };
      if (zodType.checks) {
        for (const check of zodType.checks) {
          if (check.kind === "min") {
            numberSchema.minimum = check.value;
          } else if (check.kind === "max") {
            numberSchema.maximum = check.value;
          } else if (check.kind === "int") {
            numberSchema.type = "integer";
          }
        }
      }
      return numberSchema;

    case "ZodBoolean":
      return { type: "boolean" };

    case "ZodArray":
      return {
        type: "array",
        items: zodToGeminiSchema(zodType.type),
      };

    case "ZodObject":
      const properties: Record<string, any> = {};
      const required: string[] = [];

      if (zodType.shape && typeof zodType.shape === "function") {
        const shape = zodType.shape();
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = zodToGeminiSchema(value);

          // Check if field is required (not optional)
          if (value && (value as any)._def && (value as any)._def.typeName !== "ZodOptional") {
            required.push(key);
          }
        }
      }

      const objectSchema: any = {
        type: "object",
        properties,
      };

      if (required.length > 0) {
        objectSchema.required = required;
      }

      return objectSchema;

    case "ZodEnum":
      return {
        type: "string",
        enum: zodType.values,
      };

    case "ZodLiteral":
      return {
        type: typeof zodType.value,
        enum: [zodType.value],
      };

    case "ZodUnion":
      // For unions, try to extract enum values if all are literals
      const options = zodType.options || [];
      const literals = options.filter((opt: any) => opt._def?.typeName === "ZodLiteral");

      if (literals.length === options.length && literals.length > 0) {
        return {
          type: "string",
          enum: literals.map((lit: any) => lit._def.value),
        };
      }

      // For complex unions, just use the first option as fallback
      if (options.length > 0) {
        return zodToGeminiSchema(options[0]);
      }

      return { type: "string" };

    case "ZodOptional":
      return zodToGeminiSchema(zodType.innerType);

    case "ZodNullable":
      const baseSchema = zodToGeminiSchema(zodType.innerType);
      return {
        ...baseSchema,
        nullable: true,
      };

    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: zodToGeminiSchema(zodType.valueType),
      };

    default:
      // Fallback for unsupported types
      console.warn(`Unsupported Zod type: ${zodType.typeName}, falling back to string`);
      return { type: "string" };
  }
}

/**
 * Get Gemini function declarations from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of Gemini FunctionDeclaration objects
 */
export function getGeminiTools(agentKit: AgentKit): FunctionDeclaration[] {
  const actions: Action[] = agentKit.getActions();

  return actions.map((action): FunctionDeclaration => {
    const parameters = zodToGeminiSchema(action.schema);

    return {
      name: action.name,
      description: action.description,
      parameters,
    };
  });
}

/**
 * Execute a function call from Gemini's response
 *
 * @param agentKit - The AgentKit instance
 * @param functionCall - The function call object from Gemini's response
 * @param functionCall.name
 * @param functionCall.args
 * @returns Promise resolving to the function execution result
 */
export async function executeGeminiFunction(
  agentKit: AgentKit,
  functionCall: { name: string; args: Record<string, any> },
): Promise<string> {
  const actions = agentKit.getActions();
  const action = actions.find(a => a.name === functionCall.name);

  if (!action) {
    throw new Error(`Function ${functionCall.name} not found in AgentKit actions`);
  }

  try {
    // Validate the arguments against the schema
    const validatedArgs = action.schema.parse(functionCall.args);

    // Execute the action
    const result = await action.invoke(validatedArgs);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments for ${functionCall.name}: ${error.message}`);
    }
    throw error;
  }
}
