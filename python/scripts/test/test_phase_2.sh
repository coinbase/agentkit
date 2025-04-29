# DO NOT RUN AFTER PHASE 1
# phase_2 requires the results of phase_1 to be pushed by pypi
# instead, downgrade dependencies in the pyproject.toml files to test

cd framework-extensions/langchain
uv run towncrier create --content "Fixed a bug" 123.bugfix.md
cd ../../

cd framework-extensions/openai-agents-sdk
uv run towncrier create --content "Fixed a bug" 123.bugfix.md
cd ../../

cd create-onchain-agent
uv run towncrier create --content "Fixed a bug" 123.bugfix.md
cd ..

./scripts/version_phase_2.sh