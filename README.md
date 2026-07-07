# TC Avatar

A fast, **private, browser-based viewer for VRM avatar models**. Load a `.vrm`
file, inspect its metadata, tweak facial expressions in real time, and import
models shared through tc-storage — all rendered locally with three.js. Nothing
is uploaded: your models never leave your device.

Built with Preact · TypeScript · Vite · three.js / [@pixiv/three-vrm](https://github.com/pixiv/three-vrm).

## Highlights

- 🎭 **Instant preview** — drag & drop a `.vrm` file (or pick one) and orbit
  around it with lighting and a ground grid.
- 🙂 **Expression control** — live blend-shape sliders plus an idle auto-blink.
- 🗂️ **Local library** — imported models are kept in IndexedDB, so they are one
  click away next time.
- 🌗 **Light & dark themes** — light by default, with a one-tap toggle that is
  remembered across sessions and applies to the 3D scene too.
- 🔒 **Private by design** — all parsing and rendering happen in your browser.
- 🤝 **tc-storage interop** — import VRM files from tc-storage bundles and, when
  the optional P2P module is built, receive models from a share room.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Drop a `.vrm` file onto the left panel to load
your first model.

## Building mistlib-wasm (optional P2P)

The P2P receive feature needs `mistlib-wasm` built and vendored. mistlib is a
private repository, so its URL is configured only via `.env` (gitignored).

```bash
cp .env.example .env
# set MISTLIB_REPO / MISTLIB_REF in .env
npm run build:mistlib
```

Without this build, everything else (local VRM loading, bundle import, the model
library, expressions, theming) still works — the P2P and Storage panels simply
show setup instructions instead.

## Scripts

```bash
npm run dev       # start the dev server
npm test          # type-check + run the unit tests
npm run build     # type-check and produce a production build in dist/
npm run preview   # preview the production build locally
```

## Deployment

Pushing to `main` triggers the GitHub Pages workflow
(`.github/workflows/deploy-pages.yml`), which builds with
`VITE_BASE_PATH=/tc-vrm-viewer/` and publishes `dist/` to Pages. Set the
repository's Pages source to "GitHub Actions". The committed mistlib-wasm
artifacts are used as-is, so CI needs no access to the private mistlib repo.

## Third-party licenses

- [three.js](https://github.com/mrdoob/three.js) — MIT License
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — MIT License
- [preact](https://github.com/preactjs/preact) — MIT License
- [lucide](https://github.com/lucide-icons/lucide) — ISC License

This repository does not include any sample VRM models. VRM models are each
subject to their own license terms.
