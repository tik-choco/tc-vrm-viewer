import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import './DropZone.css'
import { Upload } from 'lucide-preact'

type DropZoneProps = {
  onFiles: (files: File[]) => void
}

export function DropZone({ onFiles }: DropZoneProps): JSX.Element {
  const [isOver, setIsOver] = useState(false)

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsOver(false)
    const files = [...(event.dataTransfer?.files ?? [])]
    if (files.length) onFiles(files)
  }

  const handleInputChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])]
    if (files.length) onFiles(files)
    event.currentTarget.value = ''
  }

  return (
    <div
      class={`drop-zone ${isOver ? 'drop-zone--active' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <span class="drop-zone__icon" aria-hidden="true">
        <Upload size={20} />
      </span>
      <p class="drop-zone__title">Drop a VRM model here</p>
      <p class="drop-zone__hint">.vrm file or bundle JSON</p>
      <label class="drop-zone__picker btn btn--sm">
        Choose a file
        <input
          type="file"
          class="drop-zone__input"
          accept=".vrm,.json"
          multiple
          onChange={handleInputChange}
        />
      </label>
    </div>
  )
}
