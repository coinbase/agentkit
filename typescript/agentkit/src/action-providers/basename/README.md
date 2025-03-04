# Basename Action Provider

This directory contains the **BasenameActionProvider** implementation, which provides actions to interact with **Base Name Service (BNS)** for managing `.base` and `.basetest` domain names.

## Directory Structure

```
basename/
├── basenameActionProvider.ts         # Main provider with BNS functionality
├── basenameActionProvider.test.ts    # Test file for BNS provider
├── constants.ts                      # BNS contract constants and ABI
├── schemas.ts                        # Domain registration schemas
├── index.ts                          # Main exports
└── README.md                         # This file
```

## Actions

- `register_basename`: Register a new Base name
  - Registers a `.base` or `.basetest` domain name
  - Links the domain to the caller's wallet address

## Adding New Actions

To add new Basename actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `basenameActionProvider.ts`
3. Add tests in `basenameActionProvider.test.ts`

## Network Support

The Basename provider supports the following networks:

- Base Mainnet (`.base` domains)
- Base Sepolia (`.basetest` domains)

## Notes

- Domain names must follow BNS naming rules
- Registration fees apply (paid in ETH)
- Names are registered on a first-come, first-served basis

For more information on **Basenames**, [see here](https://www.base.org/names).
