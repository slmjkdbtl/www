.PHONY: dev
dev:
	cd example && DEV=1 bun run --watch main.ts
