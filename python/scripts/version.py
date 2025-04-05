import os
import re


def detect_new_version_type(package_name: str) -> str | None:
    """
    Detect based on towncrier entries whether package bump should be minor or patch.
    """

    changelog_files = os.listdir(f"{package_name}/changelog.d")

    contains_feature = False
    contains_fix = False
    for file in changelog_files:
        if "feature" in file:
            contains_feature = True
        if "bugfix" in file:
            contains_fix = True

    if contains_feature:
        return "minor"
    if contains_fix:
        return "patch"
    return None

def read_version(file_path: str, version_key: str) -> str:
    """
    Read a file into memory and pull out the existing version number.
    """

    with open(file_path, "r") as file:
        content = file.read()

    for line in content.split("\n"):
       match = re.match(rf'^{version_key}\s*=\s*(.+?)(?:\{{|$)', line)

        if match:
            return match.group(1).strip().replace('"', '').replace("'", "").replace('\n', '')

def determine_new_version(version_type: str, version: str) -> str:
    """
    Return the bumped version number based on the version type and existing version.
    """

    [major, minor, patch] = version.split(".")

    if (version_type == "minor"):
        return f"{major}.{int(minor) + 1}.0"
    elif (version_type == "patch"):
        return f"{major}.{minor}.{int(patch) + 1}"

def write_version(file_path: str, version: str, version_key: str):
    """
    Write the bumped version number to the file.
    """

    with open(file_path, "r") as file:
        contents = file.read()
    
    pattern = rf'({version_key}\s*=\s*["\'])[~^>=]*[0-9]+\.[0-9]+\.[0-9]+(["\'])' 
    updated_content = re.sub(pattern, rf'\g<1>{str(version)}\g<2>', contents)
    
    with open(file_path, "w") as file:
        file.write(updated_content)

if __name__ == "__main__":
    bump_configs = {
        "coinbase-agentkit": {
            "files": [
                {
                    "path": "coinbase-agentkit/pyproject.toml",
                    "version_key": "version"
                },
                {
                    "path": "coinbase-agentkit/docs/conf.py",
                    "version_key": "release"
                },
                {
                    "path": "coinbase-agentkit/coinbase_agentkit/__version__.py",
                    "version_key": "__version__"
                },
                {
                    "path": "create-onchain-agent/templates/beginner/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit"
                },
                {
                    "path": "create-onchain-agent/templates/chatbot/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit"
                },
            ],
        },
        "create-onchain-agent": {
            "files": [
                {
                    "path": "create-onchain-agent/pyproject.toml",
                    "version_key": "version"
                },
            ],
        },
        "framework-extensions/langchain": {
            "files": [
                {
                    "path": "framework-extensions/langchain/pyproject.toml",
                    "version_key": "version"
                },
                {
                    "path": "framework-extensions/langchain/docs/conf.py",
                    "version_key": "release"
                },
                {
                    "path": "create-onchain-agent/templates/beginner/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit-langchain"
                },
                {
                    "path": "create-onchain-agent/templates/chatbot/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit-langchain"
                },
            ],
        },
        "framework-extensions/openai-agents-sdk": {
            "files": [
                {
                    "path": "framework-extensions/openai-agents-sdk/pyproject.toml",
                    "version_key": "version"
                },
                {
                    "path": "create-onchain-agent/templates/beginner/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit-openai-agents-sdk"
                },
                {
                    "path": "create-onchain-agent/templates/chatbot/pyproject.toml.jinja",
                    "version_key": "coinbase-agentkit-openai-agents-sdk"
                },
            ],
        }
    }

    for package_name, config in bump_configs.items():
        print(f"\nProcessing version bumps for {package_name}")

        version_type = detect_new_version_type(package_name)

        # no changes, skip
        if (version_type == None):
            print(f"{package_name} didn't change; skipping")
            continue

        for file in config["files"]:
            version = read_version(file["path"], file["version_key"])
            new_version = determine_new_version(version_type, version)
            write_version(file["path"], new_version, file["version_key"])
            print(f"Bumped version in {file['path']} from {version} to {new_version}")
