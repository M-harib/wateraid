SHELL := bash
.ONESHELL:
MAKEFLAGS += --no-print-directory

BE_PORT ?= 8010
FE_PORT ?= 5173
RUN := $(CURDIR)/.run

.PHONY: help install up down restart be fe status logs

help:
	@echo "make install  - uv sync + frontend npm install"
	@echo "make up       - start backend (:$(BE_PORT)) + frontend (:$(FE_PORT)) in the background"
	@echo "make down     - stop both (by port)"
	@echo "make restart  - down, then up"
	@echo "make status   - show what is running"
	@echo "make logs     - tail the background logs"
	@echo "make be       - run backend in the foreground (with --reload)"
	@echo "make fe       - run frontend in the foreground (HMR)"

install:
	uv sync
	cd frontend && npm install

up:
	@mkdir -p "$(RUN)"
	if lsof -ti:$(BE_PORT) >/dev/null 2>&1; then
	  echo "backend already running on :$(BE_PORT)"
	else
	  setsid uv run uvicorn api.main:app --host 127.0.0.1 --port $(BE_PORT) >"$(RUN)/be.log" 2>&1 </dev/null &
	  echo "backend  -> http://localhost:$(BE_PORT)  (log: .run/be.log)"
	fi
	if lsof -ti:$(FE_PORT) >/dev/null 2>&1; then
	  echo "frontend already running on :$(FE_PORT)"
	else
	  ( cd "$(CURDIR)/frontend" && setsid npm run dev >"$(RUN)/fe.log" 2>&1 </dev/null & )
	  echo "frontend -> http://localhost:$(FE_PORT)  (log: .run/fe.log)"
	fi

down:
	@lsof -ti:$(BE_PORT) 2>/dev/null | xargs -r kill 2>/dev/null && echo "stopped backend (:$(BE_PORT))" || echo "backend not running"
	lsof -ti:$(FE_PORT) 2>/dev/null | xargs -r kill 2>/dev/null && echo "stopped frontend (:$(FE_PORT))" || echo "frontend not running"

restart:
	@$(MAKE) down
	sleep 1
	$(MAKE) up

be:
	uv run uvicorn api.main:app --host 127.0.0.1 --port $(BE_PORT) --reload

fe:
	cd frontend && npm run dev

status:
	@lsof -ti:$(BE_PORT) >/dev/null 2>&1 && echo "backend  UP   (:$(BE_PORT))" || echo "backend  DOWN (:$(BE_PORT))"
	lsof -ti:$(FE_PORT) >/dev/null 2>&1 && echo "frontend UP   (:$(FE_PORT))" || echo "frontend DOWN (:$(FE_PORT))"

logs:
	@touch "$(RUN)/be.log" "$(RUN)/fe.log"
	tail -n 40 -f "$(RUN)/be.log" "$(RUN)/fe.log"
