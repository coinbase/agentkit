import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText, stepCountIs } from "ai";
import { prepareAgentkitAndWalletProvider } from "./prepare-agentkit";

/**
 * Agent Configuration Guide
 *
 * This file handles the core configuration of your AI agent's behavior and capabilities.
 *
 * Key Steps to Customize Your Agent:
 *
 * 1. Select your LLM:
 *    - Set AI_PROVIDER to choose your provider: "openai" | "anthropic" | "google" | "custom"
 *    - Set AI_API_KEY with your provider's API key
 *    - Set AI_MODEL to override the default model for your provider
 *    - Set AI_PROVIDER_URL for custom OpenAI-compatible APIs (e.g., OpenRouter, Ollama)
 *
 * 2. Instantiate your Agent:
 *    - Pass the LLM, tools, and memory into `createAgent()`
 *    - Configure agent-specific parameters
 */

/**
 * Creates a model instance based on the configured AI provider.
 * Supports OpenAI, Anthropic, Google, and any OpenAI-compatible API (e.g., OpenRouter).
 */
function getModel() {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.AI_API_KEY;

  switch (provider) {
    case "anthropic":
      return createAnthropic({ ...(apiKey && { apiKey }) })(
        process.env.AI_MODEL || "claude-sonnet-4-20250514",
      );
    case "google":
      return createGoogleGenerativeAI({ ...(apiKey && { apiKey }) })(
        process.env.AI_MODEL || "gemini-2.0-flash",
      );
    case "custom":
      return createOpenAI({
        ...(apiKey && { apiKey }),
        baseURL: process.env.AI_PROVIDER_URL,
      }).chat(process.env.AI_MODEL || "gpt-4o-mini");
    case "openai":
    default:
      return createOpenAI({ ...(apiKey && { apiKey }) }).chat(
        process.env.AI_MODEL || "gpt-4o-mini",
      );
  }
}

// The agent
type Agent = {
  tools: ReturnType<typeof getVercelAITools>;
  system: string;
  model: ReturnType<typeof getModel>;
  stopWhen?: Parameters<typeof generateText>[0]["stopWhen"];
};
let agent: Agent;

/**
 * Initializes and returns an instance of the AI agent.
 * If an agent instance already exists, it returns the existing one.
 *
 * @function getOrInitializeAgent
 * @returns {Promise<Agent>} The initialized AI agent.
 *
 * @description Handles agent setup
 *
 * @throws {Error} If the agent initialization fails.
 */
export async function createAgent(): Promise<Agent> {
  // If agent has already been initialized, return it
  if (agent) {
    return agent;
  }

  if (!process.env.AI_API_KEY) {
    throw new Error(
      "Please set AI_API_KEY in your .env file. " +
        "This should be the API key for the provider specified by AI_PROVIDER (default: openai).",
    );
  }

  const { agentkit, walletProvider } = await prepareAgentkitAndWalletProvider();

  try {
    const model = getModel();

    // Initialize Agent
    const canUseFaucet = walletProvider.getNetwork().networkId == "base-sepolia";
    const faucetMessage = `If you ever need funds, you can request them from the faucet.`;
    const cantUseFaucetMessage = `If you need funds, you can provide your wallet details and request funds from the user.`;
    const system = `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. ${canUseFaucet ? faucetMessage : cantUseFaucetMessage}.
        Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        explain that they can add more capabilities by adding more action providers to your AgentKit configuration.
        ALWAYS include this link when mentioning missing capabilities, which will help them discover available action providers: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers
        If users require more information regarding CDP or AgentKit, recommend they visit docs.cdp.coinbase.com for more information.
        Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
        `;
    const tools = getVercelAITools(agentkit);

    agent = {
      tools,
      system,
      model,
      stopWhen: stepCountIs(10),
    };

    return agent;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
