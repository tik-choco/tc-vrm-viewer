import type { JSX } from 'preact'
import type { FileRecord } from '../storage/domain.js'
import { formatBytes } from '../storage/domain.js'

type ModelLibraryProps = {
  models: FileRecord[]
  selectedId?: string
  onSelect: (model: FileRecord) => void
  onRemove: (model: FileRecord) => void
}

export function ModelLibrary({ models, selectedId, onSelect, onRemove }: ModelLibraryProps): JSX.Element {
  if (models.length === 0) {
    return <p class="model-library__empty">No models yet</p>
  }
  return (
    <ul class="model-library">
      {models.map((model) => (
        <li key={model.id} class={`model-library__item ${model.id === selectedId ? 'model-library__item--selected' : ''}`}>
          <button type="button" class="model-library__button" onClick={() => onSelect(model)}>
            <span class="model-library__name">{model.name}</span>
            <span class="model-library__size">{formatBytes(model.size)}</span>
          </button>
          <button type="button" class="model-library__remove" aria-label="Remove" onClick={() => onRemove(model)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
