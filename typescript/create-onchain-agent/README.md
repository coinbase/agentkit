# create-onchain-agent

## Overview

`create-onchain-agent` is a CLI tool powered by [AgentKit](https://github.com/coinbase/agentkit) that allows developers to quickly scaffold an **onchain agent** project. This tool simplifies the setup process by generating a project with predefined configurations, including blockchain network selection, wallet providers, and framework setup.

## Prerequisites

Before using `create-onchain-agent`, ensure you have the following installed:

- **Node.js** (v18 or later) – [Download here](https://nodejs.org/)
- **npm** (v9 or later) – Comes bundled with Node.js

## Usage

To use `create-onchain-agent`, simply run:

```sh
npm create onchain-agent@latest
```

This command will guide you through setting up an onchain agent project by prompting for necessary configuration options.

## Features

- **Guided setup**: Interactive prompts help configure the project.
- **Supports multiple AI frameworks**.
- **Supports multiple blockchain networks**.
- **Select your preferred wallet provider**.
- **Supports a preconfigured Next.js project with React, Tailwind CSS, and ESLint**.
- **Supports a preconfigured Model Context Protocol Server project**.
- **Automates environment setup**.

### **Setup Process**
The CLI will prompt you for the following details:

1. **Project Name**: The name of your new onchain agent project.
2. **Package Name**: The npm package name (auto-formatted if needed).
3. **Framework**: Choose from available AI frameworks.
4. **Network**: Choose from available blockchain networks.
5. **Chain ID**: Specify if using a custom network.
6. **Wallet Provider**: Select a preferred method for wallet management.

After answering the prompts, the CLI will:

- Generate the project structure.
- Copy necessary template files.
- Configure the selected settings.
- Display next steps to get started.

## Getting Started

Once your project is created, navigate into the directory and install dependencies:

```sh
cd my-project
npm install
```

Then, configure your environment variables:

```sh
mv .env.local .env
```

Run the development server:

```sh
npm run dev
```

## Documentation & Support

- **Docs:** [https://docs.cdp.coinbase.com/agentkit/docs/welcome](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- **GitHub Repo:** [http://github.com/coinbase/agentkit](http://github.com/coinbase/agentkit)
- **Community & Support:** [https://discord.gg/CDP](https://discord.gg/CDP)
