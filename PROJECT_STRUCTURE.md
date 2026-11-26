# Organizing an AgentKit application

Start with a working example or `create-onchain-agent`, then split the application as its responsibilities grow. The layouts below are optional conventions for applications built with AgentKit; they describe your application's files, rather than the structure of this repository.

AgentKit connects a wallet provider to action providers. A framework extension exposes those actions as tools to your chosen AI framework. Your application wires these components together and owns authentication, persistence, and how agent runs are started and stopped.

## Separate responsibilities

| Component | Responsibility | Where to put it |
| --- | --- | --- |
| Configuration | Load and validate environment variables and application settings | `config.ts` or `config/` |
| Wallet setup | Select the network and initialize the authorized wallet provider | `prepare-agentkit.ts` or `wallets/` |
| Actions | Define domain operations, input schemas, and supported networks | `actions/` |
| Agent definition | Select the model, adapt AgentKit actions into tools, and configure prompts and memory | `agent.ts` or `agents/` |
| Application runtime | Authenticate requests, assemble dependencies, invoke agents, and manage shutdown | `main.ts`, `api/`, or `workers/` |
| State | Store wallet identifiers, conversation checkpoints, and job progress | A persistence adapter backed by your application's storage |

Keep wallet and model initialization out of individual action methods. Pass dependencies to the code that uses them, so actions can be tested with a mock wallet provider and entry points can reuse the same agent setup.

## A small application

A CLI chatbot or single-agent service can start with a few modules:

```text
my-agent/
├── src/
│   ├── config.ts             # Validate environment and choose network/wallet
│   ├── prepare-agentkit.ts   # Initialize wallet and select action providers
│   ├── agent.ts              # Configure model, tools, and conversation state
│   ├── main.ts               # Start the CLI or HTTP server
│   └── actions/              # Application-specific action providers, if needed
├── tests/
├── .env.example              # Document settings without secrets
├── .gitignore
└── package.json
```

For Python, the same separation can use `config.py`, `prepare_agentkit.py`, `agent.py`, and `main.py` inside an application package, with a `pyproject.toml` at the project root. Use the APIs and framework extension for your language; the Python and TypeScript packages have different configuration interfaces.

For example, `prepare-agentkit.ts` can own the AgentKit wiring independently of the HTTP or CLI interface:

```typescript
import {
  AgentKit,
  CdpEvmWalletProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";

export async function prepareAgentKit(config: { address: `0x${string}`; networkId: string }) {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet(config);
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [walletActionProvider(), erc20ActionProvider()],
  });

  return { agentkit, walletProvider };
}
```

Load the required `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, and `CDP_WALLET_SECRET` environment variables in the entry point before calling this factory. Pass a validated network and the authorized wallet's existing address from your application configuration or storage. This example requires an address to make wallet reuse explicit. Provision new wallets in a separate flow and persist their identifiers before serving requests.

In `agent.ts`, use the appropriate framework extension to convert the returned `agentkit` into tools, then create the framework's agent with those tools, the model, and its state configuration. For instance, the [LangChain agent template](./typescript/create-onchain-agent/templates/createAgent/framework/langchain/createAgent.ts) separates this step from wallet setup. `main.ts` calls that setup and handles input/output.

The example action providers include transfers and approvals. Choose capabilities deliberately and follow the [risk guidance](./README.md#%EF%B8%8F-managing-risk) before exposing a funded wallet to users or external content.

## A larger application

Introduce more boundaries when you add multiple entry points, agents, wallets, or persistence backends:

```text
my-agent-service/
├── src/
│   ├── config/
│   ├── api/
│   │   └── chat.ts           # Request authentication, validation, and streaming
│   ├── workers/
│   │   └── jobs.ts           # Background job handling and shutdown
│   ├── runtime/
│   │   └── create-runtime.ts # Assemble dependencies for an authorized identity
│   ├── agents/
│   │   ├── support.ts        # Model, prompt, and tools for one agent role
│   │   └── payments.ts       # A separate role and capability set
│   ├── actions/
│   ├── wallets/
│   │   └── wallet-store.ts   # Resolve persisted wallet/network ownership
│   ├── state/
│   │   ├── conversations.ts  # Framework checkpoints or conversation history
│   │   └── jobs.ts           # Durable job progress and transaction references
│   └── main.ts
└── tests/
    ├── actions/
    ├── agents/
    └── runtime/
```

The entry point authenticates the caller and resolves the intended wallet and conversation. The runtime factory receives those dependencies, initializes the wallet provider and AgentKit, and passes the selected tools to an agent factory. The agent factory should not need to know whether the caller is an HTTP handler or a worker.

Add modules when they have a distinct responsibility or need different tests. You do not need a package for every agent or action provider. Several agents can share action implementations while receiving different tools, wallets, and conversation state.

## HTTP requests and background workers

Both entry points can use the same setup code, but their runtime lifetimes differ:

| Concern | Request-based service | Long-running worker |
| --- | --- | --- |
| Initialization | Resolve or create a runtime for the authenticated wallet and capability set | Initialize the appropriate runtime when starting work for that identity |
| Invocation | Invoke or stream the agent for the current request | Invoke the agent in response to a queued job or scheduled task |
| Conversation state | Use a conversation identifier scoped to the authenticated user | Associate state with the job and intended conversation |
| Durability | Use durable storage when requests can reach different processes | Persist progress so work can resume after a restart |
| Lifecycle | Respect request cancellation and deadlines through the framework and transport | Stop accepting new jobs on shutdown and finish or checkpoint in-flight work |

AgentKit does not provide the HTTP server, job queue, scheduler, or conversation database. Implement these in your application or use the corresponding features of your framework and hosting platform. Cancellation also cannot undo a transaction that has already been broadcast.

For a single-wallet application, a process can reuse the initialized runtime. In a multi-user service, avoid one global agent bound to whichever wallet was initialized first. Scope any runtime cache to the authorized identity, wallet, network, and capability configuration; keep conversation checkpoints separately scoped to each conversation. In-memory state is local to a process and is lost on restart.

## Keep wallet, conversation, and job state distinct

- **Wallet state** identifies the wallet and network an identity may use. Persist this mapping so repeated requests and restarts reuse the intended wallet. Store credentials through your deployment's secret management, outside prompts and conversation history.
- **Conversation state** belongs to the chosen AI framework. Give each conversation its own identifier; an example's fixed checkpoint identifier is suitable for a single conversation demo.
- **Job state** tracks work across attempts. Record submitted transaction hashes and reconcile their status before deciding whether to retry an operation that moves funds. A lost response does not establish that a transaction failed.

When multiple runs use the same wallet, coordinate submissions and any application spending policy across those runs. A different conversation identifier separates chat history; it does not isolate wallet balances or concurrent transactions.

## Refactor incrementally

1. Start with a working example and keep its behavior while moving environment validation to a configuration module.
2. Extract wallet and action-provider setup into a factory. Supply persisted wallet identifiers explicitly.
3. Extract model, framework tools, prompts, and checkpoint setup into the agent definition.
4. Keep CLI, HTTP, and job handling in entry points that call those factories.
5. Add persistence adapters and more modules when you introduce restarts, multiple users, or background work.

Test custom actions with mocked provider dependencies, agent setup with the expected tool set, and request/worker boundaries with isolated identities and state. Keep live-network integration checks separate so routine tests do not need funded wallets.

## Existing examples

- [TypeScript LangChain chatbot](./typescript/examples/langchain-cdp-chatbot/chatbot.ts): wallet, AgentKit, framework, and CLI setup together in one example.
- [TypeScript CDP wallet setup template](./typescript/create-onchain-agent/templates/prepareAgentkit/agentkit/evm/cdp/prepareAgentkit.ts): wallet persistence and action-provider selection.
- [TypeScript LangChain agent template](./typescript/create-onchain-agent/templates/createAgent/framework/langchain/createAgent.ts): model, framework tools, and checkpointer setup.
- [Next.js LangChain request handler](./typescript/create-onchain-agent/templates/next/app/api/agent/framework/langchain/route.ts): an HTTP entry point for a scaffolded agent.
- [Python LangChain chatbot](./python/examples/langchain-cdp-chatbot/chatbot.py): wallet persistence, framework setup, and interactive/background modes in Python.

These examples are starting points. Adapt their wallet ownership, state identifiers, and runtime lifetimes to your application's users and deployment.
