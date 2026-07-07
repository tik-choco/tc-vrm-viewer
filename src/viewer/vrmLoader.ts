import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'

export type VrmMeta = {
  name?: string
  authors: string[]
  licenseUrl?: string
  licenseName?: string
}

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))

export async function loadVrmFromBytes(bytes: Uint8Array): Promise<VRM> {
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const gltf = await loader.parseAsync(arrayBuffer, '')
  const vrm = gltf.userData.vrm as VRM
  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  VRMUtils.combineMorphs(vrm)
  // VRM0.x models are authored facing +Z, the opposite of this viewer's camera;
  // rotateVRM0 flips them 180 degrees to face the camera (a no-op for VRM1.0 models).
  VRMUtils.rotateVRM0(vrm)
  vrm.scene.traverse((object) => {
    object.frustumCulled = false
  })
  return vrm
}

export function vrmMetaSummary(vrm: VRM): VrmMeta {
  const meta = vrm.meta as unknown as {
    name?: string
    title?: string
    authors?: string[]
    author?: string
    licenseUrl?: string
    licenseName?: string
    licenseUrl0?: string
  } | undefined
  return {
    name: meta?.name ?? meta?.title,
    authors: meta?.authors ?? (meta?.author ? [meta.author] : []),
    licenseUrl: meta?.licenseUrl ?? meta?.licenseUrl0,
    licenseName: meta?.licenseName,
  }
}

export function replaceVrmInScene(scene: THREE.Scene, current: VRM | undefined, next: VRM): void {
  if (current) scene.remove(current.scene)
  scene.add(next.scene)
}
