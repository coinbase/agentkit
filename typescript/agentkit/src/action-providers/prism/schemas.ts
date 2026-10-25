import { z } from "zod";

export const GetModelsSchema = z
  .object({})
  .strip()
  .describe("List the models Prism serves, their prices, and whether a GPU is warm");

export const RunInferenceSchema = z
  .object({
    prompt: z.string().min(1).describe("The prompt to send to the model"),
    model: z
      .string()
      .nullable()
      .optional()
      .describe("Model to run, e.g. 'llama3.2:3b'. Defaults to the cheapest model Prism serves"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .max(1024)
      .nullable()
      .optional()
      .describe("Cap on generated tokens. The price scales with this cap, so keep it tight"),
  })
  .strip()
  .describe("Run one LLM generation on a rented GPU, paid per call with USDC");

export const RunBatchSchema = z
  .object({
    prompts: z
      .array(z.string().min(1))
      .min(1)
      .describe("Independent prompts, answered in the order given"),
    model: z
      .string()
      .nullable()
      .optional()
      .describe("Model to run for every prompt. Defaults to the cheapest model Prism serves"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .max(1024)
      .nullable()
      .optional()
      .describe("Per-prompt cap on generated tokens"),
  })
  .strip()
  .describe("Run many independent prompts in one paid call, spread across the GPUs Prism holds");

export const RunGpuCommandSchema = z
  .object({
    command: z.string().min(1).describe("Shell command to run on the GPU box, e.g. 'nvidia-smi'"),
  })
  .strip()
  .describe("Lease a GPU and run one shell command on it");

export const GetGpuJobSchema = z
  .object({
    jobId: z.string().min(1).describe("Job id returned by run_gpu_command"),
    token: z.string().min(1).describe("Bearer token returned by run_gpu_command"),
  })
  .strip()
  .describe("Read the status and output of a GPU command job");
