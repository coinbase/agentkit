# create-onchain-agent

## Overview

`create-onchain-agent` is a CLI tool powered by [AgentKit](https://github.com/coinbase/agentkit) that provides multiple utilities for creating and integrating onchain agents into your projects. Whether you're starting a new project or adding AgentKit to an existing application, this tool offers flexible options to meet your needs.

## Prerequisites

Before using `create-onchain-agent`, ensure you have the following installed:

- **Node.js** (v22 or later) – [Download here](https://nodejs.org/)
- **npm** (v10 or later) – Comes bundled with Node.js

## Usage

### Quickstart Templates

To create a new project from scratch:

```sh
npm create onchain-agent@latest
```

This command lets you choose between two project templates:
- **Next.js Template**: A full-stack web application with React, Tailwind CSS, and ESLint
- **MCP Template**: A Model Context Protocol server project

### LLM Provider Configuration
By default, the template connects to OpenAI utilizing `gpt-4o-mini`. However, `create-onchain-agent` is fully provider-agnostic and works with any OpenAI-compatible API out of the box (e.g. Anthropic, Google Gemini, OpenRouter, Groq, Ollama). 

To use a different provider, simply update the `.env` variables after generating your project:
- `AI_API_KEY`: Your provider's API key
- `AI_BASE_URL`: The OpenAI-compatible endpoint for your provider (e.g., `https://api.anthropic.com/v1/`)
- `AI_MODEL`: Your preferred model (e.g., `claude-3-5-sonnet-latest`)

### Component Generation

After installing the `create-onchain-agent` CLI, you will also have the `agenkit` CLI installed. This allows you to generate components for your project.

```sh
# Generate a custom wallet provider
agentkit generate wallet-provider

# Generate a custom action provider
agentkit generate action-provider

# Generate framework-agnostic AgentKit setup.
agentkit generate prepare

# Generate framework-specific agent creation
agentkit generate create-agent
```

> **Note**: If the above commands print the error `agentkit: not found`, ensure the agentkit cli is installed by running the following command:
> ```bash
> npm install -g create-onchain-agent@latest
> ```

## Features

- **Multiple project templates**:
  - Next.js template for web applications
  - MCP template for Model Context Protocol servers
- **Component generators** for existing projects
- **Guided setup** with interactive prompts
- **Support for multiple AI frameworks**
- **Support for multiple blockchain networks**
- **Flexible wallet provider options**
- **Automated environment setup**

## Documentation & Support

- **Docs:** [https://docs.cdp.coinbase.com/agentkit/docs/welcome](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- **GitHub Repo:** [http://github.com/coinbase/agentkit](http://github.com/coinbase/agentkit)
- **Community & Support:** [https://discord.gg/CDP](https://discord.gg/CDP)
