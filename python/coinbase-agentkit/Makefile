.PHONY: install
install:
	poetry install

.PHONY: format
format:
	poetry run ruff format .

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
	poetry run pytest