#!/bin/bash

# Store the script's directory path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Calculate the examples directory path (one level up and into examples)
EXAMPLES_DIR="$SCRIPT_DIR/../examples"

# Store the current directory to return to it later
CURRENT_DIR=$(pwd)

# Check if examples directory exists
if [ ! -d "$EXAMPLES_DIR" ]; then
    echo "Error: Examples directory not found at $EXAMPLES_DIR"
    exit 1
fi

echo "Syncing all examples in $EXAMPLES_DIR..."

# Find all directories in the examples folder
for example_dir in "$EXAMPLES_DIR"/*/ ; do
    if [ -d "$example_dir" ]; then
        echo "Processing example: $(basename "$example_dir")"
        cd "$example_dir"
        
        # Run uv sync
        if ! uv sync; then
            echo "Warning: uv sync failed for $(basename "$example_dir")"
        fi

        # Run uv run ruff format .
        if ! uv run ruff format .; then
            echo "Warning: ruff format failed for $(basename "$example_dir")"
        fi
    fi
done

# Return to original directory
cd "$CURRENT_DIR"

echo "Finished syncing all examples"
