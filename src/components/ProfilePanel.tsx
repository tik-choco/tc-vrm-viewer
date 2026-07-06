import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import './ProfilePanel.css'
import { Check, Copy, ImagePlus, User } from 'lucide-preact'

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
      class="profile-panel anim-in"
      onSubmit={(event: JSX.TargetedEvent<HTMLFormElement>) => {
        event.preventDefault()
        onSave({ name: draftName, avatarBlob: draftAvatar })
      }}
    >
      {!storageAvailable && (
        <p class="banner banner--info">
          mistlib storage is unavailable (not vendored, or failed to load); the profile is saved locally to this app only
          (localStorage).
        </p>
      )}

      <div class="profile-panel__identity">
        <div class="profile-panel__avatar">
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar preview" class="profile-panel__avatar-image" />
          ) : (
            <div class="profile-panel__avatar-fallback" aria-hidden="true">
              <User size={26} />
            </div>
          )}
        </div>
        <div class="profile-panel__identity-main">
          <label class="btn btn--sm profile-panel__picker">
            <ImagePlus size={14} aria-hidden="true" />
            Choose image
            <input
              type="file"
              accept="image/*"
              onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => setDraftAvatar(event.currentTarget.files?.[0])}
            />
          </label>
          <span class="profile-panel__identity-hint">PNG or JPG, shown to peers.</span>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="profile-panel-name">
          Name
        </label>
        <input
          id="profile-panel-name"
          class="input"
          type="text"
          value={draftName}
          onInput={(event) => setDraftName(event.currentTarget.value)}
          placeholder="Your display name"
        />
      </div>

      {did && (
        <div class="field">
          <span class="field__label">Decentralized ID</span>
          <div class="profile-panel__did">
            <span class="mono truncate profile-panel__did-value" title={did}>
              {did}
            </span>
            <button
              type="button"
              class={copied ? 'btn btn--sm profile-panel__did-copy is-copied' : 'btn btn--sm profile-panel__did-copy'}
              aria-label={copied ? 'Copied' : 'Copy DID'}
              onClick={handleCopyDid}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <button type="submit" class="btn btn--primary btn--block">
        Save profile
      </button>
    </form>
  )
}
