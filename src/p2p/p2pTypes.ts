import type { FileRecord } from '../storage/domain.js'

export type MistModule = typeof import('../vendor/mistlib-wasm/mistlib_wasm.js')

export type MistRoomController = Pick<MistModule, 'init_with_config' | 'join_room' | 'register_event_callback' | 'update_position'>

export type ShareProfile = {
  name: string
}

/**
 * Subset of tc-storage's ShareEnvelope: only the fields this receive-only
 * client needs to recognize 'hello' and 'file-share' envelopes carrying VRM
 * files. Kept wire-compatible with tc-storage's full ShareEnvelope shape.
 */
export type ShareEnvelope = {
  type: 'hello' | 'folder-share' | 'file-share' | 'folder-state' | 'folder-change' | 'file-content-repair-request' | 'folder-access-request' | 'folder-access-grant' | 'folder-access-denied'
  from: string
  roomId: string
  sentAt: string
  clock: number
  fileId?: string
  fileName?: string
  file?: FileRecord
  senderProfile?: ShareProfile
}

export type NetworkState = {
  mode: 'idle' | 'connecting' | 'mistlib' | 'offline'
  roomId?: string
  nodeId?: string
  peers: string[]
  lastEvent: string
}
