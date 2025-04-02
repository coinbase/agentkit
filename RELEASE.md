# Release Guide

## TypeScript

When ready to release the TypeScript packages, just review & merge the changesets PR (look for a PR titled "chore: version typescript packages"). This will automatically kick off the publish in the [changesets action](https://github.com/coinbase/agentkit/tree/main/.github/workflows/version_publish_npm.yml).

## Python

When ready to release the Python packages, follow these steps.

1. From the `python/` folder, run: `./scripts/version.sh`
2. Commit the changes and open a PR with message: `chore: version python packages`
3. Get PR reviewed and merge to `main`
4. Run GitHub Actions to release changed packages
   - [Publish AgentKit Core Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit.yml)
   - [Publish Create Onchain Agent Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_create_onchain_agent.yml)
   - [Publish Agentkit Langchain Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit_langchain.yml)
   - [Publish Open AI Extension](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit_openai_agents_sdk.yml)
