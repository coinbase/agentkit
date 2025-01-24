# AgentKit Contributing Guide

Thank you for your interest in contributing to AgentKit! We welcome all contributions, no matter how big or small.

## Repository Structure

AgentKit is organized as a monorepo containing multiple packages with implementations in Python and TypeScript:

```
./
├── cdp-agentkit-core/
│   ├── python/
│   └── typescript/
├── cdp-langchain/
│   ├── python/
│   ├── typescript/
│   └── examples/
└── twitter-langchain/
    ├── python/
    ├── typescript/
    └── examples/
```

## Language-Specific Guides

For an in-depth guide on how to set up your developer environment and add an agentic action, see the following language-specific guides:

- [Python Development Guide](./CONTRIBUTING-PYTHON.md)
- [TypeScript Development Guide](./CONTRIBUTING-TYPESCRIPT.md)

## Contributing Workflow

1. **Optional: Start with an Issue**

Whether you are reporting a bug or requesting a new feature, it's always best to check if someone else has already opened an issue for it! If the bug or feature is small and you'd like to take a crack at it, go ahead and skip this step.

2. **Development Process**

There are the high level steps to contribute changes:

- Fork the repository
- Create a feature or bugfix branch
- Follow the appropriate [language guide](#language-specific-guides)
- Write tests
- Update CHANGELOG.md

3. **Pull Request Process**

Once you have your changes ready, there are a few more steps to open a PR and get it merged:

- Fill out the PR template completely with as much detail as possible
    - Ideally, include screenshots or videos of the changes in action
- Link related issues, if any
- Ensure all CI checks are passing

4. **PR Review Expectations**

Once your PR is open, you can expect an initial response acknowledging receipt of the PR within 1 day, and an initial review within 1 day from a maintainer assigned to your PR. Once all comments are addressed and a maintainer has approved the PR, it will be merged by the maintainer and included in the next release.

Current list of maintainers:
- [@John-peterson-coinbase](https://github.com/John-peterson-coinbase)
- [@stat](https://github.com/stat)
- [@rohan-agarwal-coinbase](https://github.com/rohan-agarwal-coinbase)
- [@0xRAG](https://github.com/0xRAG)

## Getting Help

If you're stuck, there are a few ways to get help:

- Search existing issues
- Reach out to the team in our [Discord community](https://discord.com/channels/1220414409550336183/1304126107876069376)
- Create a new issue

Thank you for contributing to AgentKit!

