.PHONY: help up-dev run up-prod deploy down build lint logs

.DEFAULT_GOAL := help

help: ## Show available commands
	@echo ""
	@echo "SmartWarehouse Web App — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Docker targets ───────────────────────────────────────────────────────────

up-dev: ## Start the Vite dev server in Docker (http://localhost:5173)
	docker compose up --build

run: up-dev ## Alias for up-dev

up-prod: ## Start the nginx static container (served under /app behind the proxy)
	docker compose -f docker-compose.prod.yml up -d
	@echo "Web app started (container webapp:80)"

deploy: ## Pull the newest image and restart
	docker compose -f docker-compose.prod.yml pull
	docker compose -f docker-compose.prod.yml up -d
	@echo "Web app redeployed"

down: ## Stop and remove containers
	docker compose down

# ─── Build / quality ──────────────────────────────────────────────────────────

build: ## Run the production build
	npm run build
	@echo "Build complete"

lint: ## Run ESLint
	npm run lint

# ─── Observability ────────────────────────────────────────────────────────────

logs: ## Follow the web app container logs
	docker compose -f docker-compose.prod.yml logs -f webapp
