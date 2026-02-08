# City Zoom

Compare two locations side by side with synchronized zoom levels. Annotate the maps to highlight interesting comparisons. Share a link to save or send your view.

> [cityzoom.link](https://cityzoom.link/?zoom=14&lat1=42.48469&lon1=-83.43823&lat2=43.01731&lon2=-85.67808)

## Features

- **Synchronized zoom** across two maps
- **Search** for specific places on either map
- **Use current location** to reposition a map
- **Draw** boundary shape annotations on maps
- **Copy URL** to share your exact view and annotations
- **Randomize** to load a different example comparison

## Development

The app is static, but a recent version of Node.js (with `npx`) is used for local development.

- `make run` — starts live-reload server: http://localhost:8080
- `make dev` — runs the formatter + tests on file changes
- `make all` — runs all of the pre-commit actions
