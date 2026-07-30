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
- 🤝 **tc-storage interop** — import VRM files from tc-storage bundles and
  receive models from a share room over P2P.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Drop a `.vrm` file onto the left panel to load
your first model.

## P2P (mistlib)

The P2P receive feature is powered by [`@tik-choco/mistlib`](https://www.npmjs.com/package/@tik-choco/mistlib),
an ordinary npm dependency — no Rust toolchain, no separate build step, and no
private repository access needed.

If the module ever fails to load (e.g. an unsupported browser), the rest of the
app (local VRM loading, bundle import, the model library, expressions, theming)
still works — the P2P and Storage panels simply show a setup hint instead.

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
repository's Pages source to "GitHub Actions". `@tik-choco/mistlib` is
installed from the public npm registry, so CI needs no access to any private
repository.

## Third-party licenses

- [three.js](https://github.com/mrdoob/three.js) — MIT License
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — MIT License
- [preact](https://github.com/preactjs/preact) — MIT License
- [lucide](https://github.com/lucide-icons/lucide) — ISC License

This repository does not include any sample VRM models. VRM models are each
subject to their own license terms.
