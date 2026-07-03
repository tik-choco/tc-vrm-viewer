import type { JSX } from 'preact'

type ExpressionPanelProps = {
  expressionNames: string[]
  weights: Record<string, number>
  onChange: (name: string, weight: number) => void
  autoBlink: boolean
  onToggleAutoBlink: (enabled: boolean) => void
}

export function ExpressionPanel({ expressionNames, weights, onChange, autoBlink, onToggleAutoBlink }: ExpressionPanelProps): JSX.Element {
  if (expressionNames.length === 0) {
    return <p class="panel-empty">Load a model to see expression sliders</p>
  }
  return (
    <div class="expression-panel">
      <label class="expression-panel__toggle">
        <input type="checkbox" checked={autoBlink} onChange={(event) => onToggleAutoBlink(event.currentTarget.checked)} />
        Auto-blink
      </label>
      {expressionNames.map((name) => (
        <label key={name} class="expression-panel__row">
          <span class="expression-panel__label">{name}</span>
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
  )
}
