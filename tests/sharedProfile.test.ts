import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEffectiveProfile, loadSharedProfile, parseSharedProfileRecord, saveSharedProfile, type SharedProfile } from '../src/profile/sharedProfile.js'
import type { SharedStorageBackend } from '../src/profile/sharedStorage.js'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function createMemoryBackend(): SharedStorageBackend {
  const blobs = new Map<string, Uint8Array>()
  let nextCid = 0
  return {
    store: async (bytes) => {
      const cid = `cid-${nextCid}`
      nextCid += 1
      blobs.set(cid, bytes)
      return cid
    },
    retrieve: async (cid) => blobs.get(cid),
  }
}

test('parseSharedProfileRecord accepts a well-formed record', () => {
  const record = parseSharedProfileRecord({
    version: 1,
    name: 'Ada',
    did: 'did:key:z6Mktest',
    avatarMime: 'image/png',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  assert.ok(record)
  assert.equal(record?.name, 'Ada')
  assert.equal(record?.did, 'did:key:z6Mktest')
})

test('parseSharedProfileRecord accepts a record without an avatar', () => {
  const record = parseSharedProfileRecord({
    version: 1,
    name: 'Ada',
    did: 'did:key:z6Mktest',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  assert.ok(record)
  assert.equal(record?.avatarMime, undefined)
})

test('parseSharedProfileRecord rejects wrong version', () => {
  const record = parseSharedProfileRecord({ version: 2, name: 'Ada', did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' })
  assert.equal(record, undefined)
})

test('parseSharedProfileRecord rejects missing required fields', () => {
  assert.equal(parseSharedProfileRecord({ version: 1, name: 'Ada' }), undefined)
  assert.equal(parseSharedProfileRecord({ version: 1, did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' }), undefined)
})

test('parseSharedProfileRecord rejects an empty name', () => {
  const record = parseSharedProfileRecord({ version: 1, name: '   ', did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' })
  assert.equal(record, undefined)
})

test('parseSharedProfileRecord rejects non-object input', () => {
  assert.equal(parseSharedProfileRecord('not-an-object'), undefined)
  assert.equal(parseSharedProfileRecord(null), undefined)
  assert.equal(parseSharedProfileRecord(undefined), undefined)
})

test('parseSharedProfileRecord rejects wrong field types', () => {
  assert.equal(parseSharedProfileRecord({ version: 1, name: 42, did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' }), undefined)
  assert.equal(parseSharedProfileRecord({ version: 1, name: 'Ada', did: 'did:key:z6Mktest', avatarMime: 5, updatedAt: '2026-01-01T00:00:00.000Z' }), undefined)
})

test('getEffectiveProfile prefers the shared profile when present', () => {
  const shared: SharedProfile = { name: 'Ada', did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' }
  const effective = getEffectiveProfile(shared, { name: 'Local user' })
  assert.equal(effective.name, 'Ada')
  assert.equal(effective.did, 'did:key:z6Mktest')
})

test('getEffectiveProfile falls back to the local name when no shared profile exists', () => {
  const effective = getEffectiveProfile(undefined, { name: 'Local user' })
  assert.equal(effective.name, 'Local user')
  assert.equal(effective.did, undefined)
})

test('saveSharedProfile then loadSharedProfile round-trips via the mistlib-backed CID pointer', async () => {
  const backend = createMemoryBackend()
  const storage = new MemoryStorage()

  await saveSharedProfile({ name: 'Ada', did: 'did:key:z6Mktest' }, backend, storage)
  const loaded = await loadSharedProfile(backend, storage)

  assert.ok(loaded)
  assert.equal(loaded?.name, 'Ada')
  assert.equal(loaded?.did, 'did:key:z6Mktest')
  assert.ok(storage.getItem('tc-shared-profile-cid-v1'))
})

test('loadSharedProfile falls back to the shared localStorage copy when the backend has no data for the pointed CID', async () => {
  const backend = createMemoryBackend()
  const storage = new MemoryStorage()
  storage.setItem('tc-shared-profile-cid-v1', 'missing-cid')
  storage.setItem(
    'tc-shared-profile-v1',
    JSON.stringify({ version: 1, name: 'Fallback Ada', did: 'did:key:z6Mktest', updatedAt: '2026-01-01T00:00:00.000Z' }),
  )

  const loaded = await loadSharedProfile(backend, storage)
  assert.equal(loaded?.name, 'Fallback Ada')
})

test('saveSharedProfile always writes the shared localStorage fallback copy, even without a backend', async () => {
  const storage = new MemoryStorage()

  await saveSharedProfile({ name: 'Ada', did: 'did:key:z6Mktest' }, undefined, storage)

  const loaded = await loadSharedProfile(undefined, storage)
  assert.equal(loaded?.name, 'Ada')
  assert.equal(storage.getItem('tc-shared-profile-cid-v1'), null)
})

test('loadSharedProfile returns undefined when no backend, no CID pointer, and no fallback copy exist', async () => {
  const storage = new MemoryStorage()
  const loaded = await loadSharedProfile(undefined, storage)
  assert.equal(loaded, undefined)
})
