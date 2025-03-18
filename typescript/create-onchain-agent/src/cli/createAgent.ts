import fs from "fs/promises";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { copyTemplate } from "../fileSystem.js";

type AgentFramework = "langchain" | "vercelAISDK";

/**
 * Creates an agent by selecting a framework and copying the appropriate template.
 * 
 * - Prompts user to select between LangChain and Vercel AI SDK frameworks
 * - Copies the selected framework's agent implementation
 * - Cleans up unused framework files
 */
export async function createAgent() {
    let result: prompts.Answers<"framework">;

    try {
        result = await prompts(
            [
                {
                    type: "select",
                    name: "framework",
                    message: pc.reset("Choose a framework:"),
                    choices: [
                        { title: "LangChain", value: "langchain" },
                        { title: "Vercel AI SDK", value: "vercel-ai-sdk" }
                    ] as { title: string; value: AgentFramework }[],
                }
            ],
            {
                onCancel: () => {
                    console.log("\nAgent creation cancelled.");
                    process.exit(0);
                },
            }
        );
    } catch (cancelled: unknown) {
        console.error("An error occurred during agent creation");
        process.exit(1);
    }

    const { framework } = result;

    try {
        const root = await copyTemplate("createAgent", "createAgent");

        // Copy the selected framework's implementation to the destination
        const selectedRoutePath = path.join(root, "framework", framework, "createAgent.ts");
        const newRoutePath = path.join(process.cwd(), "createAgent.ts");

        await fs.copyFile(selectedRoutePath, newRoutePath);
        
        // Clean up the temporary directory
        await fs.rm(root, { recursive: true, force: true });

        console.log(pc.green("\nSuccessfully created createAgent.ts"));
    } catch (error) {
        console.error("Error setting up createAgent:", error);
        process.exit(1);
    }
}