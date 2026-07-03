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
      <p>.vrm ファイルまたは bundle JSON をドロップ</p>
      <label class="drop-zone__picker">
        ファイルを選択
        <input type="file" accept=".vrm,.json" multiple onChange={handleInputChange} />
      </label>
    </div>
  )
}
