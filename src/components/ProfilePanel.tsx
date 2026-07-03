import { useState } from 'preact/hooks'
import type { JSX } from 'preact'

type ProfilePanelProps = {
  storageAvailable: boolean
  name: string
  did?: string
  avatarUrl?: string
  onSave: (input: { name: string; avatarBlob?: File }) => void
}

export function ProfilePanel({ storageAvailable, name, did, avatarUrl, onSave }: ProfilePanelProps): JSX.Element {
  const [draftName, setDraftName] = useState(name)
  const [draftAvatar, setDraftAvatar] = useState<File | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  const previewUrl = draftAvatar ? URL.createObjectURL(draftAvatar) : avatarUrl

  const handleCopyDid = () => {
    if (!did) return
    navigator.clipboard?.writeText(did).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <form
      class="profile-panel"
      onSubmit={(event: JSX.TargetedEvent<HTMLFormElement>) => {
        event.preventDefault()
        onSave({ name: draftName, avatarBlob: draftAvatar })
      }}
    >
      {!storageAvailable && (
        <p class="profile-panel__note">
          mistlib storage is unavailable (not vendored, or failed to load); the profile is saved locally to this app only (localStorage).
        </p>
      )}
      <div class="profile-panel__avatar">
        {previewUrl ? <img src={previewUrl} alt="Avatar preview" class="profile-panel__avatar-image" /> : <div class="profile-panel__avatar-placeholder" />}
        <label class="profile-panel__avatar-picker">
          Choose image
          <input
            type="file"
            accept="image/*"
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => setDraftAvatar(event.currentTarget.files?.[0])}
          />
        </label>
      </div>
      <label class="profile-panel__field">
        Name
        <input type="text" value={draftName} onInput={(event) => setDraftName(event.currentTarget.value)} placeholder="Your display name" />
      </label>
      {did && (
        <div class="profile-panel__did">
          <span class="profile-panel__did-value">{truncateDid(did)}</span>
          <button type="button" onClick={handleCopyDid}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <button type="submit">Save profile</button>
    </form>
  )
}

function truncateDid(did: string): string {
  return did.length > 28 ? `${did.slice(0, 16)}...${did.slice(-8)}` : did
}
