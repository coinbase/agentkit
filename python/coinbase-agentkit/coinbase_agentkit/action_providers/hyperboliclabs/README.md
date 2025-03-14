# Hyperbolic Labs Action Provider

This directory contains the **Hyperbolic Labs Action Provider** implementation, which provides actions to interact with Hyperbolic Labs services.

## Getting Started

1. Create a new Hyperbolic Labs account at https://hyperbolic.xyz/
2. Retrieve your API key at https://hyperbolic.xyz/settings
3. Set the `HYPERBOLIC_API_KEY` environment variable to the API key
4. Upload your SSH public key at https://hyperbolic.xyz/settings

Note:
- Supported SSH key types: DSA/DSS, ECDSA, ED25519, RSA
- Your SSH public key must be defined in your Hyperbolic Labs account before you can rent GPU instances

### Environment Variables
```
HYPERBOLIC_API_KEY
HYPERBOLIC_SSH_PRIVATE_KEY_PATH
```

If `HYPERBOLIC_SSH_PRIVATE_KEY_PATH` is undefined, the SSH action provider will use the default SSH key at `~/.ssh/id_rsa`.

## Directory Structure

```
hyperboliclabs/
├── action_provider.py             # Base action provider
├── hyperbolic_action_provider.py  # Main Hyperbolic action provider
├── service.py                     # API service layer
├── utils.py                       # Utility functions
├── constants.py                   # Constants and configuration
├── __init__.py                    # Main exports
├── ai/                            # AI services
│   ├── action_provider.py         # AI action provider
│   ├── schemas.py                 # AI action schemas
│   ├── service.py                 # AI service implementation
│   ├── types.py                   # AI type definitions
│   ├── utils.py                   # AI utilities
│   └── __init__.py                # AI module exports
├── marketplace/                   # Marketplace services
│   ├── action_provider.py         # Marketplace action provider
│   ├── schemas.py                 # Marketplace action schemas
│   ├── service.py                 # Marketplace service implementation
│   ├── types.py                   # Marketplace type definitions
│   ├── utils.py                   # Marketplace utilities
│   └── __init__.py                # Marketplace module exports
├── billing/                       # Billing services
│   ├── action_provider.py         # Billing action provider
│   ├── schemas.py                 # Billing action schemas
│   ├── service.py                 # Billing service implementation
│   ├── types.py                   # Billing type definitions
│   ├── utils.py                   # Billing utilities
│   └── __init__.py                # Billing module exports
├── settings/                      # Settings services
│   ├── action_provider.py         # Settings action provider
│   ├── schemas.py                 # Settings action schemas
│   ├── service.py                 # Settings service implementation
│   ├── types.py                   # Settings type definitions
│   ├── utils.py                   # Settings utilities
│   └── __init__.py                # Settings module exports
└── README.md                      # This file

# From python/coinbase-agentkit/
tests/action_providers/hyperboliclabs/
├── conftest.py                    # Test configuration
├── test_service.py                # Test service layer
├── test_service_e2e.py            # End-to-end tests
├── test_hyperbolic_action_provider.py  # Test action provider
├── ai/                            # AI service tests
├── marketplace/                   # Marketplace service tests
├── billing/                       # Billing service tests
└── settings/                      # Settings service tests
```

## Actions

### AI
- `generate_text`: Generate text using AI models
  - Can specify model and prompts
  - Powers conversational AI features
  - Optional system prompt to guide behavior

- `generate_image`: Generate images using AI models
  - Configurable image dimensions and quality settings
  - Supports negative prompts
  - Multiple images per request

- `generate_audio`: Generate text-to-speech audio
  - Multiple language and speaker options
  - Adjustable speaking speed

### Marketplace
- `get_available_gpus`: Get available GPU resources
  - Lists GPUs available for use
  - Shows pricing information

- `get_available_gpus_by_type`: Get GPUs filtered by model type
  - Filters available GPUs by specific model

- `get_available_gpus_types`: Get list of available GPU types
  - Shows all GPU models currently available

- `get_gpu_status`: Check status of GPU resources
  - Shows current usage and availability

- `rent_compute`: Rent GPU compute resources
  - Specify cluster, node, and GPU count
  - Returns instance information

- `terminate_compute`: Terminate a rented GPU compute instance
  - Release GPU resources no longer needed

### Billing
- `get_current_balance`: Get current account balance
  - Shows available funds

- `get_purchase_history`: Get purchase history
  - Lists previous purchases
  - Shows transaction details

- `get_spend_history`: Get spending history
  - Shows where funds have been spent
  - Lists transactions by service

### Settings
- `link_wallet_address`: Link a wallet address to your account
  - Enables crypto funding of account
  - Supports Ethereum-compatible addresses

## Environment Variables

The Hyperbolic Labs action provider requires the following environment variables:

- `HYPERBOLIC_API_KEY`: API key for authentication with Hyperbolic Labs
- `HYPERBOLIC_SSH_PRIVATE_KEY_PATH`: Path to SSH private key

## Adding New Actions

To add new Hyperbolic Labs actions:

1. Identify which service category your action belongs to
2. Define your action schema in the appropriate `schemas.py`
3. Implement the action in the corresponding action provider
4. Implement tests in the corresponding test directory

## Prompts

### *please show my hyperbolic balance*

<details>
<summary>Tool Output</summary>

```
Your current Hyperbolic platform balance is $3.61.
```
</details>

<details>
<summary>Agent Output</summary>

```
Your current Hyperbolic platform balance is $3.61.
```
</details>

### *please show my hyperbolic purchase history*

<details>
<summary>Tool Output</summary>

```
Purchase History (showing 5 most recent):
- $1.00 on March 06, 2025
- $10.00 on March 06, 2025
```
</details>

<details>
<summary>Agent Output</summary>

```
Here is your Hyperbolic purchase history (showing the 5 most recent transactions):

- $1.00 on March 06, 2025
- $10.00 on March 06, 2025
```
</details>

### *please show my hyperbolic spend history*

<details>
<summary>Tool Output</summary>

```
=== GPU Rental Spending Analysis ===

Instance Rentals (showing 5 most recent):
- antique-peach-rhinoceros:
  GPU: NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090 (Count: 1)
  Duration: 225 seconds
  Cost: $0.03
- clearcut-chrysanthemum-ape:
  GPU: NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090 (Count: 1)
  Duration: 90 seconds
  Cost: $0.01
- austere-cyclamen-frog:
  GPU: NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090 (Count: 1)
  Duration: 2335 seconds
  Cost: $0.23
- greedy-daffodil-dragon:
  GPU: NVIDIA-GeForce-RTX-3070 (Count: 1)
  Duration: Unavailable (missing timestamp data)
  Cost: Unavailable
- super-grape-crocodile:
  GPU: NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090, NVIDIA-GeForce-RTX-4090 (Count: 1)
  Duration: Unavailable (missing timestamp data)
  Cost: Unavailable

GPU Type Statistics (showing 2 most recent):

NVIDIA-GeForce-RTX-4090:
  Total Rentals: 10.0
  Total Time: 363954 seconds
  Total Cost: $6.80

NVIDIA-H100-80GB-HBM3:
  Total Rentals: 14.0
  Total Time: 3084 seconds
  Total Cost: $0.16

Total Spending: $6.96
```
</details>

<details>
<summary>Agent Output</summary>

```
Here is your Hyperbolic spend history:

### Instance Rentals (showing 5 most recent):
1. **antique-peach-rhinoceros**
   - GPU: NVIDIA GeForce RTX 4090 (Count: 1)
   - Duration: 225 seconds
   - Cost: $0.03

2. **clearcut-chrysanthemum-ape**
   - GPU: NVIDIA GeForce RTX 4090 (Count: 1)
   - Duration: 90 seconds
   - Cost: $0.01

3. **austere-cyclamen-frog**
   - GPU: NVIDIA GeForce RTX 4090 (Count: 1)
   - Duration: 2335 seconds
   - Cost: $0.23

4. **greedy-daffodil-dragon**
   - GPU: NVIDIA GeForce RTX 3070 (Count: 1)
   - Duration: Unavailable (missing timestamp data)
   - Cost: Unavailable

5. **super-grape-crocodile**
   - GPU: NVIDIA GeForce RTX 4090 (Count: 1)
   - Duration: Unavailable (missing timestamp data)
   - Cost: Unavailable

### GPU Type Statistics (showing 2 most recent):
- **NVIDIA GeForce RTX 4090**
  - Total Rentals: 10
  - Total Time: 363,954 seconds
  - Total Cost: $6.80

- **NVIDIA H100 80GB HBM3**
  - Total Rentals: 14
  - Total Time: 3,084 seconds
  - Total Cost: $0.16

### Total Spending: $6.96
```
</details>

### *please use hyperbolic to generate a short paragrpah describing the number zero*

<details>
<summary>Tool Output</summary>

```
Text generation successful:
- Saved to: /Users/chris/repositories/agentkit/python/examples/langchain-cdp-chatbot/tmp/generated_text_d6f5a399-659f-4950-8c02-e7c23f7c942f.txt

Preview (first 500 chars):
The number zero is a fascinating and fundamental concept in mathematics, representing the absence or nullity of quantity. It is a placeholder digit that allows us to denote the concept of nothingness or the lack of value in a numerical sequence. Despite its seemingly simple nature, zero has played a crucial role in the development of mathematics, enabling the creation of the decimal system and facilitating calculations that involve negative numbers, fractions, and decimals. In many cultures, zer...
```
</details>

<details>
<summary>Agent Output</summary>

```
I have generated a short paragraph describing the number zero:

"The number zero is a fascinating and fundamental concept in mathematics, representing the absence or nullity of quantity. It is a placeholder digit that allows us to denote the concept of nothingness or the lack of value in a numerical sequence. Despite its seemingly simple nature, zero has played a crucial role in the development of mathematics, enabling the creation of the decimal system and facilitating calculations that involve negative numbers, fractions, and decimals."

If you need anything else, feel free to ask!
```
</details>

### *please use hyperbolic to generate an image describing the number zero*

<details>
<summary>Tool Output</summary>

```
Image generation successful:
- Saved to: /Users/chris/repositories/agentkit/python/examples/langchain-cdp-chatbot/tmp/generated_image_afeb3db9-66a5-40d6-a2f3-e4fdbffae129.png
```
</details>

<details>
<summary>Agent Output</summary>

```
I have generated an artistic image representing the number zero, incorporating themes of absence, infinity, and mathematical concepts. If you would like to view the image or need any further assistance, please let me know!
```
</details>

### *please use hyperbolic to generate a short audio segment describing the number zero*

<details>
<summary>Tool Output</summary>

```
Audio generation successful:
- Saved to: /Users/chris/repositories/agentkit/python/examples/langchain-cdp-chatbot/tmp/generated_audio_91103779-dee8-4b33-b34d-a8b08c18187a.mp3
```
</details>

<details>
<summary>Agent Output</summary>

```
I have generated a short audio segment describing the number zero. If you would like to listen to it or need any further assistance, please let me know!
```
</details>

### *please get available hyperbolic gpus by type*

<details>
<summary>Tool Output</summary>

```
Available GPU Types:
- NVIDIA-GeForce-RTX-3070
- NVIDIA-GeForce-RTX-3080
- NVIDIA-GeForce-RTX-4090
- NVIDIA-H100-80GB-HBM3
```
</details>

<details>
<summary>Agent Output</summary>

```
Here are the available GPU types on the Hyperbolic platform:

- NVIDIA GeForce RTX 3070
- NVIDIA GeForce RTX 3080
- NVIDIA GeForce RTX 4090
- NVIDIA H100 80GB HBM3

If you need more information or assistance, feel free to ask!
```
</details>

### *please get available hyperbolic 4090s*

<details>
<summary>Tool Output</summary>

```
Available NVIDIA-GeForce-RTX-4090 GPU Options:

Cluster: growing-rosemary-dragonfly
Node ID: antalpha-super-server-100194
GPU Model: NVIDIA-GeForce-RTX-4090
Available GPUs: 1/8
Price: $0.35/hour per GPU
----------------------------------------


Cluster: lame-clover-jellyfish
Node ID: zillion23
GPU Model: NVIDIA-GeForce-RTX-4090
Available GPUs: 6/8
Price: $0.40/hour per GPU
----------------------------------------


Cluster: webbed-peperomia-magpie
Node ID: las1-prd-acl-msi-07.fen.intra
GPU Model: NVIDIA-GeForce-RTX-4090
Available GPUs: 1/4
Price: $0.30/hour per GPU
----------------------------------------
```
</details>

<details>
<summary>Agent Output</summary>

```
Here are the available NVIDIA GeForce RTX 4090 GPU options:

1. **Cluster:** growing-rosemary-dragonfly
   - **Node ID:** antalpha-super-server-100194
   - **Available GPUs:** 1/8
   - **Price:** $0.35/hour per GPU

2. **Cluster:** lame-clover-jellyfish
   - **Node ID:** zillion23
   - **Available GPUs:** 6/8
   - **Price:** $0.40/hour per GPU

3. **Cluster:** webbed-peperomia-magpie
   - **Node ID:** las1-prd-acl-msi-07.fen.intra
   - **Available GPUs:** 1/4
   - **Price:** $0.30/hour per GPU

If you need further details or assistance, let me know!
```
</details>

### *please rent the cheapest hyperbolic 4090*

<details>
<summary>Tool Output</summary>

```
{
  "status": "success",
  "instance_name": "mortified-morningglory-wombat"
}

Next Steps:
1. Your GPU instance is being provisioned
2. Use get_gpu_status to check when it's ready
3. Once status is 'running', you can:
   - Connect via SSH using the provided command
   - Run commands using remote_shell
   - Install packages and set up your environment
```
</details>

<details>
<summary>Agent Output</summary>

```
The cheapest NVIDIA GeForce RTX 4090 GPU has been successfully rented. Here are the details:

- **Instance Name:** mortified-morningglory-wombat

### Next Steps:
1. Your GPU instance is being provisioned.
2. Use the **get_gpu_status** function to check when it's ready.
3. Once the status is 'running', you can:
   - Connect via SSH using the provided command.
   - Run commands using remote_shell.
   - Install packages and set up your environment.

If you need further assistance, feel free to ask!
```
</details>

### *please show my hyperbolic instances*

<details>
<summary>Tool Output</summary>

```
Your Rented GPU Instances:
Instance ID: mortified-morningglory-wombat
Status: running (Ready to use)
GPU Model: NVIDIA-GeForce-RTX-4090
GPU Count: 1
GPU Memory: 24.0 GB
SSH Command: ssh ubuntu@mortified-morningglory-wombat.1.cricket.hyperbolic.xyz -p 31065
----------------------------------------

----------------------------------------

SSH Connection Instructions:
1. Wait until instance status is 'running'
2. Use the ssh_connect action with the provided host and username
3. Once connected, use remote_shell to execute commands
```
</details>

<details>
<summary>Agent Output</summary>

```
Here are your rented Hyperbolic GPU instances:

### Instance Details:
- **Instance ID:** mortified-morningglory-wombat
- **Status:** Running (Ready to use)
- **GPU Model:** NVIDIA GeForce RTX 4090
- **GPU Count:** 1
- **GPU Memory:** 24.0 GB

### SSH Command:
To connect to your instance, use the following command:
ssh ubuntu@mortified-morningglory-wombat.1.cricket.hyperbolic.xyz -p 31065

### SSH Connection Instructions:
1. Wait until the instance status is 'running'.
2. Use the provided SSH command to connect.
3. Once connected, you can use remote_shell to execute commands.

If you need further assistance, feel free to ask!
```
</details>

### *please terminate my hyperbolic instance*

<details>
<summary>Tool Output</summary>

```
{
  "status": "success",
  "message": null,
  "error_code": null
}

Next Steps:
1. Your GPU instance has been terminated
2. Any active SSH connections have been closed
3. You can check your spend history with get_spend_history
4. To rent a new instance, use get_available_gpus and rent_compute
```
</details>

<details>
<summary>Agent Output</summary>

```
Your Hyperbolic GPU instance has been successfully terminated. 

### Next Steps:
1. Any active SSH connections have been closed.
2. You can check your spend history using the **get_spend_history** function.
3. To rent a new instance, use the **get_available_gpus** function and then rent a compute.

If you need any further assistance, feel free to ask!
```
</details>

### *please link my current wallet address to my account at hyperbolic*

<details>
<summary>Tool Output</summary>

```
Wallet Details:
- Provider: cdp_wallet_provider
- Address: 0x5E83884F5d399131bbDe98f60854E43c7A12Cf7A
- Network:
  * Protocol Family: evm
  * Network ID: base-mainnet
  * Chain ID: 8453
- Native Balance: 0
-------------------

{
  "success": true,
  "error_code": null,
  "message": null
}
wallet_address: 0x5E83884F5d399131bbDe98f60854E43c7A12Cf7A

Next Steps:
1. Your wallet has been successfully linked to your Hyperbolic account
2. To add funds, send any of these tokens on Base Mainnet:
   - USDC
   - USDT
   - DAI
3. Send to this Hyperbolic address: 0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60
```
</details>

<details>
<summary>Agent Output</summary>

```
Your wallet address has been successfully linked to your Hyperbolic account.

### Next Steps:
1. To add funds, you can send any of the following tokens on the Base Mainnet:
   - USDC
   - USDT
   - DAI
2. Send to this Hyperbolic address: **0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60**

If you need further assistance, feel free to ask!
```
</details>