import { createOpenAI } from "@ai-sdk/openai";
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
 *    - Set AI_API_KEY with your provider's API key
 *    - Set AI_MODEL to choose your model (default: gpt-4o-mini)
 *    - Set AI_BASE_URL to use a different provider (e.g., Anthropic, Google, OpenRouter)
 *    - All major providers support the OpenAI-compatible API format
 *
 * 2. Instantiate your Agent:
 *    - Pass the LLM, tools, and memory into `createAgent()`
 *    - Configure agent-specific parameters
 */

// The agent
type Agent = {
  tools: ReturnType<typeof getVercelAITools>;
  system: string;
  model: ReturnType<ReturnType<typeof createOpenAI>>;
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

  if (!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error(
      "Please set AI_API_KEY in your .env file. " +
        "This should be your API key for any OpenAI-compatible provider.",
    );
  }

  const { agentkit, walletProvider } = await prepareAgentkitAndWalletProvider();

  try {
    // Initialize LLM — works with any OpenAI-compatible provider.
    // Configure via env vars: AI_API_KEY, AI_BASE_URL, AI_MODEL
    // Examples:
    //   OpenAI:      AI_API_KEY=sk-... (no AI_BASE_URL needed)
    //   Anthropic:   AI_API_KEY=sk-ant-...  AI_BASE_URL=https://api.anthropic.com/v1/
    //   Google:      AI_API_KEY=AIza...     AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
    //   OpenRouter:  AI_API_KEY=sk-or-...   AI_BASE_URL=https://openrouter.ai/api/v1
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const provider = createOpenAI({
      ...(apiKey && { apiKey }),
      ...(process.env.AI_BASE_URL && { baseURL: process.env.AI_BASE_URL }),
    });
    const model = provider.chat(process.env.AI_MODEL || "gpt-4o-mini");

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
