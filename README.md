# TC VRM Viewer

A browser-based VRM avatar model viewer built with preact + TypeScript + vite +
three.js / @pixiv/three-vrm, designed to interoperate with tc-storage.

## Features

- Load `.vrm` files via drag & drop or file picker, rendered with an orbit
  camera, lighting, and a ground grid.
- Display VRM metadata (name, authors, license).
- Expression (blend shape) sliders and idle auto-blink.
- Import VRM files from tc-storage FolderBundle / FileBundle JSON.
- Local model library backed by IndexedDB.
- P2P feature (mistlib) to join a tc-storage share room and receive VRM files
  in receive-only mode.

## Setup

```bash
npm install
npm run dev
```

## Building mistlib-wasm (optional)

To use the P2P receive feature, mistlib-wasm must be built and vendored.
mistlib is a private repository, so its URL is managed only via `.env`
(gitignored).

```bash
cp .env.example .env
# set MISTLIB_REPO / MISTLIB_REF in .env
npm run build:mistlib
```

Even without this build, the rest of the app (local VRM loading, bundle
import, the model library) still works, and the P2P panel shows setup
instructions instead.

## Test / Build

```bash
npm test
npm run build
```

## Third-Party Licenses

- [three.js](https://github.com/mrdoob/three.js) — MIT License
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — MIT License
- [preact](https://github.com/preactjs/preact) — MIT License
- [lucide](https://github.com/lucide-icons/lucide) — ISC License

This repository does not include any sample VRM models. VRM models are each
subject to their own license terms.

## Deployment

Pushing to `main` triggers the GitHub Pages workflow (`.github/workflows/deploy-pages.yml`),
which builds the app with `VITE_BASE_PATH=/tc-vrm-viewer/` and publishes `dist/` to Pages.
Set the repository's Pages source to "GitHub Actions". The committed mistlib-wasm artifacts
are used as-is, so CI needs no access to the private mistlib repository.
