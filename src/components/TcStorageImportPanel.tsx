import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import './TcStorageImportPanel.css'
import { File as FileIcon, Folder, Link2, Loader } from 'lucide-preact'
import type { AccessRequestKey } from '../storage/accessGrantCrypto.js'
import { createAccessRequestKey, decryptFolderKeyGrant } from '../storage/accessGrantCrypto.js'
import { matchesFolderKeyHash } from '../storage/folderKeyProof.js'
import { loadEncryptedFileFromMist, loadEncryptedFolderFromMist } from '../storage/mistStorage.js'
import type { FileRecord, FolderBundle } from '../storage/domain.js'
import { formatBytes } from '../storage/domain.js'
import { joinRoomReceiveOnly, leaveRoom, sendToPeer } from '../p2p/p2pMist.js'
import { signShareEnvelope, verifyShareEnvelope } from '../p2p/p2pEnvelope.js'
import { isEd25519DidKey } from '../profile/didIdentity.js'
import { readShareLink, useShareLinkImport, type PendingShare } from '../share/shareLinks.js'
import type { MistModule, ShareEnvelope } from '../p2p/p2pTypes.js'

type Phase = 'idle' | 'parsed' | 'requesting' | 'denied' | 'loading-folder' | 'folder-ready' | 'error'

type RequestEntry = {
  requestId: string
  accessKey: AccessRequestKey
  folderId: string
  folderKeyHash: string
  ownerNodeId: string
  accessGrantMode: 'owner' | 'shared'
  roomId: string
}

type TcStorageImportPanelProps = {
  mistAvailable: boolean
  mist: MistModule | undefined
  nodeId: string
  did: string | undefined
  onImportFile: (file: FileRecord) => Promise<void>
}

export function TcStorageImportPanel({ mistAvailable, mist, nodeId, did, onImportFile }: TcStorageImportPanelProps): JSX.Element {
  const [linkInput, setLinkInput] = useState('')
  const [share, setShare] = useState<PendingShare | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [folderBundle, setFolderBundle] = useState<FolderBundle | undefined>(undefined)
  const [busyFileId, setBusyFileId] = useState<string | undefined>(undefined)
  const [importedFileId, setImportedFileId] = useState<string | undefined>(undefined)

  const requestRef = useRef<RequestEntry | undefined>(undefined)
  const folderKeyRef = useRef<string | undefined>(undefined)
  const joinedRoomRef = useRef<string | undefined>(undefined)

  useEffect(() => () => {
    if (mist && joinedRoomRef.current) leaveRoom(mist)
  }, [mist])

  const reset = (nextShare: PendingShare | undefined) => {
    requestRef.current = undefined
    folderKeyRef.current = undefined
    setFolderBundle(undefined)
    setImportedFileId(undefined)
    setMessage(undefined)
    setShare(nextShare)
    setPhase(nextShare ? 'parsed' : 'idle')
  }

  useShareLinkImport((linked) => {
    setLinkInput('')
    reset(linked)
  })

  const handleParse = () => {
    const parsed = parseShareInput(linkInput)
    if (!parsed) {
      setPhase('error')
      setMessage('This does not look like a valid tc-storage share link.')
      return
    }
    reset(parsed)
  }

  const handleEnvelope = (envelope: ShareEnvelope) => {
    const entry = requestRef.current
    if (!entry || envelope.requestId !== entry.requestId) return
    if (envelope.type === 'folder-access-denied') {
      setPhase('denied')
      setMessage('The folder owner denied this access request.')
      return
    }
    if (envelope.type === 'folder-access-grant') {
      void handleGrant(envelope, entry)
      return
    }
    if ((envelope.type === 'folder-share' || envelope.type === 'folder-state') && envelope.folderId === entry.folderId && envelope.cid && folderKeyRef.current) {
      void loadFolder(envelope.cid, folderKeyRef.current)
    }
  }

  const handleGrant = async (envelope: ShareEnvelope, entry: RequestEntry) => {
    try {
      const verified = await verifyShareEnvelope(envelope)
      if (!verified) {
        setPhase('error')
        setMessage('Could not verify the access grant signature.')
        return
      }
      if (entry.accessGrantMode === 'shared') {
        if (!isEd25519DidKey(envelope.from)) {
          setPhase('error')
          setMessage('The access grant sender is not a valid did:key.')
          return
        }
      } else if (envelope.from !== entry.ownerNodeId) {
        setPhase('error')
        setMessage('The access grant did not come from the folder owner.')
        return
      }
      if (!envelope.accessGrantCipherText || !envelope.accessGrantIv || !envelope.accessGrantPublicKey) {
        setPhase('error')
        setMessage('The access grant is missing required fields.')
        return
      }
      const folderKey = await decryptFolderKeyGrant({
        cipherText: envelope.accessGrantCipherText,
        iv: envelope.accessGrantIv,
        privateKey: entry.accessKey.privateKey,
        publicKey: envelope.accessGrantPublicKey,
      })
      if (!matchesFolderKeyHash(entry.folderId, folderKey, entry.folderKeyHash)) {
        setPhase('error')
        setMessage('The granted folder key does not match the share link.')
        return
      }
      folderKeyRef.current = folderKey
      const cid = envelope.cid
      if (cid) {
        await loadFolder(cid, folderKey)
      } else {
        setMessage('Access granted. Waiting for the folder manifest...')
      }
    } catch (error) {
      setPhase('error')
      setMessage(describeError(error, 'Could not process the access grant'))
    }
  }

  const loadFolder = async (cid: string, folderKey: string) => {
    setPhase('loading-folder')
    setMessage(undefined)
    try {
      const bundle = await loadEncryptedFolderFromMist(cid, folderKey, { nodeId })
      setFolderBundle(bundle)
      setPhase('folder-ready')
    } catch (error) {
      setPhase('error')
      setMessage(describeError(error, 'Could not load the shared folder'))
    }
  }

  const requestFolderAccess = async () => {
    if (!share || share.type !== 'folder-share' || !share.folderId) return
    if (!mist) {
      setPhase('error')
      setMessage('mistlib-wasm has not been built yet.')
      return
    }
    if (!did) {
      setMessage('Waiting for the local DID identity to be ready...')
      return
    }
    if (!share.ownerNodeId || !isEd25519DidKey(share.ownerNodeId)) {
      setPhase('error')
      setMessage('This share link is not signed with a valid owner DID.')
      return
    }
    if (!share.folderKeyHash) {
      setPhase('error')
      setMessage('This share link is missing folder key verification data.')
      return
    }
    setPhase('requesting')
    setMessage('Requesting access from the folder owner...')
    try {
      const accessKey = await createAccessRequestKey()
      const requestId = `access-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const accessGrantMode: 'owner' | 'shared' = share.accessGrantMode === 'shared' ? 'shared' : 'owner'
      const entry: RequestEntry = {
        requestId,
        accessKey,
        folderId: share.folderId,
        folderKeyHash: share.folderKeyHash,
        ownerNodeId: share.ownerNodeId,
        accessGrantMode,
        roomId: share.roomId,
      }
      requestRef.current = entry
      joinRoomReceiveOnly(mist, nodeId, share.roomId, handleEnvelope)
      joinedRoomRef.current = share.roomId
      const envelope: ShareEnvelope = {
        type: 'folder-access-request',
        from: did,
        roomId: share.roomId,
        sentAt: new Date().toISOString(),
        clock: 0,
        folderId: share.folderId,
        folderName: share.folderName,
        accessGrantMode,
        folderKeyHash: share.folderKeyHash,
        targetNodeId: accessGrantMode === 'shared' ? undefined : share.ownerNodeId,
        requestId,
        accessPublicKey: accessKey.publicKey,
      }
      const signed = await signShareEnvelope(envelope)
      sendToPeer(mist, share.ownerNodeId, signed)
    } catch (error) {
      setPhase('error')
      setMessage(describeError(error, 'Could not send the access request'))
    }
  }

  const importFileShare = async () => {
    if (!share || share.type !== 'file-share' || !share.cid || !share.key) return
    setBusyFileId(share.fileId ?? share.cid)
    setMessage(undefined)
    try {
      const bundle = await loadEncryptedFileFromMist(share.cid, share.key, { nodeId })
      await onImportFile(bundle.file)
      setImportedFileId(bundle.file.id)
      setMessage(`Imported "${bundle.file.name}" into the library.`)
    } catch (error) {
      setPhase('error')
      setMessage(describeError(error, 'Could not import the shared file'))
    } finally {
      setBusyFileId(undefined)
    }
  }

  const loadFolderFile = async (file: FileRecord) => {
    if (!folderKeyRef.current) return
    const cid = file.lastCid
    if (!cid) {
      setMessage(`"${file.name}" has no stored content to load.`)
      return
    }
    setBusyFileId(file.id)
    setMessage(undefined)
    try {
      const bundle = await loadEncryptedFileFromMist(cid, folderKeyRef.current, { nodeId })
      await onImportFile(bundle.file)
      setImportedFileId(bundle.file.id)
      setMessage(`Imported "${bundle.file.name}" into the library.`)
    } catch (error) {
      setMessage(describeError(error, `Could not load "${file.name}"`))
    } finally {
      setBusyFileId(undefined)
    }
  }

  if (!mistAvailable) {
    return (
      <div class="tc-import tc-import--setup card anim-in">
        <div class="tc-import__setup-head">
          <span class="tc-import__setup-icon" aria-hidden="true">
            <Link2 size={16} />
          </span>
          <span class="card__title">Share import unavailable</span>
        </div>
        <p class="tc-import__setup-text">
          mistlib-wasm has not been built yet. Set <code class="tc-import__code">MISTLIB_REPO</code> in{' '}
          <code class="tc-import__code">.env</code>, then run <code class="tc-import__code">npm run build:mistlib</code>.
        </p>
      </div>
    )
  }

  return (
    <div class="tc-import">
      <form
        class="tc-import__form"
        onSubmit={(event: JSX.TargetedEvent<HTMLFormElement>) => {
          event.preventDefault()
          handleParse()
        }}
      >
        <div class="field">
          <label class="field__label" for="tc-import-link">
            tc-storage share link
          </label>
          <input
            id="tc-import-link"
            class="input"
            type="text"
            value={linkInput}
            onInput={(event) => setLinkInput(event.currentTarget.value)}
            placeholder="Paste a tc-storage share URL or #tc-share=... fragment"
          />
        </div>
        <button type="submit" class="btn btn--primary btn--block">
          Import
        </button>
      </form>

      {phase === 'idle' && (
        <div class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">
            <Link2 size={20} />
          </span>
          <p class="empty-state__text">Paste a share link from tc-storage to load a VRM file.</p>
        </div>
      )}

      {phase === 'error' && message && (
        <p class="banner banner--error" role="alert">
          {message}
        </p>
      )}

      {share?.type === 'file-share' && (phase === 'parsed' || (phase === 'error' && importedFileId === undefined)) && (
        <div class="card tc-import__card anim-in">
          <div class="tc-import__card-head">
            <span class="tc-import__badge" aria-hidden="true">
              <FileIcon size={18} />
            </span>
            <div class="tc-import__card-headings">
              <span class="section-heading">File share</span>
              <span class="tc-import__card-title truncate" title={share.fileName ?? 'Untitled file'}>
                {share.fileName ?? 'Untitled file'}
              </span>
            </div>
          </div>
          {message && phase !== 'error' && <p class="banner banner--info">{message}</p>}
          <button
            type="button"
            class="btn btn--primary btn--block"
            disabled={Boolean(busyFileId)}
            onClick={() => void importFileShare()}
          >
            {busyFileId ? 'Importing...' : 'Import'}
          </button>
        </div>
      )}

      {share?.type === 'folder-share' && phase === 'parsed' && (
        <div class="card tc-import__card anim-in">
          <div class="tc-import__card-head">
            <span class="tc-import__badge" aria-hidden="true">
              <Folder size={18} />
            </span>
            <div class="tc-import__card-headings">
              <span class="section-heading">Folder share</span>
              <span class="tc-import__card-title truncate" title={share.folderName ?? 'Untitled folder'}>
                {share.folderName ?? 'Untitled folder'}
              </span>
            </div>
          </div>
          <button type="button" class="btn btn--primary btn--block" onClick={() => void requestFolderAccess()}>
            Request access
          </button>
        </div>
      )}

      {phase === 'requesting' && (
        <div class="card tc-import__card anim-in">
          <p class="tc-import__status">
            <span class="spin" aria-hidden="true">
              <Loader size={15} />
            </span>
            Waiting for approval...
          </p>
          <SkeletonRows />
        </div>
      )}

      {phase === 'denied' && (
        <div class="card tc-import__card anim-in">
          <p class="banner banner--error" role="alert">
            {message ?? 'Access denied.'}
          </p>
          <button type="button" class="btn btn--block" onClick={() => void requestFolderAccess()}>
            Retry
          </button>
        </div>
      )}

      {phase === 'loading-folder' && (
        <div class="card tc-import__card anim-in">
          <p class="tc-import__status">
            <span class="spin" aria-hidden="true">
              <Loader size={15} />
            </span>
            Loading folder...
          </p>
          <SkeletonRows />
        </div>
      )}

      {phase === 'folder-ready' && folderBundle && (
        <div class="card tc-import__card anim-in">
          <div class="tc-import__card-head">
            <span class="tc-import__badge" aria-hidden="true">
              <Folder size={18} />
            </span>
            <div class="tc-import__card-headings">
              <span class="section-heading">
                Shared folder <span class="section-heading__count">{folderBundle.files.length}</span>
              </span>
              <span class="tc-import__card-title truncate" title={folderBundle.folder.name}>
                {folderBundle.folder.name}
              </span>
            </div>
          </div>
          {message && <p class="banner banner--info">{message}</p>}
          <ul class="tc-import__files">
            {folderBundle.files.map((file) => (
              <li key={file.id} class={isVrmFile(file) ? 'tc-import__file' : 'tc-import__file tc-import__file--dim'}>
                <div class="tc-import__file-info">
                  <span class="tc-import__file-name truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span class="tc-import__file-meta">
                    {formatBytes(file.size)}
                    {!isVrmFile(file) && ' · not a VRM'}
                  </span>
                </div>
                <button
                  type="button"
                  class="btn btn--sm tc-import__file-action"
                  disabled={busyFileId === file.id}
                  onClick={() => void loadFolderFile(file)}
                >
                  {busyFileId === file.id ? 'Loading...' : importedFileId === file.id ? 'Imported' : 'Load'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SkeletonRows(): JSX.Element {
  return (
    <div class="tc-import__skeletons" aria-hidden="true">
      <span class="skeleton tc-import__skeleton-row" />
      <span class="skeleton tc-import__skeleton-row tc-import__skeleton-row--short" />
      <span class="skeleton tc-import__skeleton-row tc-import__skeleton-row--shorter" />
    </div>
  )
}

function isVrmFile(file: FileRecord): boolean {
  return /\.vrm$/i.test(file.name) || /vrm|gltf-binary|glb/i.test(file.mimeType)
}

function parseShareInput(value: string): PendingShare | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.includes('#')) return readShareLink(trimmed.slice(trimmed.indexOf('#')))
  if (trimmed.startsWith('tc-share=')) return readShareLink(`#${trimmed}`)
  return readShareLink(`#tc-share=${trimmed}`)
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
