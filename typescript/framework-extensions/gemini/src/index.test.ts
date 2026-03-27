import { z } from "zod";
import { getGeminiTools, executeGeminiFunction } from "./index";
import { AgentKit } from "@coinbase/agentkit";

// Mock AgentKit before importing - this prevents loading ES-only dependencies
jest.mock("@coinbase/agentkit", () => ({
  AgentKit: {
    from: jest.fn(),
  },
}));

// Define mock actions after imports
const mockStringAction = {
  name: "testStringAction",
  description: "A test action with string parameter",
  schema: z.object({
    message: z.string().min(1).max(100),
    optional: z.string().optional(),
  }),
  invoke: jest.fn(
    async (arg: { message: string; optional?: string }) =>
      `String action invoked with ${arg.message}${arg.optional ? ` and ${arg.optional}` : ""}`,
  ),
};

const mockNumberAction = {
  name: "testNumberAction",
  description: "A test action with number parameter",
  schema: z.object({
    amount: z.number().min(0).max(1000),
    count: z.number().int(),
  }),
  invoke: jest.fn(
    async (arg: { amount: number; count: number }) =>
      `Number action invoked with amount ${arg.amount} and count ${arg.count}`,
  ),
};

const mockComplexAction = {
  name: "testComplexAction",
  description: "A test action with complex parameters",
  schema: z.object({
    user: z.object({
      name: z.string(),
      age: z.number().optional(),
    }),
    tags: z.array(z.string()),
    status: z.enum(["active", "inactive", "pending"]),
    metadata: z.record(z.string()),
    isEnabled: z.boolean(),
  }),
  invoke: jest.fn(async (arg: unknown) => `Complex action invoked with ${JSON.stringify(arg)}`),
};

const mockUnionAction = {
  name: "testUnionAction",
  description: "A test action with union types",
  schema: z.object({
    value: z.union([z.literal("option1"), z.literal("option2"), z.literal("option3")]),
    nullableField: z.string().nullable(),
  }),
  invoke: jest.fn(async (arg: unknown) => `Union action invoked with ${JSON.stringify(arg)}`),
};

describe("getGeminiTools", () => {
  let mockAgentKit: AgentKit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentKit = {
      getActions: jest.fn(() => [
        mockStringAction,
        mockNumberAction,
        mockComplexAction,
        mockUnionAction,
      ]),
    } as unknown as AgentKit;
  });

  it("should return an array of FunctionDeclaration objects", () => {
    const tools = getGeminiTools(mockAgentKit);

    expect(tools).toHaveLength(4);
    expect(tools[0]).toHaveProperty("name");
    expect(tools[0]).toHaveProperty("description");
    expect(tools[0]).toHaveProperty("parameters");
  });

  it("should correctly convert string schema", () => {
    const tools = getGeminiTools(mockAgentKit);
    const stringTool = tools.find(t => t.name === "testStringAction");

    expect(stringTool).toBeDefined();
    expect(stringTool?.name).toBe("testStringAction");
    expect(stringTool?.description).toBe("A test action with string parameter");
    expect(stringTool?.parameters).toEqual({
      type: "object",
      properties: {
        message: {
          type: "string",
          minLength: 1,
          maxLength: 100,
        },
        optional: {
          type: "string",
        },
      },
      required: ["message"],
    });
  });

  it("should correctly convert number schema", () => {
    const tools = getGeminiTools(mockAgentKit);
    const numberTool = tools.find(t => t.name === "testNumberAction");

    expect(numberTool).toBeDefined();
    expect(numberTool?.parameters).toEqual({
      type: "object",
      properties: {
        amount: {
          type: "number",
          minimum: 0,
          maximum: 1000,
        },
        count: {
          type: "integer",
        },
      },
      required: ["amount", "count"],
    });
  });

  it("should correctly convert complex schema with nested objects, arrays, enums", () => {
    const tools = getGeminiTools(mockAgentKit);
    const complexTool = tools.find(t => t.name === "testComplexAction");

    expect(complexTool).toBeDefined();
    expect(complexTool?.parameters).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name"],
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        status: {
          type: "string",
          enum: ["active", "inactive", "pending"],
        },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        isEnabled: {
          type: "boolean",
        },
      },
      required: ["user", "tags", "status", "metadata", "isEnabled"],
    });
  });

  it("should correctly convert union types to enum when all are literals", () => {
    const tools = getGeminiTools(mockAgentKit);
    const unionTool = tools.find(t => t.name === "testUnionAction");

    expect(unionTool).toBeDefined();
    if (unionTool && unionTool.parameters && unionTool.parameters.properties) {
      expect(unionTool.parameters.properties.value).toEqual({
        type: "string",
        enum: ["option1", "option2", "option3"],
      });
      expect(unionTool.parameters.properties.nullableField).toEqual({
        type: "string",
        nullable: true,
      });
    }
  });

  it("should handle empty actions array", () => {
    const emptyAgentKit = {
      getActions: jest.fn(() => []),
    } as unknown as AgentKit;

    const tools = getGeminiTools(emptyAgentKit);
    expect(tools).toHaveLength(0);
  });
});

describe("executeGeminiFunction", () => {
  let mockAgentKit: AgentKit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentKit = {
      getActions: jest.fn(() => [mockStringAction, mockNumberAction, mockComplexAction]),
    } as unknown as AgentKit;
  });

  it("should execute a function call successfully", async () => {
    const functionCall = {
      name: "testStringAction",
      args: { message: "Hello World" },
    };

    const result = await executeGeminiFunction(mockAgentKit, functionCall);

    expect(result).toBe("String action invoked with Hello World");
    expect(mockStringAction.invoke).toHaveBeenCalledWith({ message: "Hello World" });
  });

  it("should throw error for non-existent function", async () => {
    const functionCall = {
      name: "nonExistentFunction",
      args: { test: "data" },
    };

    await expect(executeGeminiFunction(mockAgentKit, functionCall)).rejects.toThrow(
      "Function nonExistentFunction not found in AgentKit actions",
    );
  });

  it("should throw error for invalid arguments", async () => {
    const functionCall = {
      name: "testStringAction",
      args: { invalidArg: "value" }, // Missing required 'message' field
    };

    await expect(executeGeminiFunction(mockAgentKit, functionCall)).rejects.toThrow(
      "Invalid arguments for testStringAction",
    );
  });
});