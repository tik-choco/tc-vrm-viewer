import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, type VRMAnimation } from '@pixiv/three-vrm-animation'
import type { VRM } from '@pixiv/three-vrm'

export type { VRMAnimation }

export type VrmAnimationHandle = {
  mixer: THREE.AnimationMixer
  action: THREE.AnimationAction
}

const loader = new GLTFLoader()
loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

export async function loadVrmAnimationFromBytes(bytes: Uint8Array): Promise<VRMAnimation> {
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const gltf = await loader.parseAsync(arrayBuffer, '')
  const animations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined
  const animation = animations?.[0]
  if (!animation) throw new Error('No VRM animation found in this file')
  return animation
}

export function playVrmAnimation(vrm: VRM, animation: VRMAnimation): VrmAnimationHandle {
  const clip = createVRMAnimationClip(animation, vrm)
  const mixer = new THREE.AnimationMixer(vrm.scene)
  const action = mixer.clipAction(clip)
  action.play()
  return { mixer, action }
}
