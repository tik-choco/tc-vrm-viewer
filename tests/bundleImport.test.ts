import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bytesFromDataUrl, bytesToDataUrl, parseBundleJson } from '../src/storage/bundleImport.js'
import type { FileRecord, FolderBundle, FileBundle } from '../src/storage/domain.js'

function baseFolder() {
  return {
    id: 'folder-1',
    name: 'Models',
    parentId: null,
    color: 'teal' as const,
    encrypted: false,
    shareEnabled: false,
    sharedRoomId: 'room-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function vrmFileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  const bytes = new Uint8Array([1, 2, 3, 4])
  return {
    id: 'file-1',
    folderId: 'folder-1',
    name: 'avatar.vrm',
    mimeType: 'model/gltf-binary',
    size: bytes.byteLength,
    dataUrl: bytesToDataUrl(bytes, 'model/gltf-binary'),
    checksum: 'abc',
    version: 1,
    starred: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

test('parses a valid FolderBundle and extracts VRM files', () => {
  const bundle: FolderBundle = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    originNode: 'node-1',
    folder: baseFolder(),
    files: [vrmFileRecord(), vrmFileRecord({ id: 'file-2', name: 'other.txt', mimeType: 'text/plain' })],
  }
  const result = parseBundleJson(JSON.stringify(bundle))
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'avatar.vrm')
  assert.deepEqual([...result[0].bytes], [1, 2, 3, 4])
})

test('parses a valid FileBundle with a single VRM file', () => {
  const bundle: FileBundle = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    originNode: 'node-1',
    folder: baseFolder(),
    file: vrmFileRecord(),
  }
  const result = parseBundleJson(JSON.stringify(bundle))
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'avatar.vrm')
})

test('throws on invalid JSON', () => {
  assert.throws(() => parseBundleJson('{not json'), /Invalid bundle JSON/)
})

test('throws on JSON that is not a recognizable bundle', () => {
  assert.throws(() => parseBundleJson(JSON.stringify({ hello: 'world' })), /Not a recognizable/)
})

test('skips non-VRM files by mimeType and extension', () => {
  const bundle: FolderBundle = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    originNode: 'node-1',
    folder: baseFolder(),
    files: [vrmFileRecord({ id: 'file-2', name: 'notes.txt', mimeType: 'text/plain' })],
  }
  const result = parseBundleJson(JSON.stringify(bundle))
  assert.equal(result.length, 0)
})

test('recognizes VRM files by extension even without the exact mimeType', () => {
  const bundle: FolderBundle = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    originNode: 'node-1',
    folder: baseFolder(),
    files: [vrmFileRecord({ name: 'avatar.VRM', mimeType: 'application/octet-stream' })],
  }
  const result = parseBundleJson(JSON.stringify(bundle))
  assert.equal(result.length, 1)
})

test('bytesFromDataUrl decodes base64 dataUrl round-trip', () => {
  const bytes = new Uint8Array([10, 20, 30, 255])
  const dataUrl = bytesToDataUrl(bytes, 'model/gltf-binary')
  assert.equal(dataUrl.startsWith('data:model/gltf-binary;base64,'), true)
  const decoded = bytesFromDataUrl(dataUrl)
  assert.deepEqual([...decoded], [10, 20, 30, 255])
})

test('bytesFromDataUrl throws on non-base64 dataUrl', () => {
  assert.throws(() => bytesFromDataUrl('data:text/plain,hello'), /Unsupported dataUrl encoding/)
})
