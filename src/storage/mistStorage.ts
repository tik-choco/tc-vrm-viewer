/**
 * Read-only subset of tc-storage's src/storage/mistStorage.ts: this app is a
 * receive-only "viewer" peer, so only the storage_get + decrypt path is
 * ported (loadEncryptedFolderFromMist / loadEncryptedFileFromMist). Runtime
 * init is delegated to this app's existing ensureMistRuntime (p2p/p2pMist.ts)
 * instead of duplicating that guard here.
 */
import { decryptJson, type EncryptedPayload } from './tcCrypto.js'
import type { FileBundle, FolderBundle } from './domain.js'
import { ensureMistRuntime, getOrCreateNodeId, loadMistModule } from '../p2p/p2pMist.js'
import type { MistModule } from '../p2p/p2pTypes.js'

export type MistRuntimeSettings = {
  nodeId?: string
}

type StoredBundleKind = 'file' | 'folder'

const decoder = new TextDecoder()

export function loadEncryptedFolderFromMist(cid: string, passphrase: string, runtime: MistRuntimeSettings = {}): Promise<FolderBundle> {
  return loadEncryptedBundle<FolderBundle>('folder', cid, passphrase, runtime)
}

export function loadEncryptedFileFromMist(cid: string, passphrase: string, runtime: MistRuntimeSettings = {}): Promise<FileBundle> {
  return loadEncryptedBundle<FileBundle>('file', cid, passphrase, runtime)
}

async function loadEncryptedBundle<T>(kind: StoredBundleKind, cid: string, passphrase: string, runtime: MistRuntimeSettings): Promise<T> {
  const mist = await loadMistModule()
  if (!mist) throw new Error('mistlib-wasm has not been built yet. Set MISTLIB_REPO in .env, then run npm run build:mistlib.')
  ensureMistRuntime(mist, runtime.nodeId ?? getOrCreateNodeId())
  const normalizedCid = cid.trim()
  const bytes = await loadStoredBytes(mist, kind, normalizedCid)
  const encrypted = parseEncryptedPayload(bytes, kind)
  return decryptEncryptedPayload<T>(encrypted, passphrase, kind)
}

async function loadStoredBytes(mist: Pick<MistModule, 'storage_get'>, kind: StoredBundleKind, cid: string): Promise<Uint8Array> {
  try {
    return await mist.storage_get(cid)
  } catch (error) {
    throw new Error(`Failed to retrieve the ${kind} from storage (cid: ${cid}): ${describeError(error)}`)
  }
}

function parseEncryptedPayload(bytes: Uint8Array, kind: StoredBundleKind): EncryptedPayload {
  const text = decoder.decode(bytes)
  try {
    return JSON.parse(text) as EncryptedPayload
  } catch (error) {
    throw new Error(`Could not parse the stored ${kind} JSON: ${describeError(error)}`)
  }
}

async function decryptEncryptedPayload<T>(encrypted: EncryptedPayload, passphrase: string, kind: StoredBundleKind): Promise<T> {
  try {
    return await decryptJson<T>(encrypted, passphrase)
  } catch (error) {
    throw new Error(`Could not decrypt the stored ${kind}: ${describeError(error)}`)
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
