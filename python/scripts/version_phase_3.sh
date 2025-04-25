#!/bin/bash

# Tag every package
cd "$(dirname "$0")"

# Check if --prod flag is set
PROD_MODE=false
for arg in "$@"; do
    if [ "$arg" = "--prod" ]; then
        PROD_MODE=true
        break
    fi
done

# Create a temporary file
TEMP_FILE=$(mktemp)
trap 'rm -f "$TEMP_FILE"' EXIT

# First, call the python script to get list of packages and versions
echo "Gathering package versions..."
python3 -m get_packages_to_tag > "$TEMP_FILE"

# Store commands in an array
declare -a COMMANDS=()

# Read the temporary file line by line
while IFS=': ' read -r name version; do
    # Skip empty lines or lines with errors
    if [ -z "$name" ] || [ -z "$version" ]; then
        continue
    fi

    # Remove any whitespace
    name=$(echo "$name" | tr -d '[:space:]')
    version=$(echo "$version" | tr -d '[:space:]')
    
    # Create the tag name
    tag="${name}@v${version}"
    
    # Add commands to array
    COMMANDS+=("git tag -a \"$tag\" -m \"Release $name version $version\"")
    COMMANDS+=("git push origin \"$tag\"")
done < "$TEMP_FILE"

# Print all commands that will be executed
if [ ${#COMMANDS[@]} -eq 0 ]; then
    echo "No packages found to tag!"
    exit 1
fi

echo -e "\nThe following commands will be executed:"
printf '%s\n' "${COMMANDS[@]}"

# If in prod mode, ask for confirmation
if [ "$PROD_MODE" = true ]; then
    echo -e "\nEnter Y to confirm: "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Executing commands..."
        for cmd in "${COMMANDS[@]}"; do
            echo "Running: $cmd"
            eval "$cmd"
            if [ $? -ne 0 ]; then
                echo "Error executing command: $cmd" >&2
                exit 1
            fi
        done
        echo "All tags created and pushed successfully!"
    else
        echo "Operation cancelled by user."
        exit 0
    fi
else
    echo -e "\nDry run complete. Run with --prod flag to execute these commands."
fi