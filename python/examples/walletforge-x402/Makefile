ifneq (,$(wildcard ./.env))
	include .env
endif

export

.PHONY: install
install:
	uv sync

.PHONY: run
run:
	uv run example.py

.PHONY: unpaid
unpaid:
	uv run example.py

.PHONY: format
format:
	uv run ruff format .

.PHONY: lint
lint:
	uv run ruff check .
