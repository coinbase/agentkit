import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent as createLangChainAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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
 * Creates an LLM instance based on the configured AI provider.
 * Supports OpenAI, Anthropic, Google, and any OpenAI-compatible API (e.g., OpenRouter).
 */
function getLLM() {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.AI_API_KEY;

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
        ...(apiKey && { apiKey }),
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || "gemini-2.0-flash",
        ...(apiKey && { apiKey }),
      });
    case "custom":
      return new ChatOpenAI({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        ...(apiKey && { apiKey }),
        configuration: { baseURL: process.env.AI_PROVIDER_URL },
      });
    case "openai":
    default:
      return new ChatOpenAI({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        ...(apiKey && { apiKey }),
      });
  }
}

// The agent
let agent: ReturnType<typeof createLangChainAgent>;

/**
 * Initializes and returns an instance of the AI agent.
 * If an agent instance already exists, it returns the existing one.
 *
 * @function getOrInitializeAgent
 * @returns {Promise<ReturnType<typeof createLangChainAgent>>} The initialized AI agent.
 *
 * @description Handles agent setup
 *
 * @throws {Error} If the agent initialization fails.
 */
export async function createAgent(): Promise<ReturnType<typeof createLangChainAgent>> {
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
    const llm = getLLM();

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();

    // Initialize Agent
    const canUseFaucet = walletProvider.getNetwork().networkId == "base-sepolia";
    const faucetMessage = `If you ever need funds, you can request them from the faucet.`;
    const cantUseFaucetMessage = `If you need funds, you can provide your wallet details and request funds from the user.`;
    agent = createLangChainAgent({
      model: llm,
      tools,
      checkpointer: memory,
      systemPrompt: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. ${canUseFaucet ? faucetMessage : cantUseFaucetMessage}.
        Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        explain that they can add more capabilities by adding more action providers to your AgentKit configuration.
        ALWAYS include this link when mentioning missing capabilities, which will help them discover available action providers: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers
        If users require more information regarding CDP or AgentKit, recommend they visit docs.cdp.coinbase.com for more information.
        Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
        `,
    });

    return agent;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
