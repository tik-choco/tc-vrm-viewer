import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { Box, Film, FolderDown, Info, Moon, MousePointerClick, Smile, Sun, User, Wifi } from 'lucide-preact'
import type { VRM } from '@pixiv/three-vrm'
import { DropZone } from './components/DropZone.js'
import { ModelLibrary } from './components/ModelLibrary.js'
import { ExpressionPanel } from './components/ExpressionPanel.js'
import { AnimationPanel } from './components/AnimationPanel.js'
import { MetaPanel } from './components/MetaPanel.js'
import { RoomPanel } from './components/RoomPanel.js'
import { ProfilePanel } from './components/ProfilePanel.js'
import { TcStorageImportPanel } from './components/TcStorageImportPanel.js'
import { createViewerScene, startRenderLoop, type ViewerScene } from './viewer/scene.js'
import { loadVrmFromBytes, replaceVrmInScene, vrmMetaSummary, type VrmMeta } from './viewer/vrmLoader.js'
import { createAutoBlink, getExpressionWeight, listExpressionNames, setExpressionWeight } from './viewer/expressions.js'
import { loadVrmAnimationFromBytes, playVrmAnimation, type VRMAnimation, type VrmAnimationHandle } from './viewer/vrmAnimation.js'
import { createIdleMotion } from './viewer/idleMotion.js'
import { parseBundleJson, bytesFromDataUrl, bytesToDataUrl } from './storage/bundleImport.js'
import { addModelToLibrary, checksumOf, listLibraryModels, removeModelFromLibrary } from './storage/library.js'
import type { FileRecord } from './storage/domain.js'
import { getOrCreateNodeId, joinRoomReceiveOnly, leaveRoom, loadMistModule } from './p2p/p2pMist.js'
import type { MistModule, ShareProfile } from './p2p/p2pTypes.js'
import { ensureSharedDidIdentity } from './profile/didIdentity.js'
import { getSharedStorageBackend, type SharedStorageBackend } from './profile/sharedStorage.js'
import { getEffectiveProfile, loadSharedProfile, saveSharedProfile, type SharedProfile } from './profile/sharedProfile.js'

type Tab = 'meta' | 'expressions' | 'animation' | 'p2p' | 'profile' | 'import'

const TABS: { id: Tab; label: string; icon: typeof Info }[] = [
  { id: 'meta', label: 'Meta', icon: Info },
  { id: 'expressions', label: 'Face', icon: Smile },
  { id: 'animation', label: 'Anim', icon: Film },
  { id: 'p2p', label: 'P2P', icon: Wifi },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'import', label: 'Storage', icon: FolderDown },
]

const LAST_MODEL_STORAGE_KEY = 'tcvrm-last-model-id'

function getLastModelId(): string | null {
  try {
    return localStorage.getItem(LAST_MODEL_STORAGE_KEY)
  } catch {
    return null
  }
}

function setLastModelId(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(LAST_MODEL_STORAGE_KEY, id)
    else localStorage.removeItem(LAST_MODEL_STORAGE_KEY)
  } catch {
    /* storage may be unavailable (private mode); the app still works, just without restoring on next launch */
  }
}

export function App(): JSX.Element {
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<ViewerScene | null>(null)
  const currentVrmRef = useRef<VRM | undefined>(undefined)
  const autoBlinkStepRef = useRef<((delta: number) => void) | null>(null)
  const mistRef = useRef<MistModule | undefined>(undefined)
  const animationHandleRef = useRef<VrmAnimationHandle | null>(null)
  const currentAnimationRef = useRef<VRMAnimation | undefined>(undefined)
  const idleMotionStepRef = useRef<((delta: number) => void) | null>(null)

  const [models, setModels] = useState<FileRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<VrmMeta | undefined>(undefined)
  const [expressionNames, setExpressionNames] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [autoBlink, setAutoBlink] = useState(true)
  const [animationName, setAnimationName] = useState<string | undefined>(undefined)
  const [animationPlaying, setAnimationPlaying] = useState(false)
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

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    viewerRef.current?.applyTheme(theme)
    try {
      localStorage.setItem('tcvrm-theme', theme)
    } catch {
      /* storage may be unavailable (private mode); the in-memory theme still applies */
    }
  }, [theme])

  useEffect(() => {
    if (!canvasHostRef.current) return
    const viewer = createViewerScene(canvasHostRef.current)
    viewerRef.current = viewer
    viewer.applyTheme(theme)
    const stop = startRenderLoop(viewer, (delta) => {
      animationHandleRef.current?.mixer.update(delta)
      idleMotionStepRef.current?.(delta)
      currentVrmRef.current?.update(delta)
      autoBlinkStepRef.current?.(delta)
    })
    return () => {
      stop()
      viewer.dispose()
    }
  }, [])

  useEffect(() => {
    listLibraryModels()
      .then((loaded) => {
        setModels(loaded)
        if (loaded.length === 0) return
        const lastId = getLastModelId()
        const restoreTarget = loaded.find((model) => model.id === lastId) ?? loaded[0]
        handleSelectModel(restoreTarget)
      })
      .catch(() => setError('Failed to load the library'))
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

  const applyAnimationToVrm = (vrm: VRM) => {
    animationHandleRef.current?.mixer.stopAllAction()
    animationHandleRef.current = null
    if (!currentAnimationRef.current) {
      idleMotionStepRef.current = createIdleMotion(vrm)
      return
    }
    idleMotionStepRef.current = null
    const handle = playVrmAnimation(vrm, currentAnimationRef.current)
    animationHandleRef.current = handle
    setAnimationPlaying(true)
  }

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
      applyAnimationToVrm(vrm)
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
          setLastModelId(record.id)
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
    setLastModelId(model.id)
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
    setLastModelId(record.id)
    await showVrmBytes(bytes)
  }

  const handleRemoveModel = async (model: FileRecord) => {
    await removeModelFromLibrary(model.id)
    setModels((prev) => prev.filter((item) => item.id !== model.id))
    if (selectedId === model.id) {
      setSelectedId(undefined)
      setLastModelId(undefined)
    }
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

  const handleLoadAnimationFile = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const animation = await loadVrmAnimationFromBytes(bytes)
      currentAnimationRef.current = animation
      setAnimationName(file.name)
      if (currentVrmRef.current) applyAnimationToVrm(currentVrmRef.current)
      setError(undefined)
    } catch {
      setError(`Failed to load animation ${file.name}`)
    }
  }

  const handleToggleAnimationPlaying = (playing: boolean) => {
    const action = animationHandleRef.current?.action
    if (!action) return
    action.paused = !playing
    setAnimationPlaying(playing)
  }

  const handleClearAnimation = () => {
    animationHandleRef.current?.mixer.stopAllAction()
    animationHandleRef.current = null
    currentAnimationRef.current = undefined
    setAnimationName(undefined)
    setAnimationPlaying(false)
    idleMotionStepRef.current = currentVrmRef.current ? createIdleMotion(currentVrmRef.current) : null
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
      <header class="app-bar">
        <div class="app-bar__brand">
          <span class="app-bar__logo" aria-hidden="true">
            <Box size={18} />
          </span>
          <div>
            <div class="app-bar__title">TC Avatar</div>
            <div class="app-bar__subtitle">Private, in-browser VRM avatar viewer</div>
          </div>
        </div>
        <div class="app-bar__spacer" />
        <div class="app-bar__actions">
          <button
            type="button"
            class="icon-button"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            class="icon-button"
            href="https://github.com/tik-choco/tc-vrm-viewer"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.06-.02-2.08-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z" />
            </svg>
          </a>
        </div>
      </header>
      <div class="app-body">
        <aside class="sidebar">
          <DropZone onFiles={handleFiles} />
          {error && (
            <p class="banner banner--error" role="alert">
              {error}
            </p>
          )}
          <ModelLibrary models={models} selectedId={selectedId} onSelect={handleSelectModel} onRemove={handleRemoveModel} />
        </aside>
        <main class="viewer-host" ref={canvasHostRef}>
          {!meta && (
            <div class="viewer-hint">
              <MousePointerClick size={15} />
              <span>Drop a .vrm file or pick one from your library to begin</span>
            </div>
          )}
        </main>
      <aside class="side-panel">
        <nav class="side-panel__tabs" role="tablist" aria-label="Panels">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div class="side-panel__content anim-in" key={tab}>
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
          {tab === 'animation' && (
            <AnimationPanel
              animationName={animationName}
              isPlaying={animationPlaying}
              hasModel={Boolean(meta)}
              onLoadFile={handleLoadAnimationFile}
              onTogglePlaying={handleToggleAnimationPlaying}
              onClear={handleClearAnimation}
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
    </div>
  )
}
