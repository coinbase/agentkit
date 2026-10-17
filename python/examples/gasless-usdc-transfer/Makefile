.PHONY: install
install:
	uv sync

.PHONY: run
run:
	uv run python main.py

.PHONY: test
test:
	uv run pytest -v

.PHONY: format
format:
	uv run ruff format .

.PHONY: lint
lint:
	uv run ruff check .
