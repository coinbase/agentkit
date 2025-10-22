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
	uv run sphinx-apidoc -f -o ./docs ./coinbase_agentkit_autogen

.PHONY: local-docs
local-docs: docs
	cd docs && make html && open ./_build/html/index.html

.PHONY: test
test:
	@if [ -d "tests" ] || find . -name "test_*.py" -o -name "*_test.py" | grep -q .; then \
		uv run pytest; \
	else \
		echo "No tests found. Skipping test execution."; \
	fi