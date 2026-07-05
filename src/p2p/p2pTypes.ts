import type { FileRecord, FolderRecord } from '../storage/domain.js'

export type MistModule = typeof import('../vendor/mistlib-wasm/mistlib_wasm.js')

export type MistRoomController = Pick<MistModule, 'init_with_config' | 'join_room' | 'register_event_callback' | 'update_position'>

/** Backward compatible with tc-storage's { name }: did/avatarDataUrl are optional additions. */
export type ShareProfile = {
  name: string
  did?: string
  avatarDataUrl?: string
}

/**
 * Matches tc-storage's src/p2p/p2pTypes.ts ShareEnvelope shape exactly (wire
 * format compatibility for the folder access-grant handshake), plus the
 * 'hello'/'file-share' fields this app already used.
 */
export type ShareEnvelope = {
  type: 'hello' | 'folder-share' | 'file-share' | 'folder-state' | 'folder-change' | 'file-content-repair-request' | 'folder-access-request' | 'folder-access-grant' | 'folder-access-denied'
  from: string
  roomId: string
  sentAt: string
  clock: number
  changeType?: 'file-upserted' | 'file-deleted' | 'folder-upserted' | 'folder-deleted'
  folderSignature?: string
  folderId?: string
  folderName?: string
  folder?: FolderRecord
  fileId?: string
  fileName?: string
  file?: FileRecord
  cid?: string
  senderProfile?: ShareProfile
  signature?: string
  ownerNodeId?: string
  accessGrantMode?: 'owner' | 'shared'
  folderKeyHash?: string
  targetNodeId?: string
  requestId?: string
  accessPublicKey?: string
  accessGrantProof?: string
  accessGrantPublicKey?: string
  accessGrantIv?: string
  accessGrantCipherText?: string
}

export type NetworkState = {
  mode: 'idle' | 'connecting' | 'mistlib' | 'offline'
  roomId?: string
  nodeId?: string
  peers: string[]
  lastEvent: string
}
