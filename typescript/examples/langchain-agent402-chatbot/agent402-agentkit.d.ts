// Types for the agent402-agentkit action provider (the package ships JavaScript).
declare module "agent402-agentkit" {
  import type { ActionProvider } from "@coinbase/agentkit";

  export interface Agent402ActionOptions {
    /** Agent402 base URL (default https://agent402.tools) */
    baseUrl?: string;
    /** fetch used for free discovery and as the base of the paying fetch */
    fetchImpl?: typeof fetch;
    /** ceiling on one paid call in USD (default 1) */
    maxPerCallUsd?: number;
    /** ceiling on rolling-24h paid spend in USD */
    dailyLimitUsd?: number | null;
    /** ceiling on rolling-24h paid spend to one seller host in USD */
    maxPerHostUsd?: number | null;
    /** only pay these payTo addresses (lowercased EVM) */
    payees?: string[] | null;
  }

  export interface Agent402Action {
    name: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke: (...args: any[]) => Promise<string>;
  }

  export function agent402Actions(opts?: Agent402ActionOptions): Promise<Agent402Action[]>;
  export function agent402ActionProvider(opts?: Agent402ActionOptions): Promise<ActionProvider>;
}
