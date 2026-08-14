import { createHash } from "node:crypto";
import { z } from "zod";
import { keccak256 } from "viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  TaskMarketClaimTaskSchema,
  TaskMarketGetTaskSchema,
  TaskMarketListTasksSchema,
  TaskMarketMySubmissionsSchema,
  TaskMarketSubmitTextSchema,
} from "./schemas";

const DEFAULT_API_URL = "https://api.taskmarket.dev";
const READ_AUTH_ADDRESS_HEADER = "X-Taskmarket-Caller-Address";
const READ_AUTH_SIGNATURE_HEADER = "X-Taskmarket-Caller-Signature";

export interface TaskMarketActionProviderConfig {
  /** TaskMarket API origin. Defaults to https://api.taskmarket.dev. */
  apiUrl?: string;
  /**
   * Enables claim and submit actions. It is false by default so a read-only agent
   * cannot commit the wallet to a task or incur a relay fee accidentally.
   */
  allowWriteActions?: boolean;
  /** Request timeout in milliseconds. Defaults to 20 seconds. */
  requestTimeoutMs?: number;
  /** Maximum x402 payment in USDC for a write action. Defaults to 1 USDC. */
  maxPaymentUsdc?: number;
}

interface TaskMarketArtifact {
  artifactKey: string;
  fileName: string;
  mimeType: string;
  role: string;
  sizeBytes: number;
  sha256Hash: string;
  keccak256Hash: string;
}

type TaskMarketRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
};

/**
 * AgentKit actions for discovering and, when explicitly enabled, working on
 * TaskMarket tasks. Reads use the public REST API; wallet-bound actions sign
 * TaskMarket's documented intent messages with the configured EVM wallet.
 */
export class TaskMarketActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiUrl: string;
  private readonly allowWriteActions: boolean;
  private readonly requestTimeoutMs: number;
  private readonly maxPaymentUsdc: number;

  /**
   * Create a TaskMarket provider with read-only actions enabled by default.
   *
   * @param config - Provider configuration.
   */
  constructor(config: TaskMarketActionProviderConfig = {}) {
    super("taskmarket", []);
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.allowWriteActions = config.allowWriteActions ?? false;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 20_000;
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? 1;

    if (!/^https?:\/\//i.test(this.apiUrl)) {
      throw new Error("TaskMarket apiUrl must be an http(s) URL");
    }
    if (!Number.isFinite(this.maxPaymentUsdc) || this.maxPaymentUsdc < 0) {
      throw new Error("TaskMarket maxPaymentUsdc must be a non-negative finite number");
    }
  }

  /**
   * Search public TaskMarket tasks without using a wallet.
   *
   * @param args - Task search filters.
   * @returns The API response as formatted JSON.
   */
  @CreateAction({
    name: "list_tasks",
    description:
      "List public TaskMarket tasks. Use this to discover work before claiming or submitting anything.",
    schema: TaskMarketListTasksSchema,
  })
  async listTasks(args: z.infer<typeof TaskMarketListTasksSchema>): Promise<string> {
    const params = new URLSearchParams();
    params.set("status", args.status);
    if (args.phase) params.set("phase", args.phase);
    if (args.mode) params.set("mode", args.mode);
    if (args.tags?.length) params.set("tags", args.tags.join(","));
    if (args.rewardMin !== undefined) {
      params.set("minReward", String(Math.round(args.rewardMin * 1_000_000)));
    }
    if (args.rewardMax !== undefined) {
      params.set("maxReward", String(Math.round(args.rewardMax * 1_000_000)));
    }
    if (args.deadlineHours !== undefined) params.set("deadlineHours", String(args.deadlineHours));
    params.set("limit", String(args.limit));
    if (args.cursor) params.set("cursor", args.cursor);

    return this.request(`/api/tasks?${params.toString()}`);
  }

  /**
   * Retrieve the complete public record for a task.
   *
   * @param args - Task identifier.
   * @returns The API response as formatted JSON.
   */
  @CreateAction({
    name: "get_task",
    description: "Retrieve one public TaskMarket task by its task identifier.",
    schema: TaskMarketGetTaskSchema,
  })
  async getTask(args: z.infer<typeof TaskMarketGetTaskSchema>): Promise<string> {
    return this.request(`/api/tasks/${encodeURIComponent(args.taskId)}`);
  }

  /**
   * List submissions for the current wallet, with TaskMarket read authentication.
   *
   * @param walletProvider - Wallet used to sign the read request.
   * @param args - Optional task filter.
   * @returns The filtered API response as formatted JSON.
   */
  @CreateAction({
    name: "my_submissions",
    description: "List TaskMarket submissions made by the connected EVM wallet. This is read-only.",
    schema: TaskMarketMySubmissionsSchema,
  })
  async mySubmissions(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TaskMarketMySubmissionsSchema>,
  ): Promise<string> {
    const address = walletProvider.getAddress();
    const signature = await walletProvider.signMessage(`taskmarket:read:${address.toLowerCase()}`);
    const result = await this.requestJson<unknown>(
      `/api/submissions/mine?workerAddress=${encodeURIComponent(address)}`,
      {
        headers: {
          [READ_AUTH_ADDRESS_HEADER]: address,
          [READ_AUTH_SIGNATURE_HEADER]: signature,
        },
      },
    );
    if (args.taskId && Array.isArray(result)) {
      const filtered = result.filter(
        item => item && typeof item === "object" && "taskId" in item && item.taskId === args.taskId,
      );
      return JSON.stringify(filtered, null, 2);
    }
    if (
      args.taskId &&
      result &&
      typeof result === "object" &&
      "submissions" in result &&
      Array.isArray(result.submissions)
    ) {
      const filtered = result.submissions.filter(
        item => item && typeof item === "object" && "taskId" in item && item.taskId === args.taskId,
      );
      return JSON.stringify({ ...result, submissions: filtered }, null, 2);
    }
    return JSON.stringify(result, null, 2);
  }

  /**
   * Claim a task after the caller explicitly enabled write actions.
   *
   * @param walletProvider - Wallet submitting the claim.
   * @param args - Task identifier.
   * @returns The API response as formatted JSON.
   */
  @CreateAction({
    name: "claim_task",
    description:
      "Claim a TaskMarket task for the connected wallet. This is an external side effect and is disabled unless allowWriteActions is true.",
    schema: TaskMarketClaimTaskSchema,
  })
  async claimTask(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TaskMarketClaimTaskSchema>,
  ): Promise<string> {
    this.assertWritesEnabled();
    const signature = await walletProvider.signMessage(`taskmarket:claim:${args.taskId}`);
    return this.request(`/api/tasks/${encodeURIComponent(args.taskId)}/claim`, {
      method: "POST",
      body: {
        taskId: args.taskId,
        workerAddress: walletProvider.getAddress(),
        signature,
      },
    });
  }

  /**
   * Submit one explicit text artifact through TaskMarket's upload-key flow.
   *
   * @param walletProvider - Wallet submitting the artifact.
   * @param args - Explicit artifact contents and task metadata.
   * @returns The API response as formatted JSON.
   */
  @CreateAction({
    name: "submit_text",
    description:
      "Submit one explicitly provided text artifact to TaskMarket. This uploads content and may incur a relay fee; it is disabled unless allowWriteActions is true.",
    schema: TaskMarketSubmitTextSchema,
  })
  async submitText(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TaskMarketSubmitTextSchema>,
  ): Promise<string> {
    this.assertWritesEnabled();
    const workerAddress = walletProvider.getAddress();
    const content = new TextEncoder().encode(args.content);
    const uploadSignature = await walletProvider.signMessage(`taskmarket:submit:${args.taskId}`);
    const uploadResponse = await this.requestJson<{ uploadUrl: string; artifactKey: string }>(
      `/api/tasks/${encodeURIComponent(args.taskId)}/submissions/request-upload-url`,
      {
        method: "POST",
        body: {
          taskId: args.taskId,
          workerAddress,
          signature: uploadSignature,
          fileName: args.fileName,
          mimeType: args.mimeType,
          role: args.role,
          sizeBytes: content.byteLength,
        },
      },
    );

    const upload = uploadResponse;
    const uploadResult = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": args.mimeType },
      body: content,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!uploadResult.ok) {
      throw new Error(`TaskMarket artifact upload failed with status ${uploadResult.status}`);
    }

    const artifact: TaskMarketArtifact = {
      artifactKey: upload.artifactKey,
      fileName: args.fileName,
      mimeType: args.mimeType,
      role: args.role,
      sizeBytes: content.byteLength,
      sha256Hash: createHash("sha256").update(content).digest("hex"),
      keccak256Hash: keccak256(content),
    };
    const submitSignature = await walletProvider.signMessage(
      `taskmarket:submit:${args.taskId}:${artifact.artifactKey}`,
    );

    return this.requestWithX402(
      `/api/tasks/${encodeURIComponent(args.taskId)}/submissions/from-keys`,
      walletProvider,
      {
        method: "POST",
        body: {
          taskId: args.taskId,
          workerAddress,
          artifacts: [artifact],
          signature: submitSignature,
        },
      },
    );
  }

  /**
   * Check whether this provider can run with an EVM network.
   *
   * @param network - Network descriptor supplied by AgentKit.
   * @returns Whether the network uses the EVM protocol family.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily.toLowerCase() === "evm";
  }

  /**
   * Throw before any wallet-bound write action when writes are not approved.
   */
  private assertWritesEnabled(): void {
    if (!this.allowWriteActions) {
      throw new Error(
        "TaskMarket write actions are disabled. Set allowWriteActions: true only after reviewing the task and approving the side effect.",
      );
    }
  }

  /**
   * Request JSON and return it in the string format expected by AgentKit actions.
   *
   * @param path - API path.
   * @param options - Request options.
   * @returns Formatted JSON response.
   */
  private async request(path: string, options: TaskMarketRequestOptions = {}): Promise<string> {
    const result = await this.requestJson<unknown>(path, options);
    return JSON.stringify(result, null, 2);
  }

  /**
   * Request JSON with x402 payment handling for the final submission call.
   *
   * @param path - API path.
   * @param walletProvider - Wallet used to authorize the x402 payment.
   * @param options - Request options.
   * @returns Formatted JSON response.
   */
  private async requestWithX402(
    path: string,
    walletProvider: EvmWalletProvider,
    options: TaskMarketRequestOptions = {},
  ): Promise<string> {
    const client = await this.createX402Client(walletProvider);
    const result = await this.requestJson<unknown>(
      path,
      options,
      wrapFetchWithPayment(fetch, client),
    );
    return JSON.stringify(result, null, 2);
  }

  /**
   * Perform a TaskMarket request with timeout and structured error handling.
   *
   * @param path - API path.
   * @param options - Request options.
   * @param fetchImplementation - Fetch implementation, optionally wrapped for x402 payments.
   * @returns Parsed response payload.
   */
  private async requestJson<T>(
    path: string,
    options: TaskMarketRequestOptions = {},
    fetchImplementation: typeof fetch = fetch,
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetchImplementation(`${this.apiUrl}${path}`, {
      ...options,
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined || typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(this.requestTimeoutMs),
    });

    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Preserve non-JSON error bodies for diagnostics.
    }
    if (!response.ok) {
      throw new Error(
        `TaskMarket request failed with status ${response.status}: ${JSON.stringify(payload)}`,
      );
    }
    return payload as T;
  }

  /**
   * Create an x402 client for the connected EVM wallet and apply the payment cap.
   *
   * @param walletProvider - Wallet used to sign the payment authorization.
   * @returns Configured x402 client.
   */
  private async createX402Client(walletProvider: EvmWalletProvider): Promise<x402Client> {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      readContract: (args: {
        address: `0x${string}`;
        abi: readonly unknown[];
        functionName: string;
        args?: readonly unknown[];
      }) =>
        walletProvider.readContract({
          address: args.address,
          abi: args.abi as never,
          functionName: args.functionName as never,
          args: args.args as never,
        }),
    };
    registerExactEvmScheme(client, { signer });

    const maxPaymentBaseUnits = BigInt(Math.round(this.maxPaymentUsdc * 1_000_000));
    client.registerPolicy((_version, requirements) => {
      const affordable = requirements.filter(requirement => {
        try {
          return BigInt(requirement.amount) <= maxPaymentBaseUnits;
        } catch {
          return false;
        }
      });
      if (affordable.length === 0) {
        throw new Error(
          `TaskMarket x402 payment exceeds the configured ${this.maxPaymentUsdc} USDC limit`,
        );
      }
      return affordable;
    });

    return client;
  }
}

export const taskMarketActionProvider = (config: TaskMarketActionProviderConfig = {}) =>
  new TaskMarketActionProvider(config);
