"""Check description lengths in action providers."""

import os
import re


def check_file(filepath):
    """Check description lengths in a file."""
    with open(filepath) as file:
        content = file.read()

    pattern = re.compile(r'description="""(.*?)""",', re.DOTALL)
    matches = pattern.findall(content)

    print(f"File: {filepath}")
    for i, desc in enumerate(matches):
        print(f"  Description {i+1} length: {len(desc)} chars")
        if len(desc) > 1024:
            print("  ** EXCEEDS 1024 LIMIT **")
            # Print first and last 50 chars
            print(f"  Start: {desc[:50]}...")
            print(f"  End: ...{desc[-50:]}")
    print("\n")


# Check files in marketplace provider
base_dir = "coinbase_agentkit/action_providers/hyperboliclabs"
dirs = ["marketplace", "ai", "billing", "settings"]

for dir_name in dirs:
    dir_path = os.path.join(base_dir, dir_name)
    for file in os.listdir(dir_path):
        if file.endswith("action_provider.py"):
            check_file(os.path.join(dir_path, file))
