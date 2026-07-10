import type { VRM } from '@pixiv/three-vrm'

const ARM_DOWN_ANGLE = 1.4 // radians (~80deg): drops the T-pose arms to the sides

/**
 * Procedural stand-idle fallback used whenever no .vrma clip is playing, so a
 * freshly loaded VRM doesn't sit frozen in its default T-pose. Rotations are
 * set on the normalized humanoid bone nodes, which three-vrm always keeps in
 * a world-space-aligned rest orientation regardless of the source model's own
 * bone axes, so the same angles produce a consistent arms-down stance on any
 * VRM avatar.
 */
export function createIdleMotion(vrm: VRM): (deltaSeconds: number) => void {
  const humanoid = vrm.humanoid
  if (!humanoid) return () => {}

  const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm')
  const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm')
  const chest = humanoid.getNormalizedBoneNode('chest') ?? humanoid.getNormalizedBoneNode('spine')
  const spine = humanoid.getNormalizedBoneNode('spine')
  const head = humanoid.getNormalizedBoneNode('head')

  leftUpperArm?.rotation.set(0, 0, ARM_DOWN_ANGLE)
  rightUpperArm?.rotation.set(0, 0, -ARM_DOWN_ANGLE)

  let elapsed = 0
  return function step(deltaSeconds: number): void {
    elapsed += deltaSeconds
    if (chest) chest.rotation.x = Math.sin(elapsed * 1.4) * 0.02
    if (spine) spine.rotation.z = Math.sin(elapsed * 0.55) * 0.015
    if (head) {
      head.rotation.y = Math.sin(elapsed * 0.3) * 0.05
      head.rotation.x = Math.sin(elapsed * 0.45 + 1.5) * 0.025
    }
  }
}
