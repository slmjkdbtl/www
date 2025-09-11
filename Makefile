DEMO := server

.PHONY: run
run:
	cd demo && DEV=1 bun run --watch $(DEMO).ts

.PHONY: check
check:
	bunx tsc
