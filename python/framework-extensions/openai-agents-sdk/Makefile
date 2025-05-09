.PHONY: install
install:
	uv sync

.PHONY: format
format:
	uv run ruff format .

.PHONY: format-check
format-check:
	uv run ruff format . --check

.PHONY: lint
lint:
	uv run ruff check .

.PHONY: lint-fix
lint-fix:
	uv run ruff check . --fix

.PHONY: docs
docs:
	uv run sphinx-apidoc -f -o ./docs ./coinbase_agentkit_openai_agents_sdk

.PHONY: local-docs
local-docs: docs
	cd docs && make html && open ./_build/html/index.html

.PHONY: test
test:
	uv run pytest

.PHONY: check-deps
check-deps:
	uv run python scripts/check_dependencies.py
