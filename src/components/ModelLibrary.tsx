import type { JSX } from 'preact'
import './ModelLibrary.css'
import { Boxes, X } from 'lucide-preact'
import type { FileRecord } from '../storage/domain.js'
import { formatBytes } from '../storage/domain.js'

type ModelLibraryProps = {
  models: FileRecord[]
  selectedId?: string
  onSelect: (model: FileRecord) => void
  onRemove: (model: FileRecord) => void
}

export function ModelLibrary({ models, selectedId, onSelect, onRemove }: ModelLibraryProps): JSX.Element {
  return (
    <section class="model-library">
      <h3 class="section-heading">
        Library
        <span class="section-heading__count">{models.length}</span>
      </h3>
      {models.length === 0 ? (
        <div class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">
            <Boxes size={22} />
          </span>
          <p class="empty-state__text">No saved models yet. Drop a VRM file to add one.</p>
        </div>
      ) : (
        <ul class="model-library__list">
          {models.map((model) => (
            <li
              key={model.id}
              class={`model-library__item anim-in ${model.id === selectedId ? 'model-library__item--selected' : ''}`}
            >
              <button
                type="button"
                class="model-library__select"
                aria-pressed={model.id === selectedId}
                onClick={() => onSelect(model)}
              >
                <span class="model-library__name truncate">{model.name}</span>
                <span class="model-library__size mono">{formatBytes(model.size)}</span>
              </button>
              <button
                type="button"
                class="model-library__remove btn btn--icon"
                aria-label={`Remove ${model.name}`}
                onClick={() => onRemove(model)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
