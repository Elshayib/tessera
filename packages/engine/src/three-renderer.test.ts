import { expect, test, vi } from "vitest";
import { createEngine } from "./host.js";
import { createThreeRenderer } from "./three-renderer.js";

const mocks = vi.hoisted(() => ({
  forceWebGL: false,
  init: vi.fn(async () => undefined),
  render: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  dispose: vi.fn(),
  lookAt: vi.fn(),
  updateProjectionMatrix: vi.fn(),
  positionSet: vi.fn(),
}));

vi.mock("three", () => ({
  SRGBColorSpace: "srgb",
  Scene: class Scene {},
  PerspectiveCamera: class PerspectiveCamera {
    aspect = 1;
    position = { set: mocks.positionSet };
    lookAt = mocks.lookAt;
    updateProjectionMatrix = mocks.updateProjectionMatrix;
  },
}));

vi.mock("three/webgpu", () => ({
  WebGPURenderer: class WebGPURenderer {
    outputColorSpace = "";
    constructor(options: { readonly forceWebGL?: boolean }) {
      mocks.forceWebGL = options.forceWebGL === true;
    }
    init = mocks.init;
    render = mocks.render;
    setSize = mocks.setSize;
    setPixelRatio = mocks.setPixelRatio;
    dispose = mocks.dispose;
  },
}));

test("createThreeRenderer inits WebGPURenderer and maps size", async () => {
  const canvas = document.createElement("canvas");
  const gpu = createThreeRenderer({ canvas, antialias: true, forceWebGL: false });
  expect(gpu.backend).toBe("webgpu");
  expect(gpu.maxTextureSize).toBe(16384);
  await gpu.init();
  expect(mocks.init).toHaveBeenCalledTimes(1);
  gpu.setSize(16, 9);
  expect(mocks.setSize).toHaveBeenCalledWith(16, 9, false);
  expect(mocks.updateProjectionMatrix).toHaveBeenCalled();
  gpu.setSize(8, 0);
  gpu.setPixelRatio(2);
  gpu.render();
  gpu.dispose();
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
});

test("createEngine default factory uses three renderer", async () => {
  const canvas = document.createElement("canvas");
  const created = await createEngine({
    canvas,
    requestFrame: () => 1,
    cancelFrame: () => {
      return;
    },
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    return;
  }
  created.value.dispose();
  expect(mocks.dispose).toHaveBeenCalled();
});
