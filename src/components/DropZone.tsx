import { useState } from 'preact/hooks'
import type { JSX } from 'preact'

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
      <p>Drop a .vrm file or bundle JSON</p>
      <label class="drop-zone__picker">
        Choose a file
        <input type="file" accept=".vrm,.json" multiple onChange={handleInputChange} />
      </label>
    </div>
  )
}
