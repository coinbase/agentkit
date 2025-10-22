ifneq (,$(wildcard ./.env))
	include .env
endif

export

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
	uv run sphinx-apidoc -f -o ./docs ./coinbase_agentkit

.PHONY: local-docs
local-docs: docs
	cd docs && make html && open ./_build/html/index.html

.PHONY: test
test:
	uv run pytest -m "not (e2e or integration)"

.PHONY: test-e2e
test-e2e:
	uv run pytest -m e2e

.PHONY: test-integration
test-integration:
	uv run pytest -m integration

.PHONY: changelog
changelog:
	uv run towncrier create

.PHONY: check-description-length
check-description-length:
	uv run check-description-length

.PHONY: generate-action-provider
generate-action-provider:
	uv run generate-action-provider
