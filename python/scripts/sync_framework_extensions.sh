#!/bin/bash

# Store the script's directory path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Calculate the examples directory path (one level up and into examples)
FRAMEWORK_EXTENSIONS_DIR="$SCRIPT_DIR/../framework-extensions"

# Store the current directory to return to it later
CURRENT_DIR=$(pwd)

# Check if framework extensions directory exists
if [ ! -d "$FRAMEWORK_EXTENSIONS_DIR" ]; then
    echo "Error: Framework extensions directory not found at $FRAMEWORK_EXTENSIONS_DIR"
    exit 1
fi

echo "Syncing all framework extensions in $FRAMEWORK_EXTENSIONS_DIR..."

# Find all directories in the framework extensions folder
for framework_extension_dir in "$FRAMEWORK_EXTENSIONS_DIR"/*/ ; do
    if [ -d "$framework_extension_dir" ]; then
        echo "Processing framework extension: $(basename "$framework_extension_dir")"
        cd "$framework_extension_dir"
        
        # Run uv sync
        if ! uv sync; then
            echo "Warning: uv sync failed for $(basename "$framework_extension_dir")"
        fi

        # Run uv run ruff format .
        if ! uv run ruff format .; then
            echo "Warning: ruff format failed for $(basename "$framework_extension_dir")"
        fi
    fi
done

# Return to original directory
cd "$CURRENT_DIR"

echo "Finished syncing all framework extensions"
