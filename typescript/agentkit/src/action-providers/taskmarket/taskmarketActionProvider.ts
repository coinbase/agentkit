import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  GetTaskSchema,
  ListOpenTasksSchema,
  PrepareDelegationSchema,
  SubmitWorkSchema,
} from "./schemas";
import { TASKMARKET_API_BASE, TASKMARKET_DOCS, TASKMARKET_SITE } from "./constants";

function normalizeTaskId(taskIdOrUrl: string): string {
  const trimmed = taskIdOrUrl.trim();
  const fromUrl = trimmed.match(/tasks\/(0x[a-fA-F0-9]+)/);
  if (fromUrl) {
    return fromUrl[1];
  }
  return trimmed;
}

/**
 * TaskMarketActionProvider lets agents discover and (with explicit user auth)
 * prepare / submit work on TaskMarket — an on-chain USDC task marketplace.
 *
 * Security contract (bounty requirement):
 * - Browse/get are read-only and free.
 * - prepare_delegation never creates or funds a task by itself.
 * - submit_work refuses unless userAuthorized === true.
 * - This provider never requests private keys or bypasses wallet permissions.
 */
export class TaskMarketActionProvider extends ActionProvider {
  /**
   * Constructor for the TaskMarketActionProvider class.
   */
  constructor() {
    super("taskmarket", []);
  }

  /**
   * Lists open TaskMarket tasks.
   *
   * @param args - List filters
   * @returns JSON string of open tasks (truncated fields) or error
   */
  @CreateAction({
    name: "taskmarket_list_open_tasks",
    description: `This tool lists open funded tasks on TaskMarket (https://taskmarket.dev).
It takes optional limit (1-50), mode, and tags.

Important notes:
- Read-only and free — does not spend USDC or create tasks
- Use this when a user request is better delegated to external workers
- Returns task ids, rewards, modes, submission counts, and short descriptions
- See docs: ${TASKMARKET_DOCS}`,
    schema: ListOpenTasksSchema,
  })
  async listOpenTasks(args: z.infer<typeof ListOpenTasksSchema>): Promise<string> {
    try {
      const limit = args.limit ?? 10;
      const params = new URLSearchParams({
        status: "open",
        limit: String(limit),
      });
      if (args.mode) params.set("mode", args.mode);
      if (args.tags) params.set("tags", args.tags);

      const url = `${TASKMARKET_API_BASE}/api/tasks?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        tasks?: Array<Record<string, unknown>>;
      };
      const tasks = (data.tasks ?? []).map(t => ({
        id: t.id,
        mode: t.mode,
        rewardBaseUnits: t.reward,
        rewardUsdcApprox:
          t.reward != null ? Number(t.reward) / 1e6 : null,
        submissionCount: t.submissionCount,
        tags: t.tags,
        descriptionPreview:
          typeof t.description === "string"
            ? t.description.slice(0, 240).replace(/\s+/g, " ")
            : null,
        url: `${TASKMARKET_SITE}tasks/${t.id}`,
      }));
      return JSON.stringify(
        {
          count: tasks.length,
          tasks,
          note: "Read-only listing. Creating/funding tasks requires separate explicit user authorization.",
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error listing TaskMarket tasks: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Fetches one TaskMarket task by id or URL.
   *
   * @param args - Task id or URL
   * @returns JSON task detail or error
   */
  @CreateAction({
    name: "taskmarket_get_task",
    description: `This tool fetches a single TaskMarket task by id (0x…) or task URL.
Read-only and free. Use it to understand reward, deadline, mode, and deliverable requirements
before proposing delegation to the user.`,
    schema: GetTaskSchema,
  })
  async getTask(args: z.infer<typeof GetTaskSchema>): Promise<string> {
    try {
      const taskId = normalizeTaskId(args.taskId);
      const url = `${TASKMARKET_API_BASE}/api/tasks/${taskId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const t = (await response.json()) as Record<string, unknown>;
      return JSON.stringify(
        {
          id: t.id,
          mode: t.mode,
          status: t.status,
          rewardBaseUnits: t.reward,
          rewardUsdcApprox: t.reward != null ? Number(t.reward) / 1e6 : null,
          submissionCount: t.submissionCount,
          tags: t.tags,
          expiryTime: t.expiryTime,
          description: t.description,
          url: `${TASKMARKET_SITE}tasks/${t.id}`,
          authNote:
            "Inspect only. Do not create, fund, accept, or submit without explicit userAuthorized=true.",
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error fetching TaskMarket task: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Prepares a delegation draft. Never creates or funds a task.
   *
   * @param args - Draft fields + authorization flag
   * @returns Draft JSON for human review, or blocked message
   */
  @CreateAction({
    name: "taskmarket_prepare_delegation",
    description: `This tool DRAFTS a TaskMarket task delegation proposal for human review.
It does NOT create a task, escrow USDC, or call paid APIs.

Required inputs:
- description, rewardUsdc, durationHours, spendingLimitUsdc
- userAuthorized: set true ONLY after the human approved the draft parameters

If userAuthorized is false, returns a draft marked pending_approval.
If true, returns an approved_draft the operator may execute out-of-band with their wallet CLI
(subject to spendingLimitUsdc). Never silently spend.`,
    schema: PrepareDelegationSchema,
  })
  async prepareDelegation(
    args: z.infer<typeof PrepareDelegationSchema>,
  ): Promise<string> {
    if (args.rewardUsdc > args.spendingLimitUsdc) {
      return JSON.stringify({
        status: "rejected",
        reason: `rewardUsdc (${args.rewardUsdc}) exceeds spendingLimitUsdc (${args.spendingLimitUsdc})`,
      });
    }

    const draft = {
      site: TASKMARKET_SITE,
      docs: TASKMARKET_DOCS,
      mode: args.mode ?? "bounty",
      description: args.description,
      rewardUsdc: args.rewardUsdc,
      durationHours: args.durationHours,
      spendingLimitUsdc: args.spendingLimitUsdc,
      cliHint:
        `taskmarket task create --description ${JSON.stringify(args.description)} ` +
        `--reward ${args.rewardUsdc} --duration ${args.durationHours} --mode ${args.mode ?? "bounty"}`,
      warnings: [
        "Creating a task escrows USDC from the requester wallet.",
        "Only run the CLI after the human confirms and has funded their wallet intentionally.",
        "This tool never holds private keys.",
      ],
    };

    if (!args.userAuthorized) {
      return JSON.stringify(
        {
          status: "pending_approval",
          message:
            "Draft prepared. Present this to the user. Re-call with userAuthorized=true only after they approve.",
          draft,
        },
        null,
        2,
      );
    }

    return JSON.stringify(
      {
        status: "approved_draft",
        message:
          "User authorized the draft. Operator may run the CLI hint within spendingLimitUsdc. Provider does not auto-execute.",
        draft,
      },
      null,
      2,
    );
  }

  /**
   * Submits work only when the human has authorized the action.
   * This method returns a structured CLI instruction rather than embedding secrets.
   *
   * @param args - Submit request with userAuthorized gate
   * @returns Submission plan or hard refusal
   */
  @CreateAction({
    name: "taskmarket_submit_work",
    description: `This tool prepares a TaskMarket work submission for an EXISTING task.
It refuses unless userAuthorized=true.

It does not create tasks, accept work, or move funds.
Returns a safe submission plan / CLI hint the operator runs with their own TaskMarket worker identity.`,
    schema: SubmitWorkSchema,
  })
  async submitWork(args: z.infer<typeof SubmitWorkSchema>): Promise<string> {
    if (!args.userAuthorized) {
      return JSON.stringify({
        status: "blocked",
        reason:
          "userAuthorized=false. Refusing to submit. Ask the human to review the deliverable and re-call with userAuthorized=true.",
      });
    }

    const taskId = normalizeTaskId(args.taskId);
    const files = args.artifactPaths?.length
      ? args.artifactPaths
      : ["<path-to-deliverable>"];

    return JSON.stringify(
      {
        status: "authorized_submission_plan",
        taskId,
        deliverableSummary: args.deliverableSummary,
        artifacts: files,
        cliHints: files.map(
          f => `taskmarket task submit ${taskId} --file ${JSON.stringify(f)}`,
        ),
        notes: [
          "Worker submission to most bounties is free (no USDC required).",
          "Run the CLI from the operator machine that holds the TaskMarket keystore.",
          "Never paste private keys into the agent context.",
        ],
      },
      null,
      2,
    );
  }

  /**
   * TaskMarket is network-agnostic at the action layer (Base settlement is handled by TaskMarket).
   *
   * @returns true for all networks
   */
  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

/**
 * Factory for TaskMarketActionProvider.
 *
 * @returns New provider instance
 */
export const taskmarketActionProvider = () => new TaskMarketActionProvider();

