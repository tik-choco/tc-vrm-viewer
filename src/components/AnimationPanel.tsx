import type { JSX } from 'preact'
import './AnimationPanel.css'
import { Film, Info, Pause, Play, Square, Upload } from 'lucide-preact'

type AnimationPanelProps = {
  animationName?: string
  isPlaying: boolean
  hasModel: boolean
  onLoadFile: (file: File) => void
  onTogglePlaying: (playing: boolean) => void
  onClear: () => void
}

export function AnimationPanel({ animationName, isPlaying, hasModel, onLoadFile, onTogglePlaying, onClear }: AnimationPanelProps): JSX.Element {
  const handleInputChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onLoadFile(file)
    event.currentTarget.value = ''
  }

  return (
    <div class="animation-panel anim-in">
      <label class="btn btn--sm animation-panel__picker">
        <Upload size={14} aria-hidden="true" />
        <span>{animationName ? 'Load another animation' : 'Load a .vrma animation'}</span>
        <input type="file" class="animation-panel__input" accept=".vrma" onChange={handleInputChange} />
      </label>

      {animationName ? (
        <div class="animation-panel__now-playing">
          <span class="animation-panel__name truncate" title={animationName}>
            {animationName}
          </span>
          <div class="animation-panel__controls">
            <button
              type="button"
              class="btn btn--icon"
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              onClick={() => onTogglePlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button type="button" class="btn btn--icon" aria-label="Stop and clear animation" onClick={onClear}>
              <Square size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div class="empty-state">
          <span class="empty-state__icon" aria-hidden="true">
            <Film size={22} />
          </span>
          <p class="empty-state__text">Load a VRM Animation (.vrma) file to play it on the current model</p>
        </div>
      )}

      {animationName && !hasModel && (
        <p class="animation-panel__hint">
          <Info size={14} aria-hidden="true" />
          <span>Load a VRM model to see this animation play.</span>
        </p>
      )}
    </div>
  )
}
