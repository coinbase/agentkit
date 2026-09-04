import { execFile } from "child_process";
import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  ListTasksSchema,
  GetTaskSchema,
  GetMySubmissionsSchema,
  SubmitWorkSchema,
  CreateTaskSchema,
} from "./schemas";

/**
 * TaskmarketActionProvider is an action provider for Taskmarket
 * (https://taskmarket.dev) — an on-chain bounty marketplace for AI agents.
 *
 * It enables an agent to discover open bounty work, inspect a precise task,
 * and track its own submissions by delegating to the `taskmarket` CLI.
 * State-changing actions (`submit_work`, `create_task`) are gated behind an
 * explicit `confirm` input so funds and on-chain state are never touched
 * without user authorization.
 */
export class TaskmarketActionProvider extends ActionProvider {
  private readonly cliPath: string;

  private readonly timeoutMs: number;

  /**
   * Constructor for the TaskmarketActionProvider class.
   *
   * @param cliPath - Path to the taskmarket CLI executable (default "taskmarket")
   * @param timeoutMs - Timeout for CLI invocations in milliseconds
   */
  constructor(cliPath = "taskmarket", timeoutMs = 60_000) {
    super("taskmarket", []);
    this.cliPath = cliPath;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Runs the taskmarket CLI with the given arguments and resolves with stdout.
   *
   * @param args - CLI arguments to pass through
   * @returns A promise resolving to the CLI stdout
   */
  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this.cliPath, args, { timeout: this.timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr && stderr.trim()) || error.message;
          reject(new Error(detail));
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Lists currently open Taskmarket tasks.
   *
   * @param args - Optional filters: status, limit, minimum reward, and tags
   * @returns A JSON string containing matching tasks or an error message
   */
  @CreateAction({
    name: "list_tasks",
    description: `This tool lists open tasks on Taskmarket, an on-chain bounty marketplace where agents earn USDC for completed digital work.

It takes the following optional inputs:
- status: task status filter (default "open")
- limit: maximum number of results (default 20)
- rewardMin: minimum reward in USDC
- tags: comma-separated tag filter

Important notes:
- Each result includes the task id (0x-prefixed hex), description, reward, expiry, and submission count
- Use get_task with the task id for full details before doing any work`,
    schema: ListTasksSchema,
  })
  async listTasks(args: z.infer<typeof ListTasksSchema>): Promise<string> {
    try {
      const cliArgs = ["task", "list", "--status", args.status, "--limit", String(args.limit)];
      if (args.rewardMin !== undefined && args.rewardMin !== null) {
        cliArgs.push("--reward-min", String(args.rewardMin));
      }
      if (args.tags) {
        cliArgs.push("--tags", args.tags);
      }
      return await this.run(cliArgs);
    } catch (error: unknown) {
      return `Error listing Taskmarket tasks: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets the full details of a single Taskmarket task.
   *
   * @param args - The task id to inspect
   * @returns A JSON string containing the task record or an error message
   */
  @CreateAction({
    name: "get_task",
    description: `This tool fetches the full details of one Taskmarket task by its 0x-prefixed hex id.

It takes the following inputs:
- taskId: the 0x-prefixed task id from list_tasks

Important notes:
- Returns description, reward, expiry, escrow transaction, submission count, awards, and lifecycle phase
- Check that submissionWindowOpen is true, stakeRequired is false, and the reward is escrowed before starting work`,
    schema: GetTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskSchema>): Promise<string> {
    try {
      return await this.run(["task", "get", args.taskId]);
    } catch (error: unknown) {
      return `Error getting Taskmarket task: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Lists submissions made by the configured Taskmarket wallet.
   *
   * @returns A JSON string containing the wallet's submissions or an error message
   */
  @CreateAction({
    name: "my_submissions",
    description: `This tool lists all Taskmarket submissions made by the configured wallet, across all tasks.

Important notes:
- Requires the taskmarket CLI to be authenticated (taskmarket init)
- Use it to track whether submissions were accepted, rejected, or awarded`,
    schema: GetMySubmissionsSchema,
  })
  async mySubmissions(): Promise<string> {
    try {
      return await this.run(["task", "my-submissions"]);
    } catch (error: unknown) {
      return `Error listing Taskmarket submissions: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Submits a file as work for a Taskmarket task. Requires explicit confirmation.
   *
   * @param args - Task id, file path, artifact role, and confirmation flag
   * @returns The CLI submission result or an error message
   */
  @CreateAction({
    name: "submit_work",
    description: `This tool submits a completed work file to a Taskmarket task.

It takes the following inputs:
- taskId: the 0x-prefixed task id
- filePath: local path of the deliverable file
- role: artifact role (preview, source, final, attachment; default final)
- confirm: must be explicitly set to true by the user to submit

Important notes:
- Submission anchors the artifact on-chain and cannot be undone; never call this without explicit user approval
- Re-check the task with get_task immediately before submitting to confirm the window is still open
- Returns the submission id when successful`,
    schema: SubmitWorkSchema,
  })
  async submitWork(args: z.infer<typeof SubmitWorkSchema>): Promise<string> {
    if (!args.confirm) {
      return "Submission not confirmed. Set confirm: true to submit work to this task. Submitting is irreversible and anchors the artifact on-chain.";
    }
    try {
      return await this.run([
        "task",
        "submit",
        args.taskId,
        "--file",
        args.filePath,
        "--role",
        args.role,
      ]);
    } catch (error: unknown) {
      return `Error submitting Taskmarket work: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Creates a new Taskmarket task, escrowing the reward in USDC. Requires explicit confirmation.
   *
   * @param args - Description, reward, duration, tags, and confirmation flag
   * @returns The CLI creation result or an error message
   */
  @CreateAction({
    name: "create_task",
    description: `This tool creates a new Taskmarket task so external workers can complete it for a USDC reward.

It takes the following inputs:
- description: full task specification shown to workers
- rewardUsdc: reward in USDC — this amount is escrowed from the wallet
- durationHours: hours until the task expires
- tags: optional comma-separated tags
- confirm: must be explicitly set to true by the user to create and escrow

Important notes:
- Creating a task spends the reward amount in USDC; never call this without explicit user approval
- Only create tasks for work the user actually wants delegated`,
    schema: CreateTaskSchema,
  })
  async createTask(args: z.infer<typeof CreateTaskSchema>): Promise<string> {
    if (!args.confirm) {
      return `Task creation not confirmed. Set confirm: true to escrow ${args.rewardUsdc} USDC and publish this task.`;
    }
    try {
      const cliArgs = [
        "task",
        "create",
        "--description",
        args.description,
        "--reward",
        String(args.rewardUsdc),
        "--duration",
        String(args.durationHours),
      ];
      if (args.tags) {
        cliArgs.push("--tags", args.tags);
      }
      return await this.run(cliArgs);
    } catch (error: unknown) {
      return `Error creating Taskmarket task: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Taskmarket action provider supports the given network.
   * Taskmarket settles on Base but discovery is network-agnostic, so this always returns true.
   *
   * @returns True, as Taskmarket actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the TaskmarketActionProvider.
 *
 * @returns A new TaskmarketActionProvider instance
 */
export const taskmarketActionProvider = () => new TaskmarketActionProvider();
