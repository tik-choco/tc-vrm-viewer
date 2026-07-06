import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import './RoomPanel.css'
import { Info, Radio, Users } from 'lucide-preact'

type LastSenderProfile = {
  name: string
  avatarDataUrl?: string
}

type RoomPanelProps = {
  mistAvailable: boolean
  roomId: string
  connected: boolean
  peers: string[]
  lastSenderProfile?: LastSenderProfile
  onJoin: (roomId: string) => void
  onLeave: () => void
}

export function RoomPanel({ mistAvailable, roomId, connected, peers, lastSenderProfile, onJoin, onLeave }: RoomPanelProps): JSX.Element {
  const [draftRoomId, setDraftRoomId] = useState(roomId)

  if (!mistAvailable) {
    return (
      <div class="room-panel room-panel--setup card anim-in">
        <div class="room-panel__setup-head">
          <span class="room-panel__setup-icon" aria-hidden="true">
            <Radio size={16} />
          </span>
          <span class="card__title">Live rooms unavailable</span>
        </div>
        <p class="room-panel__setup-text">
          mistlib-wasm has not been built yet. Set <code class="room-panel__code">MISTLIB_REPO</code> in{' '}
          <code class="room-panel__code">.env</code>, then run <code class="room-panel__code">npm run build:mistlib</code>.
        </p>
      </div>
    )
  }

  if (connected) {
    const senderInitial = lastSenderProfile?.name?.trim().charAt(0).toUpperCase() || '?'
    return (
      <div class="room-panel anim-in">
        <div class="room-panel__status">
          <span class="chip room-panel__chip">
            <span class="pulse-dot" aria-hidden="true" />
            <span class="room-panel__chip-text truncate">
              Connected · <strong>{roomId}</strong>
            </span>
          </span>
          <span class="room-panel__mode">receive-only</span>
        </div>

        <div class="room-panel__peers">
          <Users size={15} aria-hidden="true" />
          <span class="room-panel__peers-label">Connected peers</span>
          <span class="room-panel__peers-count">{peers.length}</span>
        </div>

        {lastSenderProfile && (
          <div class="room-panel__sender">
            {lastSenderProfile.avatarDataUrl ? (
              <img src={lastSenderProfile.avatarDataUrl} alt="" class="room-panel__sender-avatar" />
            ) : (
              <span class="room-panel__sender-fallback" aria-hidden="true">
                {senderInitial}
              </span>
            )}
            <span class="room-panel__sender-info">
              <span class="room-panel__sender-label">Last seen sender</span>
              <strong class="room-panel__sender-name truncate">{lastSenderProfile.name}</strong>
            </span>
          </div>
        )}

        <button type="button" class="btn btn--block" onClick={onLeave}>
          Leave
        </button>
      </div>
    )
  }

  return (
    <form
      class="room-panel anim-in"
      onSubmit={(event: JSX.TargetedEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (draftRoomId.trim()) onJoin(draftRoomId.trim())
      }}
    >
      <div class="field">
        <label class="field__label" for="room-panel-id">
          Room ID
        </label>
        <input
          id="room-panel-id"
          class="input"
          type="text"
          value={draftRoomId}
          onInput={(event) => setDraftRoomId(event.currentTarget.value)}
          placeholder="tc-storage room ID"
        />
      </div>
      <button type="submit" class="btn btn--primary btn--block">
        Join (receive-only)
      </button>
      <p class="room-panel__hint">
        <Info size={14} aria-hidden="true" />
        <span>You will receive models shared into this room. Nothing on this device is sent back.</span>
      </p>
    </form>
  )
}
