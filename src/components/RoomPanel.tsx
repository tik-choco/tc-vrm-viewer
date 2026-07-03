import { useState } from 'preact/hooks'
import type { JSX } from 'preact'

type RoomPanelProps = {
  mistAvailable: boolean
  roomId: string
  connected: boolean
  peers: string[]
  onJoin: (roomId: string) => void
  onLeave: () => void
}

export function RoomPanel({ mistAvailable, roomId, connected, peers, onJoin, onLeave }: RoomPanelProps): JSX.Element {
  const [draftRoomId, setDraftRoomId] = useState(roomId)

  if (!mistAvailable) {
    return (
      <div class="room-panel room-panel--setup">
        <p>mistlib-wasm has not been built yet.</p>
        <p>
          Set <code>MISTLIB_REPO</code> in <code>.env</code>, then run <code>npm run build:mistlib</code>.
        </p>
      </div>
    )
  }

  if (connected) {
    return (
      <div class="room-panel">
        <p>
          Connected to room <strong>{roomId}</strong> (receive-only)
        </p>
        <p class="room-panel__peers">Connected peers: {peers.length}</p>
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </div>
    )
  }

  return (
    <form
      class="room-panel"
      onSubmit={(event: JSX.TargetedEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (draftRoomId.trim()) onJoin(draftRoomId.trim())
      }}
    >
      <label>
        Room ID
        <input
          type="text"
          value={draftRoomId}
          onInput={(event) => setDraftRoomId(event.currentTarget.value)}
          placeholder="tc-storage room ID"
        />
      </label>
      <button type="submit">Join (receive-only)</button>
    </form>
  )
}
