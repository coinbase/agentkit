# Agent Lifecycle States

This document describes the common lifecycle states that agents go through when using AgentKit with various AI frameworks.

## Table of Contents

- [Overview](#overview)
- [Lifecycle Phases](#lifecycle-phases)
  - [1. Initialization Phase](#1-initialization-phase)
  - [2. Ready State](#2-ready-state)
  - [3. Execution Loop](#3-execution-loop)
  - [4. State Persistence](#4-state-persistence)
- [Framework-Specific Behaviors](#framework-specific-behaviors)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Best Practices](#best-practices)

## Overview

AgentKit is a framework-agnostic toolkit that provides blockchain actions to AI agents. While AgentKit itself handles action execution, the agent's overall lifecycle is managed by the AI framework you choose (LangChain, OpenAI Agents SDK, Vercel AI SDK, PydanticAI, or Strands Agents).

Understanding these lifecycle states helps you:
- Debug agent behavior without inspecting internal code
- Implement proper error handling
- Design better user experiences
- Optimize performance and resource usage

## Lifecycle Phases

### 1. Initialization Phase

The initialization phase prepares your agent to execute blockchain actions. This is a one-time setup that occurs before the agent can process requests.

#### States in Initialization:

**1.1 Pre-Initialization**
- Environment variables validated (API keys, secrets)
- Wallet provider type selected (CDP, Smart Wallet, Privy, Viem, Solana)
- Network configuration determined (Base, Ethereum, Solana, etc.)

**1.2 AgentKit Creation**
```typescript
// TypeScript example
const agentkit = await AgentKit.from({
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
  cdpWalletSecret: process.env.CDP_WALLET_SECRET,
  actionProviders: [walletActionProvider(), erc20ActionProvider()],
});
```

```python
# Python example
agentkit = AgentKit(
    wallet_provider=wallet_provider,
    action_providers=[wallet_action_provider(), erc20_action_provider()],
)
```

During this state:
- Wallet provider initializes with credentials
- Action providers register their available actions
- Network compatibility validated for each action provider

**1.3 Tool Extraction**

AgentKit actions are converted to framework-specific tools:
- **LangChain**: `getLangChainTools()` → `StructuredTool[]`
- **Vercel AI SDK**: `getVercelAITools()` → `ToolSet`
- **OpenAI Agents SDK**: `get_openai_agents_sdk_tools()` → `FunctionTool[]`
- **PydanticAI**: `get_pydantic_ai_tools()` → `Tool[]`
- **Strands Agents**: `get_strands_tools()` → Agent tools

**1.4 Agent Creation**

The framework creates an agent instance with:
- LLM model initialized
- Tools/actions registered
- System prompt configured
- Memory/checkpoint system set up (if stateful)

At the end of initialization, the agent transitions to the **Ready** state.

### 2. Ready State

The agent is idle and waiting for input. In this state:
- All tools are available and validated
- Memory/conversation history is initialized
- The agent can accept user input or autonomous triggers
- No blockchain transactions are being executed

This is a stable, low-resource state where the agent remains between interactions.

### 3. Execution Loop

When the agent receives input, it enters a multi-step execution loop. This is the core operational phase where the agent reasons about and executes blockchain actions.

```
┌─────────────────────────────────────────────────────────┐
│ 1. REASONING (LLM analyzing request)                    │
│    - Agent examines available tools                     │
│    - LLM determines action plan                         │
│    - Thought/intermediate steps emitted                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. TOOL_SELECTION (Agent choosing action)               │
│    - Tool selected based on reasoning                   │
│    - Arguments validated against schema                 │
│    - Tool invocation prepared                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. EXECUTING (Tool running)                             │
│    - action.invoke() called                             │
│    - Blockchain transaction/API call executed           │
│    - Result formatted as string                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. OBSERVATION (Result processing)                      │
│    - Tool output returned to agent                      │
│    - LLM reads result                                   │
│    - Decides next action or conclude                    │
└─────────────────────────────────────────────────────────┘
                        ↓
                   ┌────┴────┐
                   ↓         ↓
            ┌──────────┐  ┌──────────────┐
            │ CONTINUE │  │ COMPLETE     │
            │ LOOP?    │  │              │
            └──────────┘  └──────────────┘
                   ↓         ↓
          (return to step 1) │
                             ↓
┌─────────────────────────────────────────────────────────┐
│ 5. RESPONDING (Final output)                            │
│    - Agent generates final response                     │
│    - Message added to history                           │
│    - Output streamed/returned to caller                 │
└─────────────────────────────────────────────────────────┘
                        ↓
                 [Return to READY state]
```

#### Key Characteristics:

- **Reasoning State**: The LLM analyzes the user's request and available actions. No blockchain transactions occur here.

- **Tool Selection State**: The agent chooses which action to execute and validates the arguments against the action's schema. Schema validation prevents malformed requests from reaching the blockchain.

- **Executing State**: This is where actual blockchain transactions or API calls happen. The `action.invoke()` method is called with validated arguments. This state may take several seconds for on-chain transactions.

- **Observation State**: The agent receives the result and decides whether to execute additional actions or provide a final response. This enables multi-step workflows (e.g., "check balance, then transfer funds").

- **Iteration Control**: Frameworks implement different limits:
  - **Vercel AI SDK**: `maxSteps` parameter (default: 10)
  - **LangChain**: No hard limit, relies on agent's reasoning
  - **OpenAI Agents SDK**: Configurable via agent settings

### 4. State Persistence

Stateful agents maintain context between interactions. Different frameworks handle persistence differently:

#### Conversation Memory

**LangChain**
- Uses `MemorySaver` as an in-memory checkpointer
- Requires `thread_id` in config to maintain conversation context
- Persists message history across turns

```typescript
const config = { configurable: { thread_id: "user-123" } };
const stream = await agent.stream({ messages: [...] }, config);
```

**Vercel AI SDK**
- Maintains in-memory `Message[]` array
- Application manages message history persistence
- Each call includes full conversation history

```typescript
const messages = [
  { role: "user", content: "What's my balance?" },
  { role: "assistant", content: "..." },
  // ... continues
];
```

**PydanticAI**
- Returns message history via `output.all_messages()`
- Application passes history to subsequent runs

```python
output = await agent.run(prompt, message_history=history)
history = output.all_messages()
```

#### Wallet Persistence

Examples typically save wallet data to files for multi-session continuity:
- File format: `wallet_data_*.txt` or `wallet_data_*.json`
- Contains: address, network_id, wallet secrets
- Enables the agent to use the same wallet across sessions

## Framework-Specific Behaviors

Different AI frameworks implement the execution loop with unique patterns:

### LangChain

**Pattern**: ReAct (Reasoning + Acting) with streaming

```typescript
const agent = createReactAgent({ llm, tools, checkpointSaver });
const stream = await agent.stream({ messages: [...] }, config);

for await (const chunk of stream) {
  if ("agent" in chunk) {
    // Agent is reasoning
  } else if ("tools" in chunk) {
    // Tools are executing
  }
}
```

**States**: Clearly separated reasoning and tool execution phases with streaming updates.

### Vercel AI SDK

**Pattern**: Streaming text generation with tool calls

```typescript
const stream = streamText({
  model,
  messages,
  tools,
  system: "...",
  maxSteps: 10,
});
```

**States**: Integrated reasoning and execution with automatic iteration control via `maxSteps`.

### OpenAI Agents SDK

**Pattern**: Built-in runner with execution loop

```python
agent = Agent(
    name="...",
    instructions="...",
    tools=tools,
    model="gpt-4o",
)
# Uses OpenAI's native agent execution
```

**States**: Managed by OpenAI's agents runtime with automatic retry and error handling.

### PydanticAI

**Pattern**: Async-first with type-annotated results

```python
output = await agent.run(prompt, message_history=history)
result = output.data  # Type-safe result
history = output.all_messages()
```

**States**: Type-safe execution with explicit message history management.

### Strands Agents

**Pattern**: Similar to OpenAI SDK with AWS Bedrock integration

**States**: Supports payment-gated actions via x402 protocol with service discovery.

## Error Handling and Recovery

Agents can encounter errors at various lifecycle states. Understanding these helps implement proper error handling:

### Schema Validation Errors

**State**: Tool Selection
**Cause**: Arguments don't match the action's schema
**Recovery**: Frameworks typically show the error to the LLM, which then retries with corrected arguments

### Execution Errors

**State**: Executing
**Cause**: Blockchain transaction fails, network errors, insufficient funds
**Recovery**:
- Error message returned to agent as observation
- Agent can retry with different parameters
- Application may implement exponential backoff for network errors

Example from swap utilities:
```python
async def retry_with_exponential_backoff(
    func, max_attempts=3, initial_delay=1.0
):
    """Retry function with exponential backoff"""
    # Implements retry logic for transient failures
```

### Iteration Limit Reached

**State**: Execution Loop
**Cause**: Agent exceeds `maxSteps` or equivalent limit
**Recovery**:
- Execution stops, returning partial results
- Agent may summarize what was accomplished
- Prevents infinite loops

### Network/Action Compatibility Errors

**State**: Initialization
**Cause**: Action provider doesn't support current network
**Recovery**:
- Warning logged during initialization
- Action unavailable to agent
- Agent continues with supported actions

## Best Practices

### For Initialization

1. **Validate Early**: Check environment variables before creating AgentKit
2. **Choose Network Carefully**: Some actions only work on specific networks (e.g., EVM vs Solana)
3. **Log Warnings**: Pay attention to action provider compatibility warnings
4. **Persist Wallet Data**: Save wallet information for session continuity

### For Execution

1. **Set Iteration Limits**: Use `maxSteps` or equivalent to prevent runaway execution
2. **Monitor Execution Time**: Blockchain transactions can take seconds; design UI accordingly
3. **Stream Updates**: Use streaming where available for better user experience
4. **Handle Async Operations**: Many actions are async; ensure proper await/promise handling

### For State Management

1. **Use Thread IDs**: Maintain separate conversation contexts for different users
2. **Clean Up Memory**: Clear old conversation histories to prevent memory bloat
3. **Backup Wallet Secrets**: Store wallet data securely for recovery
4. **Log State Transitions**: Track which lifecycle state caused issues for debugging

### For Error Handling

1. **Show Errors to Agent**: Let the LLM see error messages to enable self-correction
2. **Implement Retries**: Use exponential backoff for network errors
3. **Set Timeouts**: Don't wait indefinitely for blockchain confirmations
4. **Graceful Degradation**: If an action fails, agent should explain and suggest alternatives

## Debugging Agent Behavior

When debugging, identify which lifecycle state is causing issues:

| Symptom | Likely State | Investigation Steps |
|---------|--------------|---------------------|
| Agent won't start | Initialization | Check environment variables, API keys, network config |
| Agent doesn't respond | Ready → Reasoning | Verify LLM API connectivity, check rate limits |
| Wrong action chosen | Tool Selection | Review system prompt, check available tools |
| Transaction fails | Executing | Check wallet balance, network status, transaction params |
| Agent loops infinitely | Execution Loop | Set/lower `maxSteps`, review agent instructions |
| Lost conversation context | State Persistence | Verify thread_id usage, check memory saver config |

## Conclusion

AgentKit provides a consistent action execution interface across different AI frameworks. While the framework manages the overall agent lifecycle (reasoning, tool selection, execution), AgentKit ensures reliable blockchain action execution during the **Executing** state.

By understanding these lifecycle states, you can build more robust agents, debug issues effectively, and create better user experiences when building onchain AI applications.

## References

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [LangChain AgentKit Extension](https://github.com/coinbase/agentkit/tree/main/typescript/framework-extensions/langchain)
- [Vercel AI SDK Extension](https://github.com/coinbase/agentkit/tree/main/typescript/framework-extensions/vercel-ai-sdk)
- [OpenAI Agents SDK Extension](https://github.com/coinbase/agentkit/tree/main/python/framework-extensions/openai-agents-sdk)
- [PydanticAI Extension](https://github.com/coinbase/agentkit/tree/main/python/framework-extensions/pydantic-ai)
