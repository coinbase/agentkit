import * as dotenv from "dotenv";
import * as readline from "readline";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { ActionProvider, WalletProvider } from "@coinbase/agentkit";
import { ChatOpenAI } from "@langchain/openai";
import { AgentKit } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

dotenv.config();

/**
 * Configuration for creating an agent instance
 */
export interface AgentConfig {
  name: string;
  model: string;
  messageModifier: string;
  requiredEnv?: readonly string[];
  actionProviders: ActionProvider[];
}

/**
 * A React agent implementation using LangGraph for handling chat and autonomous interactions
 */
export class Agent {
  private langchainAgent?: ReturnType<typeof createReactAgent>;
  private runnableConfig?: Partial<RunnableConfig>;

  /**
   * Creates a new Agent instance
   *
   * @param config - Configuration for the agent
   * @param walletProvider - Provider for wallet interactions
   */
  constructor(
    private readonly config: AgentConfig,
    private readonly walletProvider: WalletProvider,
  ) {}

  /**
   * Starts the agent in the chosen mode (chat or autonomous)
   *
   * @returns Promise that resolves when the agent is stopped
   */
  async start(): Promise<void> {
    process.on("SIGINT", () => {
      console.log("\nExiting...");
      process.exit(0);
    });

    try {
      await this.initialize();
      const mode = await this.chooseMode();

      if (mode === "chat") {
        await this.startInteractiveMode();
      } else {
        await this.startAutonomousMode();
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "readline was closed") {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Initializes the agent with LangChain tools and configuration
   *
   * @returns Promise that resolves when initialization is complete
   */
  private async initialize(): Promise<void> {
    const agentkit = await AgentKit.from({
      walletProvider: this.walletProvider,
      actionProviders: this.config.actionProviders,
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();

    const llm = new ChatOpenAI({
      model: this.config.model,
    });

    this.langchainAgent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: this.config.messageModifier,
    });

    this.runnableConfig = {
      configurable: { thread_id: this.config.name },
    };
  }

  /**
   * Prompts the user to choose between chat and autonomous mode
   *
   * @returns The selected mode ('chat' or 'auto')
   */
  private async chooseMode(): Promise<"chat" | "auto"> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let validChoice = false;
    let choice: "chat" | "auto" = "chat";

    while (!validChoice) {
      console.log("\nAvailable modes:");
      console.log("1. chat - Interactive chat mode");
      console.log("2. auto - Autonomous action mode");

      const answer = await new Promise<string>(resolve =>
        rl.question("\nChoose a mode (enter number or name): ", resolve),
      );

      const input = answer.toLowerCase().trim();
      if (input === "1" || input === "chat") {
        choice = "chat";
        validChoice = true;
      } else if (input === "2" || input === "auto") {
        choice = "auto";
        validChoice = true;
      } else {
        console.log("Invalid choice. Please enter '1'/'chat' or '2'/'auto'");
      }
    }

    rl.close();
    return choice;
  }

  /**
   * Starts the agent in autonomous mode, continuously performing actions
   *
   * @returns Promise that resolves when autonomous mode is stopped
   */
  private async startAutonomousMode(): Promise<void> {
    if (!this.langchainAgent || !this.runnableConfig) {
      throw new Error("Agent not initialized");
    }

    console.log("Starting autonomous mode...");

    let running = true;
    while (running) {
      try {
        const thought =
          "Be creative and do something interesting on the blockchain. " +
          "Choose an action or set of actions and execute it that highlights your abilities.";

        const stream = await this.langchainAgent.stream(
          { messages: [new HumanMessage(thought)] },
          this.runnableConfig,
        );

        for await (const chunk of stream) {
          if (chunk.agent) {
            console.log(chunk.agent.messages[0].content);
          } else if (chunk.tools) {
            console.log(chunk.tools.messages[0].content);
          }
          console.log("-------------------");
        }

        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        console.error("Error in autonomous mode:", error);
        running = false;
        throw error;
      }
    }
  }

  /**
   * Starts the agent in interactive chat mode
   *
   * @returns Promise that resolves when chat mode is stopped
   */
  private async startInteractiveMode(): Promise<void> {
    if (!this.langchainAgent || !this.runnableConfig) {
      throw new Error("Agent not initialized");
    }

    console.log("Starting chat mode... Type 'exit' to end.");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> =>
      new Promise(resolve => rl.question(prompt, resolve));

    try {
      let running = true;
      while (running) {
        const userInput = await question("\nPrompt: ");

        if (userInput.toLowerCase() === "exit") {
          running = false;
          break;
        }

        const stream = await this.langchainAgent.stream(
          { messages: [new HumanMessage(userInput)] },
          this.runnableConfig,
        );

        for await (const chunk of stream) {
          if (chunk.agent) {
            console.log(chunk.agent.messages[0].content);
          } else if (chunk.tools) {
            console.log(chunk.tools.messages[0].content);
          }
          console.log("-------------------");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "readline was closed") {
        console.error("Error:", error.message);
        throw error;
      }
    } finally {
      rl.close();
    }
  }
}
