ifneq (,$(wildcard ./.env))
	include .env
endif

export

.PHONY: run
run:
	poetry install --with dev && \
	poetry run python chatbot.py
