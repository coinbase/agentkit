ifneq (,$(wildcard ./.env))
	include .env
	export $(shell sed 's/=.*//' .env)
endif

.PHONY: run
run:
	@export $(cat .env | xargs) && \
	poetry install && \
	poetry run python chatbot.py
