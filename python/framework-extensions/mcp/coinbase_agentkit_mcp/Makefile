.PHONY: install
install:
	pip install -e .

.PHONY: install-dev
install-dev:
	pip install -e ".[dev]"

.PHONY: test
test:
	pytest tests/

.PHONY: format
format:
	black .
	ruff check . --fix

.PHONY: lint
lint:
	black --check .
	ruff check .
	mypy coinbase_agentkit_mcp

.PHONY: clean
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete