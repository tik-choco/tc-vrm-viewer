import type { VRM } from '@pixiv/three-vrm'

export function listExpressionNames(vrm: VRM): string[] {
  const manager = vrm.expressionManager
  if (!manager) return []
  return manager.expressions
    .map((expression) => expression.expressionName)
    .filter((name): name is string => Boolean(name))
    .sort()
}

export function setExpressionWeight(vrm: VRM, name: string, weight: number): void {
  vrm.expressionManager?.setValue(name, weight)
}

export function getExpressionWeight(vrm: VRM, name: string): number {
  return vrm.expressionManager?.getValue(name) ?? 0
}

/**
 * Simple idle auto-blink: closes and opens the 'blink' expression on a
 * randomized interval. Returns a step function to call each frame and a
 * cleanup no-op (state lives in the closure).
 */
export function createAutoBlink(vrm: VRM) {
  const hasBlink = listExpressionNames(vrm).includes('blink')
  let timer = randomBlinkInterval()
  let elapsed = 0
  let phase: 'idle' | 'closing' | 'opening' = 'idle'
  let phaseElapsed = 0
  const closeDuration = 0.08
  const openDuration = 0.12

  return function step(deltaSeconds: number): void {
    if (!hasBlink) return
    elapsed += deltaSeconds
    if (phase === 'idle') {
      if (elapsed >= timer) {
        phase = 'closing'
        phaseElapsed = 0
        elapsed = 0
      }
      return
    }
    phaseElapsed += deltaSeconds
    if (phase === 'closing') {
      const weight = Math.min(1, phaseElapsed / closeDuration)
      setExpressionWeight(vrm, 'blink', weight)
      if (weight >= 1) {
        phase = 'opening'
        phaseElapsed = 0
      }
      return
    }
    const weight = Math.max(0, 1 - phaseElapsed / openDuration)
    setExpressionWeight(vrm, 'blink', weight)
    if (weight <= 0) {
      phase = 'idle'
      timer = randomBlinkInterval()
    }
  }
}

function randomBlinkInterval(): number {
  return 2 + Math.random() * 3
}
