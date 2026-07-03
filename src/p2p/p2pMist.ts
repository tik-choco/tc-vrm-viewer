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

export function createNodeId(): string {
  return makeId('node')
}

/**
 * Joins a tc-storage share room in receive-only mode: no storage writes, no
 * envelope signing/broadcast, just registering an event callback and joining.
 */
export function joinRoomReceiveOnly(mist: MistModule, nodeId: string, roomId: string, onEnvelope: (envelope: ShareEnvelope) => void): void {
  mist.init_with_config(nodeId, JSON.stringify({ signaling: { mode: 'nostr', nostr: { relays: [] } } }))
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
