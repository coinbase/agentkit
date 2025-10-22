.PHONY: install
install:
	uv sync

.PHONY: format
format:
	uv run ruff format .

.PHONY: lint
lint:
	uv run ruff check .

.PHONY: run
run:
	uv run chatbot.py 