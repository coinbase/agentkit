# AgentKit Contributing Guide

Thank you for your interest in contributing to AgentKit! We welcome all contributions, no matter how big or small.

## Contents

- [Repository Structure](#repository-structure)
- [Language-Specific Guides](#language-specific-guides)
- [Contributing Workflow](#contributing-workflow)
- [Releasing](#releasing)
- [Getting Help](#getting-help)
- [Monorepo Development Tips](#monorepo-development-tips)

## Repository Structure

The AgentKit repository is organized as two [monorepos](https://vercel.com/docs/vercel-platform/glossary#monorepo), one for Python and one for TypeScript. The TypeScript side is organized as a [multi-package workspace](https://vercel.com/docs/vercel-platform/glossary#multi-package-workspace) and is managed with [Turborepo](https://turbo.build/repo/docs), while the Python side is simply a collection of Python packages. A Python package is a single subfolder with a `pyproject.toml` file, along with related code and files that are published together to PyPI, whereas a TypeScript [package](https://vercel.com/docs/vercel-platform/glossary#package) is a single subfolder with a `package.json` and related code that is published to NPM. For example, the `typescript/agentkit` subfolder is a TypeScript package, and the `python/coinbase-agentkit` subfolder is a Python package.

Note that not all AgentKit packages have both Python and TypeScript implementations. This is okay, and we expect some level of drift between the languages. If you'd like to add a TypeScript variant of a package that only has a Python variant (or vice versa), that would be a great and welcome contribution!

See this section for tips on developing in our monorepo: [Monorepo Development Tips](#monorepo-development-tips)

Here's a high-level overview of the repository structure:

```
agentkit/
├── typescript/
│   ├── agentkit/
│   ├── create-onchain-agent/
│   ├── framework-extensions/
│   │   ├── langchain/
│   │   ├── vercel-ai-sdk/
│   │   └── model-context-protocol/
│   └── examples/
│       ├── langchain-cdp-chatbot/
│       ├── langchain-cdp-v2-chatbot/
│       ├── langchain-farcaster-chatbot/
│       ├── langchain-privy-chatbot/
│       ├── langchain-solana-chatbot/
│       ├── langchain-twitter-chatbot/
│       ├── langchain-xmtp-chatbot/
│       ├── model-context-protocol-smart-wallet-server/
│       └── vercel-ai-sdk-smart-wallet-chatbot/
├── python/
│   ├── coinbase-agentkit/
│   ├── create-onchain-agent/
│   ├── framework-extensions/
│   │   ├── langchain/
│   │   └── openai-agents-sdk/
│   └── examples/
│       ├── langchain-cdp-server-chatbot/
│       ├── langchain-cdp-smart-wallet-chatbot/
│       ├── langchain-eth-account-chatbot/
│       ├── langchain-nillion-secretvault-chatbot/
│       ├── langchain-twitter-chatbot/
│       ├── openai-agents-sdk-cdp-chatbot/
│       ├── openai-agents-sdk-cdp-voice-chatbot/
│       └── openai-agents-sdk-smart-wallet-chatbot/
```

## Language-Specific Guides

For an in-depth guide on how to set up your developer environment and add an agentic action, see the following language-specific guides:

- [Python Development Guide](./CONTRIBUTING-PYTHON.md)
- [TypeScript Development Guide](./CONTRIBUTING-TYPESCRIPT.md)

## Contributing Workflow

1. **Optional: Start with an Issue**

Whether you are reporting a bug or requesting a new feature, it's always best to check if someone else has already opened an issue for it! If the bug or feature is small and you'd like to take a crack at it, go ahead and skip this step.

2. **Fork the Repository**

Fork the repository by clicking the "Fork" button in the top right corner of the repository page. This will create a copy of the repository in your GitHub account. Then, clone your forked repository to your local machine and create a branch for your changes.

3. **Development Workflow**

These are the high level steps to contribute changes:

- Setup your development environment
- Implement your change
- Test your change manually, and include unit tests if applicable
- Write docs for your change
- Update the changelog

These steps are highly dependent on the language you're working in, so check out the [language-specific guides](#language-specific-guides) for the language you're working in.

4. **Pull Request Process**

Once you have your changes ready, there are a few more steps to open a PR and get it merged:

- Fill out the PR template completely with as much detail as possible
  - Ideally, include screenshots or videos of the changes in action
- Link related issues, if any
- Ensure all CI checks are passing

5. **PR Review Expectations**

Once your PR is open, you can expect an initial response acknowledging receipt of the PR within 1 day, and an initial review within 1 day from a maintainer assigned to your PR. Once all comments are addressed and a maintainer has approved the PR, it will be merged by the maintainer and included in the next release.

Current list of maintainers:

- [@John-peterson-coinbase](https://github.com/John-peterson-coinbase)
- [@stat](https://github.com/stat)
- [@rohan-agarwal-coinbase](https://github.com/rohan-agarwal-coinbase)
- [@0xRAG](https://github.com/0xRAG)
- [@yuga-cb](https://github.com/yuga-cb)

## Releasing

- For TypeScript, see [TypeScript Development Guide](./CONTRIBUTING-TYPESCRIPT.md#releasing)
- For Python, see [Python Development Guide](./CONTRIBUTING-PYTHON.md#releasing)

## Getting Help

If you're stuck, there are a few ways to get help:

- Search existing issues
- Reach out to the team in our [Discord community](https://discord.com/channels/1220414409550336183/1304126107876069376)
- Create a new issue

Thank you for contributing to AgentKit!

## Monorepo Development Tips

Here are some common issues you might run into when developing in our monorepo and how to resolve them:

| Issue                                               | Resolution                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Python imports are not resolving in VSCode / Cursor | Try opening the package folder in a new window. For example, `cd python/coinbase-agentkit` and then `code .` or `cursor .` |
