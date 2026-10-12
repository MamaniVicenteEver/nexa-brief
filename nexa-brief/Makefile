# Nexa Brief — comandos del día a día. `make help` los lista.
SHELL := /bin/bash
SERVER := nexa-brief-server
WEB := nexa-brief-web
# La API en Docker corre con tu UID/GID para poder escribir en src/templates (montado).
export APP_UID ?= $(shell id -u)
export APP_GID ?= $(shell id -g)

.DEFAULT_GOAL := help
.PHONY: help setup dev api web test lint format check seed-admin media-pull media-push media-status preview-media \
        docker-build docker-up docker-down docker-logs docker-verify docker-seed-admin

help: ## Lista los comandos
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[1m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Instala todo y crea .env, claves y usuario admin (se puede repetir)
	./scripts/setup.sh

dev: ## API (:8000, con recarga) + web (:3000); Ctrl+C corta las dos
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(SERVER) && uv run uvicorn src.presentation.main:app --reload --reload-dir src --host 0.0.0.0 --port 8000) & \
	(cd $(WEB) && pnpm dev --hostname 0.0.0.0 --port 3000) & \
	wait

api: ## Solo la API
	cd $(SERVER) && uv run uvicorn src.presentation.main:app --reload --reload-dir src --host 0.0.0.0 --port 8000

web: ## Solo la web
	cd $(WEB) && pnpm dev --hostname 0.0.0.0 --port 3000

test: ## Tests del backend
	cd $(SERVER) && uv run pytest -q

lint: ## ruff (backend) + biome y tsc (web)
	cd $(SERVER) && uv run ruff check src tests
	cd $(WEB) && pnpm lint && pnpm exec tsc --noEmit

format: ## Formatea con ruff y biome
	cd $(SERVER) && uv run ruff check --fix src tests
	cd $(WEB) && pnpm check

check: lint test ## Lo mismo que corre la CI

seed-admin: ## Crea/actualiza el admin de la web: make seed-admin EMAIL=… PASSWORD=…
	cd $(WEB) && node scripts/seed-admin.mjs $(EMAIL) $(PASSWORD)

media-pull: ## Baja audios/videos de las plantillas (MEDIA_REMOTE en .env)
	./scripts/media.sh pull

media-push: ## Sube audios/videos nuevos de las plantillas al remoto
	./scripts/media.sh push

media-status: ## Qué medios faltan, sin copiar nada
	./scripts/media.sh status

preview-media: ## Versiones livianas de videos/imágenes para las vistas previas (se generan solas si falta)
	cd $(SERVER) && uv run python -m src.presentation.api.preview_media src/templates/nodemotion

docker-build: ## Construye las imágenes api + web
	docker compose build

docker-up: ## Levanta api + web en segundo plano
	docker compose up -d

docker-down: ## Detiene (conserva los volúmenes con datos)
	docker compose down

docker-logs: ## Logs en vivo
	docker compose logs -f

docker-verify: ## Build + up + salud + una llamada real a la API
	./scripts/verify-docker.sh

docker-seed-admin: ## Admin dentro del contenedor web: make docker-seed-admin EMAIL=… PASSWORD=…
	docker compose exec web node scripts/seed-admin.mjs $(EMAIL) $(PASSWORD)
