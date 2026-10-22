SHELL := bash
MAKEFLAGS += --no-print-directory

# Works with the GNU Make 3.81 that ships with macOS as well as newer versions:
# every multi-line recipe step is joined with backslashes, so .ONESHELL is not needed.

BE_PORT ?= 8010
FE_PORT ?= 5173
RUN := $(CURDIR)/.run

# The frontend talks to the backend on BE_PORT unless VITE_API_BASE_URL is already set.
VITE_API_BASE_URL ?= http://localhost:$(BE_PORT)
export VITE_API_BASE_URL

# Backend runner: uv when installed, otherwise a local virtualenv (backend/.venv, then ./.venv).
UV := $(shell command -v uv 2>/dev/null)
VENV_PY := $(firstword $(wildcard $(CURDIR)/backend/.venv/bin/python $(CURDIR)/.venv/bin/python))
ifneq ($(UV),)
  UVICORN := uv run uvicorn
else ifneq ($(VENV_PY),)
  UVICORN := $(VENV_PY) -m uvicorn
endif

# Detach background servers: setsid on Linux; macOS has no setsid, so fall back to nohup.
DETACH := $(if $(shell command -v setsid 2>/dev/null),setsid,nohup)

.PHONY: help install up down restart be fe status logs check-backend

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
	@if [ -z "$(UV)" ]; then \
	  echo "uv is not installed. Install it (macOS: brew install uv; other: https://docs.astral.sh/uv/) and rerun."; \
	  exit 1; \
	fi
	cd backend && uv sync
	cd frontend && npm install

check-backend:
	@if [ -z "$(UVICORN)" ]; then \
	  echo "No backend runner: install uv and run 'make install', or create a virtualenv in backend/.venv or ./.venv."; \
	  exit 1; \
	fi

up: check-backend
	@mkdir -p "$(RUN)"
	@if lsof -ti:$(BE_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
	  echo "backend already running on :$(BE_PORT)"; \
	else \
	  ( cd "$(CURDIR)/backend" && exec $(DETACH) $(UVICORN) api.main:app --host 127.0.0.1 --port $(BE_PORT) >"$(RUN)/be.log" 2>&1 </dev/null & ); \
	  echo "backend  -> http://localhost:$(BE_PORT)  (log: .run/be.log)"; \
	fi
	@if lsof -ti:$(FE_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
	  echo "frontend already running on :$(FE_PORT)"; \
	else \
	  ( cd "$(CURDIR)/frontend" && exec $(DETACH) npm run dev -- --port $(FE_PORT) --strictPort >"$(RUN)/fe.log" 2>&1 </dev/null & ); \
	  echo "frontend -> http://localhost:$(FE_PORT)  (log: .run/fe.log)"; \
	fi

down:
	@lsof -ti:$(BE_PORT) -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null && echo "stopped backend (:$(BE_PORT))" || echo "backend not running"
	@lsof -ti:$(FE_PORT) -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null && echo "stopped frontend (:$(FE_PORT))" || echo "frontend not running"

restart:
	@$(MAKE) down
	@sleep 1
	@$(MAKE) up

be: check-backend
	cd backend && $(UVICORN) api.main:app --host 127.0.0.1 --port $(BE_PORT) --reload

fe:
	cd frontend && npm run dev -- --port $(FE_PORT)

status:
	@lsof -ti:$(BE_PORT) -sTCP:LISTEN >/dev/null 2>&1 && echo "backend  UP   (:$(BE_PORT))" || echo "backend  DOWN (:$(BE_PORT))"
	@lsof -ti:$(FE_PORT) -sTCP:LISTEN >/dev/null 2>&1 && echo "frontend UP   (:$(FE_PORT))" || echo "frontend DOWN (:$(FE_PORT))"

logs:
	@mkdir -p "$(RUN)"
	@touch "$(RUN)/be.log" "$(RUN)/fe.log"
	@tail -n 40 -f "$(RUN)/be.log" "$(RUN)/fe.log"
