.PHONY: dev
dev:
	DEV=1 bun run --watch test.ts
