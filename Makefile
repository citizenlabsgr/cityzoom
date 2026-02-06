.PHONY: install
install:
	npm install --no-save @playwright/test
	npx playwright install chromium

.PHONY: all
all: format test

.PHONY: format
format:
	npx --yes prettier --write . --log-level=silent

.PHONY: test
test: install
	npx playwright test

.PHONY: dev
dev: install
	npx --yes nodemon --ext js,json,html,css --watch . --exec "clear; make all; echo"

.PHONY: run
run:
	npx --yes live-server --no-browser --ignore='test-results/**,**/test-results/**'
