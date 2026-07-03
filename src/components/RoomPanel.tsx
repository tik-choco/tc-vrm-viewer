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
        <p>mistlib-wasm がまだビルドされていません。</p>
        <p>
          <code>.env</code> に <code>MISTLIB_REPO</code> を設定し、<code>npm run build:mistlib</code> を実行してください。
        </p>
      </div>
    )
  }

  if (connected) {
    return (
      <div class="room-panel">
        <p>
          ルーム <strong>{roomId}</strong> に接続中（受信専用）
        </p>
        <p class="room-panel__peers">接続ピア: {peers.length}</p>
        <button type="button" onClick={onLeave}>
          退出
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
        ルームID
        <input
          type="text"
          value={draftRoomId}
          onInput={(event) => setDraftRoomId(event.currentTarget.value)}
          placeholder="tc-storage のルームID"
        />
      </label>
      <button type="submit">参加（受信専用）</button>
    </form>
  )
}
