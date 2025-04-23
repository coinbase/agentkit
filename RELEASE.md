# Release Guide

## TypeScript

When ready to release the TypeScript packages, just review & merge the changesets PR (look for a PR titled "chore: version typescript packages"). This will automatically kick off the publish in the [changesets action](https://github.com/coinbase/agentkit/tree/main/.github/workflows/version_publish_npm.yml).

## Python

When ready to release the Python packages, follow these steps.

1. From the `python/` folder, run: `./scripts/version_phase_1.sh --prod`. This will automatically open a PR.
2. Get the PR reviewed and merge to `main`
3. Run the GitHub Action to release changed package
   - [Publish AgentKit Core Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit.yml)
4. From the `python/` folder, run: `./scripts/version_phase_2.sh --prod`. This will automatically open a PR.
5. Get the PR reviewed and merge to `main`
4. Run GitHub Actions to release changed packages
   - [Publish Create Onchain Agent Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_create_onchain_agent.yml)
   - [Publish Agentkit Langchain Action](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit_langchain.yml)
   - [Publish Open AI Extension](https://github.com/coinbase/agentkit/actions/workflows/publish_pypi_coinbase_agentkit_openai_agents_sdk.yml)
