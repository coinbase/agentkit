import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import botocore.exceptions
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    cdp_api_action_provider,
    wallet_action_provider,
    x402_action_provider,
)
from coinbase_agentkit_strands_agents import get_strands_tools
from dotenv import load_dotenv
from strands import Agent, tool
from strands.models import BedrockModel
from strands.tools import normalize_tool_spec
from strands_tools import image_reader

# Load environment variables
load_dotenv()

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 4021))
BASE_URL = os.getenv("BASE_URL", f"http://{HOST}:{PORT}")


def validate_environment():
    """Validate required environment variables are present."""
    required_vars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]

    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)


# Service Discovery Functions
def external_service_catalog(service_name: str) -> dict[str, Any] | None:
    """Return service endpoint information including schemas and URLs.

    Args:
        service_name: Name of the service to query

    Returns:
        Dictionary containing service metadata, schemas, and endpoint URL

    """
    catalog = {
        "media-creation": {
            "name": "Image Generator",
            "description": "Generate images based on text prompts using AI. Perfect for creating ad visuals, product shots, and marketing materials.",
            "url": f"{BASE_URL}/image_generator",
            "method": "POST",
            "payment_required": True,
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The prompt describing what images to generate",
                        "example": "Generate 3 images of a friendly dragon reading a book",
                        "minLength": 1,
                        "maxLength": 500,
                    }
                },
                "required": ["query"],
            },
        },
        "weather": {
            "name": "Weather Information",
            "description": "Get current weather information for any city. Useful for location-based or seasonal ad campaigns.",
            "url": f"{BASE_URL}/weather",
            "method": "POST",
            "payment_required": True,
            "input_schema": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name (e.g., 'London' or 'London,UK')",
                        "example": "London,UK",
                    },
                    "units": {
                        "type": "string",
                        "description": "Units: 'metric', 'imperial', or 'standard'",
                        "default": "metric",
                    },
                },
                "required": ["city"],
            },
        },
    }

    return catalog.get(service_name)


# Custom Tools for the Agent
@tool
def list_available_services() -> str:
    """List all available external services that can be used for ad creation.

    Returns information about available endpoints including weather data and image generation.
    Use this when you need to know what external services are available for your ad campaign.
    """
    services = {
        "media-creation": external_service_catalog("media-creation"),
        "weather": external_service_catalog("weather"),
    }

    result = "Available Services for Content Creation:\n\n"

    for _service_name, service_info in services.items():
        if service_info:
            result += f"Service: {service_info['name']}\n"
            result += f"  Description: {service_info['description']}\n"
    return result


@tool
def get_service_schema(service_name: str) -> str:
    """Get detailed schema information and URL endpoint for a specific service.

    Args:
        service_name: Name of the service ('media-creation' or 'weather')

    Returns:
        Detailed schema information including input requirements

    """
    service = external_service_catalog(service_name)

    if not service:
        return (
            f"Service '{service_name}' not found. Available services: 'media-creation', 'weather'"
        )

    result = f"Service: {service['name']}\n"
    result += f"Description: {service['description']}\n\n"
    result += f"Endpoint: {service['method']} {service['url']}\n\n"
    result += f"Input Schema:\n{json.dumps(service['input_schema'], indent=2)}\n"
    return result


@tool
def create_ad_html(
    ad_html_content: str,
    file_name: str,
    output_path: str = "ad_campaign",
) -> str:
    """Create an HTML file displaying the ad campaign.

    Args:
        ad_html_content: Html data containing ad content including generated images (if used) with html syntax used in creating the html file
        file_name: name of the html file including the .html extension
        output_path: Path where HTML file will be saved

    Returns:
        Path to the created HTML file

    """
    # Write to file
    output_file = Path(f"{output_path}/{file_name}")
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(ad_html_content)

    return f"HTML file saved to {output_file.absolute()!s}"


def modify_tool_schema(tool_spec, field_name, new_field_type, new_description=None):
    """Modify a specific field type in a tool's schema."""
    modified_spec = tool_spec.copy()

    # Navigate to the field in inputSchema
    if "inputSchema" in modified_spec and "json" in modified_spec["inputSchema"]:
        schema = modified_spec["inputSchema"]["json"]
        if "properties" in schema and field_name in schema["properties"]:
            # Modify the field type
            schema["properties"][field_name]["type"] = new_field_type

            # Optionally modify description
            if new_description:
                schema["properties"][field_name]["description"] = new_description

    # Normalize the modified schema
    return normalize_tool_spec(modified_spec)


def initialize_agent(config: CdpEvmWalletProviderConfig):
    """Initialize the agent with CDP Agentkit.

    Args:
        config: Configuration for the CDP EVM Server Wallet Provider

    Returns:
        tuple[Agent, CdpEvmServerWalletProvider]: The initialized agent and wallet provider

    """
    # Initialize the wallet provider with the config
    wallet_provider = CdpEvmWalletProvider(
        CdpEvmWalletProviderConfig(
            api_key_id=config.api_key_id,  # CDP API Key ID
            api_key_secret=config.api_key_secret,  # CDP API Key Secret
            wallet_secret=config.wallet_secret,  # CDP Wallet Secret
            network_id=config.network_id,  # Network ID - Optional, will default to 'base-sepolia'
            address=config.address,  # Wallet Address - Optional, will trigger idempotency flow if not provided
            idempotency_key=config.idempotency_key,  # Idempotency Key - Optional, seeds generation of a new wallet
        )
    )

    # Create AgentKit instance with wallet and action providers
    agentkit = AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[
                cdp_api_action_provider(),
                wallet_action_provider(),
                x402_action_provider(),
            ],
        )
    )

    # Get tools for the agent
    tool_list = get_strands_tools(agentkit)

    # List of tools to modify their schema to match the expected action schema
    tool_to_modify = [
        "x402ActionProvider_retry_with_x402",
        "x402ActionProvider_make_http_request",
        "x402ActionProvider_make_http_request_with_x402",
    ]

    modified_tools = []
    for tool_items in tool_list:
        tool_spec = tool_items.tool_spec

        # Modify specific field - change 'config' from 'string' to 'object'
        if tool_items.tool_name in tool_to_modify:
            modified_spec = modify_tool_schema(
                tool_spec,
                field_name="headers",
                new_field_type="object",
            )
            # Update the tool's spec
            tool_items._tool_spec = modified_spec

        modified_tools.append(tool_items)

    # Create a BedrockModel
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        max_tokens=10000,
        region_name=os.getenv("AWS_REGION"),
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 4096,  # Minimum of 1,024
            }
        },
    )

    # Create Agent using the Strands Agents SDK
    agent = Agent(
        model=bedrock_model,
        tools=[
            list_available_services,
            get_service_schema,
            image_reader,
            create_ad_html,
            *modified_tools,
        ],  # Custom tools plus Coinbase Agentkit tools
        system_prompt="""You are an expert advertising and marketing content creator with extensive experience in digital marketing, copywriting, and creative direction.

Your capabilities:
1. Create compelling ad copy for various platforms (social media, display, email, print)
2. Discover and use external services for ad enhancement:
   - Generate professional visuals using the image generation service
   - Get real-time weather data for location-based and seasonal campaigns
3. Design complete ad campaigns with copy, visuals, and targeting strategy
4. Interacting with on chain actions for making and necessary payments
5. Tool for creating a html file of the generated ads

When creating ads:
- First start with and outline of the ads to be created
- Use list_available_services() to discover external services that can help in creating ads
- Consider the target audience, platform, and campaign goals
- If location-specific or weather-dependent, use the appropiate external service to get weather info
- Always generate relevant visuals using image endpoint service
- Use persuasive copywriting techniques (AIDA, PAS, FAB)
- Include clear call-to-action (CTA)
- Optimize for the specific ad format and platform
- Save the ads content as a html file. When creating the html content, make sure images are rendered properly. Take this part very seriously

Ad Formats You Can Create:
- Social Media Ads (Facebook, Instagram, LinkedIn, Twitter)
- Display Banner Ads
- Email Marketing
- Print Advertisements
- Video Ad Scripts
- Search Ads (Google, Bing)

Response Structure:
1. Campaign Overview (objective, audience, platform)
2. Headline(s) - attention-grabbing and benefit-focused
3. Body Copy - persuasive and engaging
4. Call-to-Action - clear and action-oriented
5. Visual Description/Generated Images
6. Targeting Recommendations (demographics, interests, behaviors)
7. Budget & Timing Suggestions (if applicable)
8. **HTML File Creation Checklist:**
   - [ ] All images generated and URLs obtained
   - [ ] Images embedded in HTML with <img> tags using relative paths
   - [ ] HTML file saved with rendered images

Best Practices:
- Keep it concise and scannable
- Focus on benefits, not just features
- Use emotional triggers and power words
- Create urgency when appropriate
- Ensure brand consistency
- Mobile-first approach
- A/B testing recommendations
- Include images in teh generated html file

CRITICAL REQUIREMENT - HTML FILE GENERATION:
When saving ads as HTML files, you MUST:
✓ Include ALL generated images embedded in the HTML
✓ Use proper <img> tags with src attributes pointing to the image URLs
✓ Ensure images are visible when the HTML file is opened
✓ Test that image URLs are accessible and properly formatted
✓ Never create HTML files with missing or broken image references
**NEVER use absolute file system paths:**
❌ `<img src="/home/user/file-path/output/image.png"...>`

**ALWAYS use relative paths based on the HTML file location:**
✅ `<img src="../output/image.png"...>`


BEFORE saving the HTML file, verify:
1. Each ad section has its corresponding image embedded
2. Image URLs are complete and valid
3. Images have appropriate alt text
4. The HTML renders images correctly

Be creative, data-driven, and results-oriented!""",
    )

    return agent, wallet_provider


def setup():
    """Set up the agent with persistent wallet storage.

    Returns:
        Agent: The initialized agent

    """
    # Configure network and file path
    network_id = os.getenv("NETWORK_ID", "base-sepolia")
    wallet_file = f"wallet_data_{network_id.replace('-', '_')}.txt"

    # Load existing wallet data if available
    wallet_data = {}
    if os.path.exists(wallet_file):
        try:
            with open(wallet_file) as f:
                wallet_data = json.load(f)
                print(f"Loading existing wallet from {wallet_file}")
        except json.JSONDecodeError:
            print(f"Warning: Invalid wallet data for {network_id}")
            wallet_data = {}

    # Determine wallet address using priority order
    wallet_address = (
        wallet_data.get("address")  # First priority: Saved wallet file
        or os.getenv("USER_ADDRESS")  # Second priority: ADDRESS env var
        or None  # Will trigger idempotency flow if needed
    )

    # Create the wallet provider config
    config = CdpEvmWalletProviderConfig(
        api_key_id=os.getenv("CDP_API_KEY_ID"),
        api_key_secret=os.getenv("CDP_API_KEY_SECRET"),
        wallet_secret=os.getenv("CDP_WALLET_SECRET"),
        network_id=network_id,
        address=wallet_address,
        # Only include idempotency_key if we need to create a new wallet
        idempotency_key=(os.getenv("IDEMPOTENCY_KEY") if not wallet_address else None),
    )

    # Initialize the agent and get the wallet provider
    agent, wallet_provider = initialize_agent(config)

    # Save the wallet data after successful initialization
    new_wallet_data = {
        "address": wallet_provider.get_address(),
        "network_id": network_id,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        if not wallet_data
        else wallet_data.get("created_at"),
    }

    with open(wallet_file, "w") as f:
        json.dump(new_wallet_data, f, indent=2)
        print(f"Wallet data saved to {wallet_file}")

    return agent


def run_chat_mode(agent):
    """Run the agent interactively based on user input."""
    print("Starting chat mode... Type 'exit' to end.")
    while True:
        try:
            user_input = input("\nPrompt: ")
            if user_input.lower() == "exit":
                break
            if not user_input.strip():
                continue
            # Run agent with the user's input in chat mode
            agent(user_input)
            print("-------------------")

        except KeyboardInterrupt:
            print("Goodbye Agent!")
            sys.exit(0)


def main():
    """Start the chatbot agent."""
    try:
        # Validate environment
        validate_environment()

        # Set up the agent
        agent = setup()

        run_chat_mode(agent=agent)

    except botocore.exceptions.NoCredentialsError:
        print("\n❌ AWS Credentials Error:")
        print("Unable to locate AWS credentials. Please ensure you have:")
        print("  1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, OR")
        print("  2. Set AWS_BEARER_TOKEN_BEDROCK environment variable, OR")
        print("  3. Configured AWS credentials file (~/.aws/credentials), OR")
        print("  4. Set up an IAM role (if running on AWS infrastructure)")
        print(
            "\nFor more information, visit: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html"
        )
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nShutdown requested...")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


def print_banner():
    """Display a box-style banner for the application."""
    title = "Coinbase AgentKit with Strands Agents and X402"
    width = len(title) + 4

    print("╔" + "═" * width + "╗")
    print("║" + " " * width + "║")
    print("║  " + title + "  ║")
    print("║" + " " * width + "║")
    print("╚" + "═" * width + "╝")


if __name__ == "__main__":
    print_banner()
    print("Starting Agent...")
    main()
