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
