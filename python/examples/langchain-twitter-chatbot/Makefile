ifneq (,$(wildcard ./.env))
	include .env
endif

export

.PHONY: install
install:
	poetry install

.PHONY: run
run:
	poetry run python chatbot.py
