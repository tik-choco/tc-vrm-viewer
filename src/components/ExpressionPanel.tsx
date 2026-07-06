import type { JSX } from 'preact'
import './ExpressionPanel.css'
import { SlidersHorizontal } from 'lucide-preact'

type ExpressionPanelProps = {
  expressionNames: string[]
  weights: Record<string, number>
  onChange: (name: string, weight: number) => void
  autoBlink: boolean
  onToggleAutoBlink: (enabled: boolean) => void
}

export function ExpressionPanel({ expressionNames, weights, onChange, autoBlink, onToggleAutoBlink }: ExpressionPanelProps): JSX.Element {
  if (expressionNames.length === 0) {
    return (
      <div class="empty-state">
        <span class="empty-state__icon" aria-hidden="true">
          <SlidersHorizontal size={22} />
        </span>
        <p class="empty-state__text">Load a model to see expression sliders</p>
      </div>
    )
  }
  return (
    <div class="expression-panel anim-in">
      <label class="expression-panel__toggle">
        <span class="expression-panel__toggle-label">Auto-blink</span>
        <span class="switch">
          <input
            type="checkbox"
            class="switch__input"
            checked={autoBlink}
            onChange={(event) => onToggleAutoBlink(event.currentTarget.checked)}
          />
          <span class="switch__track" aria-hidden="true">
            <span class="switch__thumb" />
          </span>
        </span>
      </label>
      <div class="expression-panel__list">
        {expressionNames.map((name) => (
          <label key={name} class="expression-panel__row">
            <span class="expression-panel__row-head">
              <span class="expression-panel__label truncate">{name}</span>
              <span class="expression-panel__value mono">{Math.round((weights[name] ?? 0) * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights[name] ?? 0}
              onInput={(event) => onChange(name, Number(event.currentTarget.value))}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
