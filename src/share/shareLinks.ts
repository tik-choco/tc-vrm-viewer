/**
 * Parsing (receive-only) for tc-storage share links, ported from
 * tc-storage's src/share/shareLinks.ts. This app never mints share links
 * (makeFolderShareUrl / makeFileShareUrl are owner/sender-side only), so
 * only readShareLink and the hash-import hook are ported.
 */
import { useEffect, useRef } from 'preact/hooks'
import { base64ToBytes } from '../profile/cryptoEncoding.js'
import { isEd25519DidKey } from '../profile/didIdentity.js'
import type { ShareProfile } from '../p2p/p2pTypes.js'

type ShareKind = 'folder-share' | 'file-share'

type ShareLinkPayload = {
  v: 1
  type: ShareKind
  roomId: string
  clock?: number
  cid?: string
  key?: string
  folderId?: string
  folderName?: string
  fileId?: string
  fileName?: string
  ownerNodeId?: string
  accessGrantMode?: 'owner' | 'shared'
  folderKeyHash?: string
  senderProfile?: ShareProfile
}

/** Normalized shape of an imported share link, kept independent of tc-storage's own PendingShare/ShareEnvelope types. */
export type PendingShare = {
  type: ShareKind
  roomId: string
  clock: number
  receivedAt: string
  folderId?: string
  folderName?: string
  fileId?: string
  fileName?: string
  ownerNodeId?: string
  accessGrantMode?: 'owner' | 'shared'
  folderKeyHash?: string
  cid?: string
  key?: string
  senderProfile?: ShareProfile
}

const decoder = new TextDecoder()

/**
 * Detects a `#tc-share=...` fragment on mount and on hashchange, parses it,
 * and cleans it out of the URL afterwards (mirrors tc-storage's
 * useShareLinkImport hook).
 */
export function useShareLinkImport(onShare: (share: PendingShare) => void): void {
  const callbackRef = useRef(onShare)
  useEffect(() => {
    callbackRef.current = onShare
  }, [onShare])
  useEffect(() => {
    const read = () => {
      const share = readShareLink(location.hash)
      if (!share) return
      callbackRef.current(share)
      history.replaceState(null, document.title, `${location.pathname}${location.search}`)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
}

export function readShareLink(hash: string): PendingShare | undefined {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('tc-share')
  if (!raw) return undefined
  try {
    const payload = JSON.parse(decoder.decode(base64ToBytes(fromBase64Url(raw)))) as unknown
    if (!isShareLinkPayload(payload)) return undefined
    return {
      type: payload.type,
      roomId: payload.roomId,
      clock: payload.clock ?? 0,
      receivedAt: new Date().toISOString(),
      folderId: payload.folderId,
      folderName: payload.folderName,
      fileId: payload.fileId,
      fileName: payload.fileName,
      ownerNodeId: payload.ownerNodeId,
      accessGrantMode: payload.accessGrantMode,
      folderKeyHash: payload.folderKeyHash,
      cid: payload.cid,
      key: payload.key,
      senderProfile: payload.senderProfile,
    }
  } catch {
    return undefined
  }
}

function isShareLinkPayload(value: unknown): value is ShareLinkPayload {
  const payload = value as Partial<ShareLinkPayload>
  return Boolean(
    payload &&
      payload.v === 1 &&
      (payload.type === 'folder-share' || payload.type === 'file-share') &&
      typeof payload.roomId === 'string' &&
      (payload.clock === undefined || typeof payload.clock === 'number') &&
      (payload.accessGrantMode === undefined || payload.accessGrantMode === 'owner' || payload.accessGrantMode === 'shared') &&
      (payload.type === 'folder-share'
        ? typeof payload.ownerNodeId === 'string' && isEd25519DidKey(payload.ownerNodeId) && isFolderKeyHash(payload.folderKeyHash) && payload.cid === undefined && payload.key === undefined
        : typeof payload.cid === 'string' && payload.cid.length > 0 && typeof payload.key === 'string' && payload.key.length > 0),
  )
}

function isFolderKeyHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}
