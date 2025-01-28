# CDP AgentKit Langchain Extension Examples - Mnemomic Phrase Wallet Import

This example demonstrates agentkit setup with an imported wallet from a mnemomic phrase through the ENV. An example of a mnemomic phrase could be:

```bash
eternal phone creek robot disorder climb thought eternal noodle flat cage bubble liquid sting can
```

## Requirements

- Python 3.10+
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)

### Checking Python Version

Before using the example, ensure that you have the correct version of Python installed. The example requires Python 3.10 or higher. You can check your Python version by running the following code:

```bash
python --version
pip --version
```

## Installation

```bash
pip install cdp-langchain
```

## Run the example

### Set ENV Vars

Ensure the following vars are set in .env:

- "CDP_API_KEY_NAME"
- "CDP_API_KEY_PRIVATE_KEY"
- "OPENAI_API_KEY"
- "MNEMONIC_PHRASE"

The mnemomic phrase example above can be used to validate wallet import functionality.

```bash
make run
```

## License

Apache-2.0
