#!/bin/bash

# Process core package versions
cd "$(dirname "$0")"

# Generate branch name with today's date
BRANCH_NAME="release/python-core-$(date +%Y-%m-%d)"
PR_TITLE="chore: version python core package"

# Check if --prod flag is set
IS_PROD=false
if [ "$1" == "--prod" ]; then
    IS_PROD=true
    # Create and checkout new branch
    git checkout -b "$BRANCH_NAME"
fi

# Run Python script and capture its output (package names)
python3 -m version_core | while read package; do
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
            --body "Automated version update for Python core package." \
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
