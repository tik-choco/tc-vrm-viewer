import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { VRM } from '@pixiv/three-vrm'
import { DropZone } from './components/DropZone.js'
import { ModelLibrary } from './components/ModelLibrary.js'
import { ExpressionPanel } from './components/ExpressionPanel.js'
import { MetaPanel } from './components/MetaPanel.js'
import { RoomPanel } from './components/RoomPanel.js'
import { ProfilePanel } from './components/ProfilePanel.js'
import { TcStorageImportPanel } from './components/TcStorageImportPanel.js'
import { createViewerScene, startRenderLoop, type ViewerScene } from './viewer/scene.js'
import { loadVrmFromBytes, replaceVrmInScene, vrmMetaSummary, type VrmMeta } from './viewer/vrmLoader.js'
import { createAutoBlink, getExpressionWeight, listExpressionNames, setExpressionWeight } from './viewer/expressions.js'
import { parseBundleJson, bytesFromDataUrl, bytesToDataUrl } from './storage/bundleImport.js'
import { addModelToLibrary, checksumOf, listLibraryModels, removeModelFromLibrary } from './storage/library.js'
import type { FileRecord } from './storage/domain.js'
import { getOrCreateNodeId, joinRoomReceiveOnly, leaveRoom, loadMistModule } from './p2p/p2pMist.js'
import type { MistModule, ShareProfile } from './p2p/p2pTypes.js'
import { ensureSharedDidIdentity } from './profile/didIdentity.js'
import { getSharedStorageBackend, type SharedStorageBackend } from './profile/sharedStorage.js'
import { getEffectiveProfile, loadSharedProfile, saveSharedProfile, type SharedProfile } from './profile/sharedProfile.js'

type Tab = 'meta' | 'expressions' | 'p2p' | 'profile' | 'import'

export function App(): JSX.Element {
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<ViewerScene | null>(null)
  const currentVrmRef = useRef<VRM | undefined>(undefined)
  const autoBlinkStepRef = useRef<((delta: number) => void) | null>(null)
  const mistRef = useRef<MistModule | undefined>(undefined)

  const [models, setModels] = useState<FileRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<VrmMeta | undefined>(undefined)
  const [expressionNames, setExpressionNames] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [autoBlink, setAutoBlink] = useState(true)
  const [tab, setTab] = useState<Tab>('meta')
  const [error, setError] = useState<string | undefined>(undefined)

  const [mistAvailable, setMistAvailable] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [connected, setConnected] = useState(false)
  const [peers] = useState<string[]>([])
  const [lastSenderProfile, setLastSenderProfile] = useState<ShareProfile | undefined>(undefined)

  const [did, setDid] = useState<string | undefined>(undefined)
  const [sharedProfile, setSharedProfile] = useState<SharedProfile | undefined>(undefined)
  const [sharedBackend, setSharedBackend] = useState<SharedStorageBackend | undefined>(undefined)
  /** Stable node id, resolved once and reused for both mistlib storage init and room joins (mistlib's runtime is a singleton). */
  const [nodeId] = useState(() => getOrCreateNodeId())

  useEffect(() => {
    if (!canvasHostRef.current) return
    const viewer = createViewerScene(canvasHostRef.current)
    viewerRef.current = viewer
    const stop = startRenderLoop(viewer, (delta) => {
      currentVrmRef.current?.update(delta)
      autoBlinkStepRef.current?.(delta)
    })
    return () => {
      stop()
      viewer.dispose()
    }
  }, [])

  useEffect(() => {
    listLibraryModels().then(setModels).catch(() => setError('Failed to load the library'))
  }, [])

  useEffect(() => {
    loadMistModule().then((mist) => {
      mistRef.current = mist
      setMistAvailable(Boolean(mist))
    })
  }, [])

  useEffect(() => {
    getSharedStorageBackend(nodeId).then((backend) => {
      setSharedBackend(backend)
      ensureSharedDidIdentity({ backend })
        .then((identity) => setDid(identity.did))
        .catch(() => setError('Failed to load the shared identity'))
      loadSharedProfile(backend)
        .then(setSharedProfile)
        .catch(() => setError('Failed to load the shared profile'))
    })
  }, [])

  const showVrmBytes = async (bytes: Uint8Array) => {
    try {
      const vrm = await loadVrmFromBytes(bytes)
      if (!viewerRef.current) return
      replaceVrmInScene(viewerRef.current.scene, currentVrmRef.current, vrm)
      currentVrmRef.current = vrm
      setMeta(vrmMetaSummary(vrm))
      const names = listExpressionNames(vrm)
      setExpressionNames(names)
      setWeights(Object.fromEntries(names.map((name) => [name, getExpressionWeight(vrm, name)])))
      autoBlinkStepRef.current = autoBlink ? createAutoBlink(vrm) : null
      setError(undefined)
    } catch {
      setError('Failed to load the VRM file')
    }
  }

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const text = await file.text()
          const vrmFiles = parseBundleJson(text)
          for (const vrmFile of vrmFiles) {
            const dataUrl = bytesToDataUrl(vrmFile.bytes, vrmFile.mimeType)
            const checksum = await checksumOf(vrmFile.bytes)
            const record = await addModelToLibrary({ name: vrmFile.name, mimeType: vrmFile.mimeType, size: vrmFile.size, dataUrl, checksum })
            setModels((prev) => [record, ...prev])
          }
        } else {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const dataUrl = bytesToDataUrl(bytes, 'model/gltf-binary')
          const checksum = await checksumOf(bytes)
          const record = await addModelToLibrary({ name: file.name, mimeType: 'model/gltf-binary', size: bytes.byteLength, dataUrl, checksum })
          setModels((prev) => [record, ...prev])
          setSelectedId(record.id)
          await showVrmBytes(bytes)
        }
      } catch {
        setError(`Failed to import ${file.name}`)
      }
    }
  }

  const handleSelectModel = async (model: FileRecord) => {
    if (!model.dataUrl) return
    setSelectedId(model.id)
    const commaIndex = model.dataUrl.indexOf(',')
    const binary = atob(model.dataUrl.slice(commaIndex + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    await showVrmBytes(bytes)
  }

  const handleImportTcStorageFile = async (file: FileRecord) => {
    if (!file.dataUrl) throw new Error(`${file.name} has no content to import`)
    const bytes = bytesFromDataUrl(file.dataUrl)
    const checksum = file.checksum || (await checksumOf(bytes))
    const record = await addModelToLibrary({ name: file.name, mimeType: file.mimeType || 'model/gltf-binary', size: file.size, dataUrl: file.dataUrl, checksum })
    setModels((prev) => [record, ...prev])
    setSelectedId(record.id)
    await showVrmBytes(bytes)
  }

  const handleRemoveModel = async (model: FileRecord) => {
    await removeModelFromLibrary(model.id)
    setModels((prev) => prev.filter((item) => item.id !== model.id))
    if (selectedId === model.id) setSelectedId(undefined)
  }

  const handleExpressionChange = (name: string, weight: number) => {
    if (!currentVrmRef.current) return
    setExpressionWeight(currentVrmRef.current, name, weight)
    setWeights((prev) => ({ ...prev, [name]: weight }))
  }

  const handleToggleAutoBlink = (enabled: boolean) => {
    setAutoBlink(enabled)
    autoBlinkStepRef.current = enabled && currentVrmRef.current ? createAutoBlink(currentVrmRef.current) : null
  }

  const handleJoinRoom = (nextRoomId: string) => {
    const mist = mistRef.current
    if (!mist) return
    joinRoomReceiveOnly(mist, nodeId, nextRoomId, (envelope) => {
      if (envelope.senderProfile) setLastSenderProfile(envelope.senderProfile)
      const file = envelope.type === 'file-share' ? envelope.file : undefined
      if (!file?.dataUrl) return
      addModelToLibrary({ name: file.name, mimeType: file.mimeType, size: file.size, dataUrl: file.dataUrl, checksum: file.checksum })
        .then((record) => setModels((prev) => [record, ...prev]))
        .catch(() => setError('Failed to save the received VRM file'))
    })
    setRoomId(nextRoomId)
    setConnected(true)
  }

  const handleLeaveRoom = () => {
    const mist = mistRef.current
    if (mist) leaveRoom(mist)
    setConnected(false)
    setLastSenderProfile(undefined)
  }

  const handleSaveProfile = async (input: { name: string; avatarBlob?: File }) => {
    try {
      const profile = await saveSharedProfile({ name: input.name, did: did ?? '', avatarBlob: input.avatarBlob }, sharedBackend)
      setSharedProfile(profile)
      setError(undefined)
    } catch {
      setError('Failed to save the profile')
    }
  }

  const effectiveProfile = getEffectiveProfile(sharedProfile, { name: 'Local user' })
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!effectiveProfile.avatar) {
      setAvatarUrl(undefined)
      return
    }
    const url = URL.createObjectURL(effectiveProfile.avatar)
    setAvatarUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [effectiveProfile.avatar])

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <h1 class="sidebar__title">TC VRM Viewer</h1>
        <DropZone onFiles={handleFiles} />
        {error && <p class="error-banner">{error}</p>}
        <ModelLibrary models={models} selectedId={selectedId} onSelect={handleSelectModel} onRemove={handleRemoveModel} />
      </aside>
      <main class="viewer-host" ref={canvasHostRef} />
      <aside class="side-panel">
        <nav class="side-panel__tabs">
          <button type="button" class={tab === 'meta' ? 'active' : ''} onClick={() => setTab('meta')}>
            Meta
          </button>
          <button type="button" class={tab === 'expressions' ? 'active' : ''} onClick={() => setTab('expressions')}>
            Expressions
          </button>
          <button type="button" class={tab === 'p2p' ? 'active' : ''} onClick={() => setTab('p2p')}>
            P2P
          </button>
          <button type="button" class={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
            Profile
          </button>
          <button type="button" class={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>
            tc-storage
          </button>
        </nav>
        <div class="side-panel__content">
          {tab === 'meta' && <MetaPanel meta={meta} />}
          {tab === 'expressions' && (
            <ExpressionPanel
              expressionNames={expressionNames}
              weights={weights}
              onChange={handleExpressionChange}
              autoBlink={autoBlink}
              onToggleAutoBlink={handleToggleAutoBlink}
            />
          )}
          {tab === 'p2p' && (
            <RoomPanel
              mistAvailable={mistAvailable}
              roomId={roomId}
              connected={connected}
              peers={peers}
              lastSenderProfile={lastSenderProfile}
              onJoin={handleJoinRoom}
              onLeave={handleLeaveRoom}
            />
          )}
          {tab === 'profile' && (
            <ProfilePanel storageAvailable={Boolean(sharedBackend)} name={effectiveProfile.name} did={did} avatarUrl={avatarUrl} onSave={handleSaveProfile} />
          )}
          {tab === 'import' && (
            <TcStorageImportPanel
              mistAvailable={mistAvailable}
              mist={mistRef.current}
              nodeId={nodeId}
              did={did}
              onImportFile={handleImportTcStorageFile}
            />
          )}
        </div>
      </aside>
    </div>
  )
}
