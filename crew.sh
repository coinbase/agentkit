#!/bin/bash

# Get the absolute path of the crew-ai-server directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_PATH="$SCRIPT_DIR/src/crew_server.py"

# MCP settings file location
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    SETTINGS_FILE="$HOME/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    SETTINGS_FILE="$HOME/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json"
else
    # Windows (Git Bash)
    SETTINGS_FILE="$APPDATA/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json"
fi

# Create MCP settings directory if it doesn't exist
mkdir -p "$(dirname "$SETTINGS_FILE")"

# Create or update MCP settings
if [ -f "$SETTINGS_FILE" ]; then
    # If file exists, check if it has mcpServers
    if grep -q '"mcpServers"' "$SETTINGS_FILE"; then
        # Update existing crew-ai configuration
        tmp=$(mktemp)
        jq --arg path "$SERVER_PATH" '.mcpServers."crew-ai" = {
            "command": "python3",
            "args": [$path],
            "env": {
                "OPENAI_API_KEY": "${OPENAI_API_KEY}"
            },
            "disabled": false,
            "alwaysAllow": []
        }' "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"
    else
        # Add mcpServers if it doesn't exist
        tmp=$(mktemp)
        jq --arg path "$SERVER_PATH" '. + {
            "mcpServers": {
                "crew-ai": {
                    "command": "python3",
                    "args": [$path],
                    "env": {
                        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
                    },
                    "disabled": false,
                    "alwaysAllow": []
                }
            }
        }' "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"
    fi
else
    # Create new settings file
    echo '{
        "mcpServers": {
            "crew-ai": {
                "command": "python3",
                "args": ["'"$SERVER_PATH"'"],
                "env": {
                    "OPENAI_API_KEY": "${OPENAI_API_KEY}"
                },
                "disabled": false,
                "alwaysAllow": []
            }
        }
    }' > "$SETTINGS_FILE"
fi

# Install Python dependencies
pip install -r requirements.txt

echo "Crew AI server has been configured. Please set your OPENAI_API_KEY environment variable before using the server."
echo "Server location: $SERVER_PATH"
echo "MCP settings: $SETTINGS_FILE"

