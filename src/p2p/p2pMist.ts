import { makeId } from '../storage/domain.js'
import type { MistModule, ShareEnvelope } from './p2pTypes.js'

const decoder = new TextDecoder()

let mistModulePromise: Promise<MistModule> | undefined

/**
 * Loads the vendored mistlib wasm module. Returns undefined (never throws)
 * when the module has not been vendored via scripts/build-mistlib.sh, so
 * callers can show a setup hint instead of crashing the app.
 */
export async function loadMistModule(): Promise<MistModule | undefined> {
  if (!mistModulePromise) {
    mistModulePromise = import('../vendor/mistlib-wasm/mistlib_wasm.js').then(async (module) => {
      await module.default()
      return module
    })
  }
  try {
    return await mistModulePromise
  } catch {
    mistModulePromise = undefined
    return undefined
  }
}

const nodeIdStorageKey = 'tc-vrm-viewer-node-id-v1'

/**
 * Resolves this browser's stable mistlib node id, persisted in localStorage
 * (mirrors tc-storage's tc-storage-node-id-v1 pattern). The same id must be
 * reused everywhere mistlib is initialized in this app — the wasm runtime
 * is a singleton, so re-initializing with a different id clobbers the
 * previous one (see ensureMistRuntime below).
 */
export function getOrCreateNodeId(): string {
  const storage = safeLocalStorage()
  const stored = storage?.getItem(nodeIdStorageKey)?.trim()
  if (stored) return stored
  const nodeId = makeId('node')
  try {
    storage?.setItem(nodeIdStorageKey, nodeId)
  } catch {
    /* localStorage quota exceeded or unavailable; the node id still works for this session, it just won't be stable across reloads */
  }
  return nodeId
}

let mistRuntimeInitKey = ''

/**
 * Initializes the mistlib runtime with the given node id, once. mistlib is
 * a singleton wasm runtime: calling init_with_config a second time with a
 * different id would clobber the first initialization, so every caller
 * (room join, shared storage) must funnel through this guard with the same
 * node id (mirrors tc-storage's mistStorage.ts initKey guard).
 */
export function ensureMistRuntime(mist: Pick<MistModule, 'init_with_config'>, nodeId: string): void {
  if (mistRuntimeInitKey === nodeId) return
  mist.init_with_config(nodeId, JSON.stringify({ signaling: { mode: 'nostr', nostr: { relays: [] } } }))
  mistRuntimeInitKey = nodeId
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

const sendEncoder = new TextEncoder()

/**
 * Sends a signed envelope directly to a peer's node id (used for the folder
 * access-grant handshake's folder-access-request, which must be delivered
 * to the folder owner rather than broadcast to the whole room). Never
 * throws: mirrors this app's "never crash on P2P I/O" convention.
 */
export function sendToPeer(mist: Pick<MistModule, 'send_message'>, targetNodeId: string, envelope: ShareEnvelope): void {
  try {
    mist.send_message(targetNodeId, sendEncoder.encode(JSON.stringify(envelope)), 0)
  } catch {
    // Ignore delivery failures; the caller shows a "waiting for approval" state and can retry.
  }
}

/**
 * Joins a tc-storage share room in receive-only mode: no storage writes, no
 * envelope signing/broadcast, just registering an event callback and joining.
 */
export function joinRoomReceiveOnly(mist: MistModule, nodeId: string, roomId: string, onEnvelope: (envelope: ShareEnvelope) => void): void {
  ensureMistRuntime(mist, nodeId)
  mist.register_event_callback((...events: unknown[]) => {
    for (const event of events) {
      const envelope = parseEnvelopeDeep(event)
      if (envelope) onEnvelope(envelope)
    }
  })
  mist.join_room(roomId)
}

export function leaveRoom(mist: MistModule): void {
  try {
    mist.leave_room()
  } catch {
    // Ignore teardown races while the page is closing.
  }
}

function parseEnvelopeDeep(value: unknown, depth = 0, seen = new Set<unknown>()): ShareEnvelope | undefined {
  if (value instanceof Uint8Array) return parseJsonString(decoder.decode(value))
  if (value instanceof ArrayBuffer) return parseJsonString(decoder.decode(new Uint8Array(value)))
  if (typeof value === 'string') return parseJsonString(value)
  if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return undefined
  seen.add(value)

  const direct = parseEnvelope(value)
  if (direct) return direct

  const record = value as Record<string, unknown>
  for (const key of ['data', 'payload', 'message', 'body']) {
    const nested = parseEnvelopeDeep(record[key], depth + 1, seen)
    if (nested) return nested
  }
  for (const nestedValue of Object.values(record)) {
    const nested = parseEnvelopeDeep(nestedValue, depth + 1, seen)
    if (nested) return nested
  }
  return undefined
}

function parseEnvelope(value: unknown): ShareEnvelope | undefined {
  if (!value || typeof value !== 'object') return undefined
  const envelope = value as Partial<ShareEnvelope>
  if (
    (envelope.type === 'hello' || envelope.type === 'folder-share' || envelope.type === 'file-share' || envelope.type === 'folder-state' || envelope.type === 'folder-change' || envelope.type === 'file-content-repair-request' || envelope.type === 'folder-access-request' || envelope.type === 'folder-access-grant' || envelope.type === 'folder-access-denied') &&
    typeof envelope.from === 'string' &&
    typeof envelope.roomId === 'string' &&
    typeof envelope.sentAt === 'string' &&
    typeof envelope.clock === 'number'
  ) {
    return envelope as ShareEnvelope
  }
  return undefined
}

function parseJsonString(raw: string): ShareEnvelope | undefined {
  try {
    return parseEnvelopeDeep(JSON.parse(raw))
  } catch {
    return undefined
  }
}
