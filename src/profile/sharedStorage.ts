/**
 * Content-addressed shared storage backend, built on mistlib's
 * storage_add / storage_get (OPFS-backed internally by mistlib, and thus
 * shared across every tc-* app deployed under the same origin).
 *
 * Kept behind a small interface so profile/identity persistence can be unit
 * tested with a mock backend, without needing the vendored wasm module.
 *
 * mistlib's wasm runtime is a singleton: it must be initialized with the
 * SAME node id everywhere in the app (room joins included), or a later
 * init_with_config call clobbers the earlier one. Runtime init is therefore
 * centralized in ensureMistRuntime (src/p2p/p2pMist.ts) and this module
 * always initializes with the caller-supplied real node id, never a
 * synthetic one of its own.
 *
 * Part of src/profile/, designed to be copied verbatim into other tc-* apps.
 */
import { ensureMistRuntime, loadMistModule } from '../p2p/p2pMist.js'
import type { MistModule } from '../p2p/p2pTypes.js'

export type SharedStorageBackend = {
  store(bytes: Uint8Array): Promise<string>
  retrieve(cid: string): Promise<Uint8Array | undefined>
}

type MistStorageModule = Pick<MistModule, 'storage_add' | 'storage_get' | 'init_with_config'>

export function createMistStorageBackend(mist: MistStorageModule, nodeId: string): SharedStorageBackend {
  return {
    store: async (bytes) => {
      ensureMistRuntime(mist, nodeId)
      return mist.storage_add('tc-shared', bytes)
    },
    retrieve: async (cid) => {
      ensureMistRuntime(mist, nodeId)
      try {
        return await mist.storage_get(cid)
      } catch {
        return undefined
      }
    },
  }
}

/**
 * Loads the vendored mistlib module (if available) and wraps it as a
 * SharedStorageBackend initialized with `nodeId` — the same stable node id
 * used for room joins (see getOrCreateNodeId in p2pMist.ts). Returns
 * undefined when mistlib isn't vendored.
 */
export async function getSharedStorageBackend(nodeId: string): Promise<SharedStorageBackend | undefined> {
  const mist = await loadMistModule()
  return mist ? createMistStorageBackend(mist, nodeId) : undefined
}
