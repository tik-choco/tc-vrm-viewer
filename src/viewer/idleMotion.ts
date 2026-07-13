import type { VRM } from '@pixiv/three-vrm'

const ARM_DOWN_ANGLE = 1.4 // radians (~80deg): drops the T-pose arms to the sides

/**
 * Procedural stand-idle fallback used whenever no .vrma clip is playing, so a
 * freshly loaded VRM doesn't sit frozen in its default T-pose. Rotations are
 * set on the normalized humanoid bone nodes, which three-vrm always keeps at
 * an identity rest *rotation*. The rest *position* of those nodes, however,
 * still reflects the source model's authored world-space orientation, and
 * that orientation flips 180deg around Y between VRM0 and VRM1 (VRMUtils.
 * rotateVRM0 only rotates vrm.scene to compensate for display purposes; it
 * never touches the rig). That means a fixed-sign Z rotation drops the arms
 * on one spec version but raises them on the other. To stay correct on both,
 * the sign is derived per-side from the rest-pose direction the lower arm
 * actually extends in (its local position, i.e. offset from the upper arm).
 */
export function createIdleMotion(vrm: VRM): (deltaSeconds: number) => void {
  const humanoid = vrm.humanoid
  if (!humanoid) return () => {}

  const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm')
  const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm')
  const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm')
  const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm')
  const chest = humanoid.getNormalizedBoneNode('chest') ?? humanoid.getNormalizedBoneNode('spine')
  const spine = humanoid.getNormalizedBoneNode('spine')
  const head = humanoid.getNormalizedBoneNode('head')

  // Sign of the lower arm's rest-pose local X offset tells us which way the
  // arm extends in this model's rig axes; falls back to the legacy fixed
  // sign when the lower arm bone is missing or sits exactly on the axis.
  const leftArmSign = leftLowerArm && leftLowerArm.position.x !== 0 ? -Math.sign(leftLowerArm.position.x) : 1
  const rightArmSign = rightLowerArm && rightLowerArm.position.x !== 0 ? -Math.sign(rightLowerArm.position.x) : -1

  leftUpperArm?.rotation.set(0, 0, leftArmSign * ARM_DOWN_ANGLE)
  rightUpperArm?.rotation.set(0, 0, rightArmSign * ARM_DOWN_ANGLE)

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
