.PHONY: install
install:
	npm install --no-save @playwright/test
	npx playwright install chromium

.PHONY: all
all: format test

.PHONY: format
format:
	npx --yes prettier --write . --log-level=silent
ifdef CI
	git diff --exit-code
endif

.PHONY: test
test: install
ifdef CI
	npx playwright test --grep-invert="@snapshot"
else
	npx playwright test --update-snapshots
endif

.PHONY: dev
dev: install
	npx --yes nodemon --ext js,json,html,css --watch . --exec "clear; make all; echo"

.PHONY: run
run:
	npx --yes live-server --no-browser --watch=index.html,src
