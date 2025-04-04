python3 scripts/version.py

changed_packages=()

all_packages=(
  coinbase-agentkit
  create-onchain-agent
  framework-extensions/langchain
  framework-extensions/openai-agents-sdk
)

echo ""

for package in "${all_packages[@]}"; do
  if git diff --quiet HEAD -- "$package/pyproject.toml"; then
    echo "No changes in $package/pyproject.toml"
  else
    echo "Changes detected in $package/pyproject.toml"
    changed_packages+=("$package")
  fi
done

for package in "${changed_packages[@]}"; do
  cd $package
  uv sync
  uv run -- towncrier build --yes
  cd - > /dev/null
done