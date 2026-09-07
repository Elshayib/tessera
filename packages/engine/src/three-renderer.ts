import { PerspectiveCamera, Scene, SRGBColorSpace } from "three";
import { WebGPURenderer } from "three/webgpu";
import type { CreateGpuRenderer, GpuRenderer } from "./types.js";

/**
 * Builds a three.js {@link WebGPURenderer} with an empty scene (`05` §2).
 *
 * @example
 * ```ts
 * const gpu = createThreeRenderer({ canvas, antialias: true, forceWebGL: false });
 * await gpu.init();
 * ```
 *
 * @public
 */
export const createThreeRenderer: CreateGpuRenderer = (options): GpuRenderer => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);
  const renderer = new WebGPURenderer({
    canvas: options.canvas,
    antialias: options.antialias,
    forceWebGL: options.forceWebGL,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  const backend = options.forceWebGL ? "webgl2" : "webgpu";
  return {
    backend,
    maxTextureSize: backend === "webgpu" ? 16384 : 8192,
    init: async () => {
      await renderer.init();
    },
    render: () => {
      renderer.render(scene, camera);
    },
    setSize: (width, height) => {
      renderer.setSize(width, height, false);
      camera.aspect = height === 0 ? 1 : width / height;
      camera.updateProjectionMatrix();
    },
    setPixelRatio: (ratio) => {
      renderer.setPixelRatio(ratio);
    },
    dispose: () => {
      renderer.dispose();
    },
  };
};
