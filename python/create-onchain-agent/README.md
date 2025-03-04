# create-onchain-agent

## Overview

`create-onchain-agent` is a CLI tool powered by [AgentKit](https://github.com/coinbase/agentkit) that allows developers to quickly scaffold an **onchain agent** project. This tool simplifies the setup process by generating a chatbot with predefined configurations, including blockchain network selection and wallet providers.

## Requirements

To use `create-onchain-agent`, you must first setup:
- **Python**: [Install Python](https://realpython.com/installing-python/) version 3.10 or 3.11
- **Pipx**: [Install pipx](https://pipx.pypa.io/stable/installation/) using Python version 3.10 or 3.11

**NOTE:** If you have multiple versions of Python installed, you can specify the Python version when installing pipx.

e.g.:
```sh
python3.10 -m pip install --user pipx
python3.10 -m pipx ensurepath
```

## Usage

To use `create-onchain-agent`, simply run:

```sh
pipx run create-onchain-agent
```

This command will guide you through setting up an onchain agent project by prompting for necessary configuration options.

## Features

- **Guided setup**: Interactive prompts help configure the project.
- **Supports multiple blockchain networks**.
- **Select your preferred wallet provider**.
- **Automates environment setup**.

### Setup Process

The CLI will prompt you for the following details:

1. **Project Name**: The name of your new onchain agent project.
2. **Package Name**: The Python package name (auto-formatted if needed).
3. **Network**: Choose from available blockchain networks.
4. **Chain ID**: Specify if using a custom network.
5. **Wallet Provider**: Select a preferred method for wallet management.

After answering the prompts, the CLI will:

- Generate the project structure.
- Copy necessary template files.
- Configure the selected settings.
- Display next steps to get started.

## Getting Started

Once your project is created, navigate into the directory and install dependencies:

```sh
cd my-project
poetry install
```

Then, configure your environment variables:

```sh
mv .env.local .env
```

Run the chatbot:

```sh
poetry run python chatbot.py
```

## Documentation & Support

- **Docs:** [https://docs.cdp.coinbase.com/agentkit/docs/welcome](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- **GitHub Repo:** [http://github.com/coinbase/agentkit](http://github.com/coinbase/agentkit)
- **Community & Support:** [https://discord.gg/CDP](https://discord.gg/CDP)
