# Agent notes

## Visual / UI changes

**Check snapshots after changing anything that affects how the page looks.**  
The project has Playwright visual snapshots for multiple viewports (`tests/snapshots/`). If you change layout, controls, or styles:

1. Run snapshot tests: `npx playwright test --update-snapshots` (or `make snapshot` if available).
2. Commit updated snapshot images if the change is intentional.

Otherwise snapshot tests may fail in CI or for others.
