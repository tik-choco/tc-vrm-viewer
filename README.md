# TC VRM Viewer

ブラウザで動作するVRMアバターモデルビューアです。preact + TypeScript + vite + three.js /
@pixiv/three-vrm で実装されており、tc-storage と相互運用できます。

## 機能

- `.vrm` ファイルのドラッグ&ドロップ / ファイル選択で読み込み、オービットカメラ・ライト・グリッドで表示。
- VRM メタ情報（名前・作者・ライセンス）の表示。
- 表情（ブレンドシェイプ）スライダーと自動まばたき。
- tc-storage の FolderBundle / FileBundle JSON からVRMファイルを取り込み。
- IndexedDB を使ったローカルモデルライブラリ。
- tc-storage の共有ルームに参加し、VRMファイルを受信専用で受け取るP2P機能（mistlib）。

## セットアップ

```bash
npm install
npm run dev
```

## mistlib-wasm のビルド（任意）

P2P受信機能を使うには mistlib-wasm をビルドしてベンダリングする必要があります。
mistlib はプライベートリポジトリのため、URLは `.env`（gitignore対象）でのみ管理します。

```bash
cp .env.example .env
# .env の MISTLIB_REPO / MISTLIB_REF を設定
npm run build:mistlib
```

未ビルドの場合でもアプリの他の機能（ローカルVRM読み込み・bundle取り込み・ライブラリ）は動作し、
P2Pパネルにはセットアップ手順が表示されます。

## テスト / ビルド

```bash
npm test
npm run build
```

## サードパーティライセンス

- [three.js](https://github.com/mrdoob/three.js) — MIT License
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — MIT License
- [preact](https://github.com/preactjs/preact) — MIT License
- [lucide](https://github.com/lucide-icons/lucide) — ISC License

このリポジトリにはサンプルのVRMモデルは含まれていません。VRMモデルにはそれぞれのライセンス条件があります。
