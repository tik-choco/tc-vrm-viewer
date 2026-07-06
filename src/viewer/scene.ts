import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type ViewerTheme = 'light' | 'dark'

export type ViewerScene = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  /** Recolor theme-dependent scene elements (grid, lighting) to match the UI theme. */
  applyTheme: (theme: ViewerTheme) => void
  dispose: () => void
}

const GRID_COLORS: Record<ViewerTheme, { center: number; lines: number }> = {
  light: { center: 0xb7bec9, lines: 0xd8dde4 },
  dark: { center: 0x353a44, lines: 0x22262e },
}

export function createViewerScene(container: HTMLElement): ViewerScene {
  const scene = new THREE.Scene()
  // Transparent: the theme-aware CSS gradient on the host element shows through.
  scene.background = null

  const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(0, 1.3, 3)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1, 0)
  controls.enableDamping = true
  controls.update()

  const ambient = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(ambient)

  const directional = new THREE.DirectionalLight(0xffffff, 1.2)
  directional.position.set(1, 1.5, 1)
  scene.add(directional)

  // Soft fill from below to avoid harsh shadows on avatar faces.
  const fill = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.35)
  scene.add(fill)

  let grid = new THREE.GridHelper(10, 10, GRID_COLORS.dark.center, GRID_COLORS.dark.lines)
  scene.add(grid)

  const applyTheme = (theme: ViewerTheme) => {
    const colors = GRID_COLORS[theme]
    scene.remove(grid)
    grid.geometry.dispose()
    ;(grid.material as THREE.Material).dispose()
    grid = new THREE.GridHelper(10, 10, colors.center, colors.lines)
    scene.add(grid)
  }

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  return {
    scene,
    camera,
    renderer,
    controls,
    applyTheme,
    dispose: () => {
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export function startRenderLoop(viewer: ViewerScene, onFrame: (deltaSeconds: number) => void): () => void {
  const clock = new THREE.Clock()
  let frameId = 0
  const tick = () => {
    const delta = clock.getDelta()
    viewer.controls.update()
    onFrame(delta)
    viewer.renderer.render(viewer.scene, viewer.camera)
    frameId = requestAnimationFrame(tick)
  }
  frameId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frameId)
}
