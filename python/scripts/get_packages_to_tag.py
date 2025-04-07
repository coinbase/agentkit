from utils.version import read_version
from utils.package_definitions import get_package_by_name
import sys

# List of packages that need to be tagged
PACKAGES_TO_TAG = [
    "coinbase-agentkit",
    "create-onchain-agent",
    "framework-extensions/langchain",
    "framework-extensions/openai-agents-sdk"
]

def main():
    for package_name in PACKAGES_TO_TAG:
        package = get_package_by_name(package_name)
        if not package:
            print(f"Error: Package {package_name} not found in package definitions", file=sys.stderr)
            continue

        try:
            version = read_version(package["path"], "version")
            print(f"{package['package_name']}: {version}")
        except (FileNotFoundError, ValueError) as e:
            print(f"Error reading version for {package_name}: {e}", file=sys.stderr)
            continue

if __name__ == "__main__":
    main()

