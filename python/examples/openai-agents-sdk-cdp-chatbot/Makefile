ifneq (,$(wildcard ./.env))
	include .env
endif

export

.PHONY: install
install:
	uv sync

.PHONY: run
run:
	uv run chatbot.py

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
