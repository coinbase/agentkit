"""Check description lengths in all action providers across the codebase."""

import glob
import os
import re
import sys


def check_file(filepath):
    """Check description lengths in a file.

    Parses the given file for description fields in triple quotes and checks their lengths.
    Prints warnings for descriptions exceeding 1024 characters.

    Args:
        filepath (str): Path to the file to check

    """
    with open(filepath) as file:
        content = file.read()

    pattern = re.compile(r'description="""(.*?)""",', re.DOTALL)
    matches = pattern.findall(content)

    if matches:
        print(f"File: {filepath}")
        for i, desc in enumerate(matches):
            print(f"  Description {i+1} length: {len(desc)} chars")
            if len(desc) > 1024:
                print("  ** EXCEEDS 1024 LIMIT **")
                print(f"  Start: {desc[:50]}...")
                print(f"  End: ...{desc[-50:]}")
        print("\n")


def find_action_providers(base_dir):
    """Find all action provider files in the codebase using wildcard patterns.

    Searches the directory tree for files matching patterns that indicate
    they are action provider files.

    Args:
        base_dir (str): Base directory to start the search from

    Returns:
        list: List of paths to action provider files

    """
    patterns = [
        os.path.join(base_dir, "**", "*action_provider.py"),
    ]

    action_providers = []
    for pattern in patterns:
        action_providers.extend(glob.glob(pattern, recursive=True))

    return action_providers


def check_description_length():
    """Check description lengths across action provider files in the codebase.

    This function finds all action provider files in the codebase and checks if any
    description fields exceed the 1024 character limit. It handles both single file checking
    (when a file path is provided as a command line argument) and scanning the entire
    codebase for action provider files.

    If a command line argument is provided, it checks only that specific file.
    Otherwise, it searches for action provider files within the expected directory
    structure and checks each one.

    Returns:
        None: Results are printed to stdout

    """
    if len(sys.argv) > 1:
        check_file(sys.argv[1])
        sys.exit(0)

    base_dir = "coinbase_agentkit"

    if not os.path.exists(base_dir):
        print(
            f"Directory {base_dir} not found. Make sure you're running this from the correct location."
        )
        base_dir = "python/coinbase-agentkit/coinbase_agentkit"
        if not os.path.exists(base_dir):
            print(f"Directory {base_dir} not found either. Exiting.")
            sys.exit(1)

    action_provider_files = find_action_providers(base_dir)

    if not action_provider_files:
        print(f"No action provider files found in {base_dir}.")
        sys.exit(1)

    print(f"Found {len(action_provider_files)} action provider files to check.\n")

    for file_path in sorted(action_provider_files):
        check_file(file_path)

    print(f"Checked {len(action_provider_files)} action provider files.")


def main() -> None:
    """Execute the main entry point.

    Calls the check_description_length function to start the script execution.
    """
    check_description_length()


if __name__ == "__main__":
    main()
