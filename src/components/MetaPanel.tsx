import type { JSX } from 'preact'
import './MetaPanel.css'
import { Box } from 'lucide-preact'
import type { VrmMeta } from '../viewer/vrmLoader.js'

type MetaPanelProps = {
  meta?: VrmMeta
}

export function MetaPanel({ meta }: MetaPanelProps): JSX.Element {
  if (!meta) {
    return (
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">
          <Box size={22} />
        </span>
        <p class="empty-state__text">Load a model to see its metadata</p>
      </div>
    )
  }
  return (
    <dl class="meta-panel anim-in">
      <div class="meta-panel__row">
        <dt class="meta-panel__label">Name</dt>
        <dd class="meta-panel__value">{meta.name || 'Unknown'}</dd>
      </div>
      <div class="meta-panel__row">
        <dt class="meta-panel__label">Authors</dt>
        <dd class="meta-panel__value">{meta.authors.length ? meta.authors.join(', ') : 'Unknown'}</dd>
      </div>
      <div class="meta-panel__row">
        <dt class="meta-panel__label">License</dt>
        <dd class="meta-panel__value">
          {meta.licenseUrl ? (
            <a href={meta.licenseUrl} target="_blank" rel="noreferrer">
              {meta.licenseName || meta.licenseUrl}
            </a>
          ) : (
            meta.licenseName || 'Unknown'
          )}
        </dd>
      </div>
    </dl>
  )
}
