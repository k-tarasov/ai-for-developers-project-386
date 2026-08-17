.PHONY: lint test build dev dev-mock format spec

# --- Фронтенд ---

lint:
	cd frontend && npm run lint

test:
	cd frontend && npm run test

build:
	cd frontend && npm run build

dev:
	cd frontend && npm run dev

dev-mock:
	cd frontend && npm run dev:mock

format:
	cd frontend && npm run format

# --- Контракт API ---

spec:
	cd spec && npm run compile
