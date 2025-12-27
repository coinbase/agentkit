.PHONY: format
format:
	poetry run ruff format .

.PHONY: lint
lint:
	poetry run ruff check .

.PHONY: lint-fix
lint-fix:
	poetry run ruff check . --fix

.PHONY: test
test:
	poetry run pytest

.PHONY: test-coverage
test-coverage:
	poetry run pytest --cov=cdp_crewai --cov-report=term-missing 

.PHONY: docs
docs:
	poetry run sphinx-build -b html docs/source docs/_build/html

.PHONY: local-docs
local-docs: docs
	cd docs && make html && open ./_build/html/index.html 