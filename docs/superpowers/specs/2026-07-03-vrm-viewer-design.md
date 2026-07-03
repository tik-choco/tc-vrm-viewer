# tc-vrm-viewer Design

Date: 2026-07-03

## Purpose
A web-based VRM model viewer (preact + TypeScript + vite) that interoperates with
tc-storage: it can open VRM files locally, import tc-storage bundles, and receive
VRM files over P2P (mistlib) from tc-storage share rooms.

## Constraints
- Public GitHub repository → only permissively-licensed dependencies
  (three.js: MIT, @pixiv/three-vrm: MIT, preact: MIT, lucide-preact: ISC/MIT).
  No sample VRM models bundled (avatar models carry per-model licenses / VRM meta).
- mistlib is a private repo. Its URL lives only in `.env` (gitignored).
  `scripts/build-mistlib.sh` (same pattern as tc-storage) clones it, builds with
  wasm-pack and vendors artifacts into `src/vendor/mistlib-wasm/`. `BUILD_INFO.txt`
  records ref+commit but never the repo URL.
- Data structures are copied verbatim from tc-storage `src/storage/domain.ts`
  (`FileRecord`, `FolderRecord`, `FolderBundle`, `FileBundle`, `StorageSnapshot`,
  `VersionStamp`) and the P2P envelope from `src/p2p/p2pTypes.ts` (`ShareEnvelope`),
  so bundles and share rooms are wire-compatible.
- Depends on `tc-interop` via `file:../tc-interop` like sibling apps.

## Architecture
```
src/
  main.tsx / app.tsx        — shell, routing-free single page with panels
  viewer/                    — three.js + @pixiv/three-vrm scene
    scene.ts                 — renderer, camera, lights, orbit controls, resize
    vrmLoader.ts             — GLTFLoader + VRMLoaderPlugin; load from File/Blob/dataUrl
    expressions.ts           — VRM expression (blendshape) control helpers
  storage/
    domain.ts                — types copied from tc-storage (kept in sync manually)
    bundleImport.ts          — parse FolderBundle/FileBundle JSON, dataUrl → Blob
    library.ts               — local model library in IndexedDB using FileRecord shape
  p2p/
    p2pTypes.ts              — ShareEnvelope subset (hello / file-share / folder-share)
    p2pMist.ts               — mistlib wasm init + room join + receive-only handling
  components/                — DropZone, ModelLibrary, ExpressionPanel, RoomPanel
  vendor/mistlib-wasm/       — vendored wasm artifacts (generated)
```

## Features (MVP)
1. Drag & drop / file-picker load of `.vrm` — render with orbit camera, lighting,
   ground grid; show VRM meta (name, author, license fields from VRM meta).
2. Import tc-storage `FolderBundle` / `FileBundle` JSON; VRM files inside
   (mimeType `model/gltf-binary` or name `*.vrm`) are decoded from `dataUrl`
   and added to the local library.
3. Local library (IndexedDB) storing `FileRecord`-shaped entries; click to view.
4. P2P receive: join a tc-storage share room by roomId via mistlib; on
   `file-share` envelopes carrying a VRM, offer to view/save. Receive-only in MVP.
5. Expression panel: list VRM expressions with sliders; simple idle auto-blink.

## Error handling
- Invalid VRM / bundle JSON → toast-style inline error, never crash the scene.
- mistlib wasm missing (not vendored) → P2P panel shows setup hint; the rest of
  the app works without it (dynamic import guard, same as tc-storage's approach).

## Testing
- `tsc -b` type check; node --test unit tests for bundleImport parsing and
  domain guards (mirrors tc-storage test setup). Rendering verified manually.

## Licensing / publication checklist
- MIT LICENSE at repo root; NOTICE of third-party licenses in README.
- `.gitignore`: `.env`, `.env.*` (keep `.env.example`), node_modules, dist.
- VRM meta license info is displayed to the user when a model loads.
