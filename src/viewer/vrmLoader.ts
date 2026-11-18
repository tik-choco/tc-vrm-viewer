import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'

export type LoadedModel =
  | { kind: 'vrm'; vrm: VRM; scene: THREE.Object3D }
  | { kind: 'gltf'; scene: THREE.Group; size: THREE.Vector3; mixer?: THREE.AnimationMixer; name?: string }

export type VrmMeta = {
  name?: string
  authors: string[]
  licenseUrl?: string
  licenseName?: string
}

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))
const GLTF_TARGET_SIZE = 1.6

export async function loadModelFromBytes(bytes: Uint8Array): Promise<LoadedModel> {
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const gltf = await loader.parseAsync(arrayBuffer, '')
  const vrm = gltf.userData.vrm as VRM | undefined
  if (!vrm) {
    // Fit the wrapper so embedded animation tracks keep their authored transforms.
    const scene = new THREE.Group()
    scene.add(gltf.scene)
    scene.traverse((object) => {
      object.frustumCulled = false
    })

    scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(gltf.scene, true)
    const size = bounds.getSize(new THREE.Vector3())
    if (!bounds.isEmpty()) {
      const horizontalSize = Math.max(size.x, size.z)
      const dimension = size.y < horizontalSize / 2 ? horizontalSize : size.y
      const scale = dimension > 0 ? GLTF_TARGET_SIZE / dimension : 1
      const center = bounds.getCenter(new THREE.Vector3())
      scene.scale.setScalar(scale)
      scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
      size.multiplyScalar(scale)
    }

    const clip = gltf.animations.at(0)
    let mixer: THREE.AnimationMixer | undefined
    if (clip) {
      mixer = new THREE.AnimationMixer(gltf.scene)
      mixer.clipAction(clip).play()
    }
    return { kind: 'gltf', scene, size, mixer, name: gltf.scene.name }
  }

  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  VRMUtils.combineMorphs(vrm)
  // VRM0.x models are authored facing +Z, the opposite of this viewer's camera;
  // rotateVRM0 flips them 180 degrees to face the camera (a no-op for VRM1.0 models).
  VRMUtils.rotateVRM0(vrm)
  vrm.scene.traverse((object) => {
    object.frustumCulled = false
  })
  return { kind: 'vrm', vrm, scene: vrm.scene }
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

export function disposeModel(model: LoadedModel): void {
  if (model.kind === 'gltf' && model.mixer) {
    model.mixer.stopAllAction()
    model.mixer.uncacheRoot(model.mixer.getRoot())
  }
  model.scene.removeFromParent()
  VRMUtils.deepDispose(model.scene)
}
