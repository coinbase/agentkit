ifneq (,$(wildcard ./.env))
	include .env
endif

export

.PHONY: install
install:
	poetry install

.PHONY: format
format:
	poetry run ruff format .

.PHONY: format-check
format-check:
	poetry run ruff format . --check

.PHONY: lint
lint:
	poetry run ruff check .

.PHONY: lint-fix
lint-fix:
	poetry run ruff check . --fix

.PHONY: docs
docs:
	poetry run sphinx-apidoc -f -o ./docs ./coinbase_agentkit

.PHONY: local-docs
local-docs: docs
	cd docs && make html && open ./_build/html/index.html

.PHONY: test
test:
	poetry run pytest -m "not (e2e or integration)"

.PHONY: test-e2e
test-e2e:
	poetry run pytest -m e2e

.PHONY: test-integration
test-integration:
	poetry run pytest -m integration

.PHONY: check-description-length
check-description-length:
	poetry run check-description-length

.PHONY: generate-action-provider
generate-action-provider:
	poetry run generate-action-provider
