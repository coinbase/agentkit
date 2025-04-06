#!/bin/bash

# Process framework package versions
cd "$(dirname "$0")"

# Generate branch name with today's date
BRANCH_NAME="release/python-$(date +%Y-%m-%d)"
PR_TITLE="chore: version python packages"

# Check if --prod flag is set
IS_PROD=false
if [ "$1" == "--prod" ]; then
    IS_PROD=true
    # Create and checkout new branch
    git checkout -b "$BRANCH_NAME"
fi

# Step 1: Check for dependency updates and create changelog entries
python3 -m version_frameworks_dependencies | while read message; do
    # Extract package name from message (assumes format "framework-extensions/package-name: Bump ...")
    package=$(echo "$message" | cut -d':' -f1)
    content=$(echo "$message" | cut -d':' -f2- | sed 's/^ //')
    
    # Extract package name without framework-extensions/ prefix
    package_name=$(echo "$package" | sed 's/framework-extensions\///')
    
    # Generate descriptive changelog entry filename
    changelog_name="+bump-deps-${package_name}.feature.md"
    
    # Create changelog entry in package directory
    cd "../$package"
    uv run -- towncrier create --content "$content" "$changelog_name"
    cd - > /dev/null
done

# Step 2: Process version bumps and build changelogs
python3 -m version_frameworks | while read package; do
    if [[ $package == framework-extensions/* ]]; then
        cd "../$package"
        uv sync
        uv run -- towncrier build --yes
        cd - > /dev/null
    fi
done

# Step 3: Check for dependency updates and create changelog entries
python3 -m version_utilities_dependencies | while read message; do
    # Extract package name from message (assumes format "package-name: Bump ...")
    package=$(echo "$message" | cut -d':' -f1)
    content=$(echo "$message" | cut -d':' -f2- | sed 's/^ //')
    
    # Generate descriptive changelog entry filename
    changelog_name="+bump-deps-${package}.feature.md"
    
    # Create changelog entry in package directory
    cd "../$package"
    uv run -- towncrier create --content "$content" "$changelog_name"
    cd - > /dev/null
done

# Step 4: Process version bumps and build changelogs
python3 -m version_utilities | while read package; do
    cd "../$package"
    uv sync
    uv run -- towncrier build --yes
    cd - > /dev/null
done

# Only perform git operations if --prod flag is set
if [ "$IS_PROD" = true ]; then
    # Run sync_examples.sh
    ./sync_examples.sh

    # Stage and commit changes
    git add --all
    git commit -m "$PR_TITLE"

    # Push branch
    git push origin "$BRANCH_NAME"

    # Create draft PR using GitHub CLI (if installed)
    if command -v gh &> /dev/null; then
        gh pr create \
            --title "$PR_TITLE" \
            --body "Automated version update for Python framework and utility packages." \
            --base main \
            --head "$BRANCH_NAME" \
            --draft
    else
        echo "GitHub CLI not installed. To create PR manually, visit:"
        echo "https://github.com/coinbase/agentkit/compare/main...$BRANCH_NAME"
    fi
else
    echo "Dry run complete. Run with --prod to create branch, commit changes, and create PR."
fi
