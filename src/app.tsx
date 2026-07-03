import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { VRM } from '@pixiv/three-vrm'
import { DropZone } from './components/DropZone.js'
import { ModelLibrary } from './components/ModelLibrary.js'
import { ExpressionPanel } from './components/ExpressionPanel.js'
import { MetaPanel } from './components/MetaPanel.js'
import { RoomPanel } from './components/RoomPanel.js'
import { createViewerScene, startRenderLoop, type ViewerScene } from './viewer/scene.js'
import { loadVrmFromBytes, replaceVrmInScene, vrmMetaSummary, type VrmMeta } from './viewer/vrmLoader.js'
import { createAutoBlink, getExpressionWeight, listExpressionNames, setExpressionWeight } from './viewer/expressions.js'
import { parseBundleJson, bytesToDataUrl } from './storage/bundleImport.js'
import { addModelToLibrary, checksumOf, listLibraryModels, removeModelFromLibrary } from './storage/library.js'
import type { FileRecord } from './storage/domain.js'
import { createNodeId, joinRoomReceiveOnly, leaveRoom, loadMistModule } from './p2p/p2pMist.js'
import type { MistModule } from './p2p/p2pTypes.js'

type Tab = 'meta' | 'expressions' | 'p2p'

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
    const nodeId = createNodeId()
    joinRoomReceiveOnly(mist, nodeId, nextRoomId, (envelope) => {
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
  }

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
            <RoomPanel mistAvailable={mistAvailable} roomId={roomId} connected={connected} peers={peers} onJoin={handleJoinRoom} onLeave={handleLeaveRoom} />
          )}
        </div>
      </aside>
    </div>
  )
}
