import * as dotenv from "dotenv";
import * as readline from "readline";
import { validateEnvironment } from "./env";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { ActionProvider, WalletProvider } from "@coinbase/agentkit";
import { ChatOpenAI } from "@langchain/openai";
import { AgentKit } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

dotenv.config();
validateEnvironment();

interface AgentConfig {
  threadId: string;
  model?: string;
  messageModifier?: string;
}

interface Agent {
  stream: (
    input: { messages: BaseMessage[] },
    options?: Partial<RunnableConfig<Record<string, any>>>
  ) => Promise<IterableReadableStream<StreamOutput>>;
}

type StreamOutput = {
  agent?: { messages: BaseMessage[] };
  tools?: { messages: BaseMessage[] };
};

type Mode = "chat" | "auto";

async function createChatAgent(
  walletProvider: WalletProvider,
  actionProviders: ActionProvider[],
  config: AgentConfig
): Promise<[Agent, Partial<RunnableConfig<Record<string, any>>>]> {
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders,
  });

  const tools = await getLangChainTools(agentkit);
  const memory = new MemorySaver();

  const llm = new ChatOpenAI({
    model: config.model || "gpt-4o-mini",
  });

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: config.messageModifier,
  });

  const runnableConfig = {
    configurable: { thread_id: config.threadId }
  };

  return [agent, runnableConfig];
}

async function chooseMode(): Promise<Mode> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat - Interactive chat mode");
    console.log("2. auto - Autonomous action mode");

    const answer = await new Promise<string>(resolve => 
      rl.question("\nChoose a mode (enter number or name): ", resolve)
    );

    rl.close();

    const choice = answer.toLowerCase().trim();
    if (choice === "1" || choice === "chat") return "chat";
    if (choice === "2" || choice === "auto") return "auto";

    console.log("Invalid choice. Please enter '1'/'chat' or '2'/'auto'");
  }
}

async function runAutonomousMode(
  agent: Agent,
  config: Partial<RunnableConfig<Record<string, any>>>
): Promise<void> {
  console.log("Starting autonomous mode...");

  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      const stream = await agent.stream(
        { messages: [new HumanMessage(thought)] },
        config
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
      process.exit(1);
    }
  }
}

async function runChatMode(
  agent: Agent,
  config: Partial<RunnableConfig<Record<string, any>>>
): Promise<void> {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream(
        { messages: [new HumanMessage(userInput)] },
        config
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
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

export async function startAgent(
  walletProvider: WalletProvider,
  actionProviders: ActionProvider[],
  config: AgentConfig
): Promise<void> {
  try {
    const [agent, runnableConfig] = await createChatAgent(walletProvider, actionProviders, config);
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, runnableConfig);
    } else {
      await runAutonomousMode(agent, runnableConfig);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Please import and use startAgent() with your own providers and config.");
  process.exit(1);
} 