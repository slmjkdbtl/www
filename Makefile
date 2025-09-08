DEMO := server

.PHONY: run
run:
	cd demo && DEV=1 bun run --watch $(DEMO).ts
