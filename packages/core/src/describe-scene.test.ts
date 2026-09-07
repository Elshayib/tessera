import { DocumentSchema } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { fixtures } from "@tessera/testing";
import { expect, test } from "vitest";
import campfireJson from "../../schema/fixtures/documents/0.1.0/campfire.json";
import { createDocument } from "./create-document.js";
import { describeScene } from "./describe-scene.js";

const CAMPFIRE_OUTLINE = `scene "Campfire" · 4 entities · 3 assets · env color:#101018 exposure 1 tonemap neutral · main camera: /Camera
/
├─ Ground [e_ground0001] mesh GroundPlane(a_plane00001) plane 10×10 mat:Bark bounds 10×0×10
├─ Log [e_log0000001] mesh LogBox(a_box0000001) box 0.3×0.3×1 mat:Bark @0,0.15,0 rot 0,20,0 bounds 0.3×0.3×1
├─ Fire [e_fire000000] light point 80cd #ff8844 @0,0.4,0
└─ Camera [e_camera0001] camera persp fov50 @4,3,6 rot -20,30,0`;

test("scene.describe campfire golden outline", () => {
  const snapshot = DocumentSchema.parse(campfireJson);
  const { reader } = createDocument({ snapshot });
  const described = describeScene(reader, { detail: "outline" });
  expect(isOk(described)).toBe(true);
  if (!described.ok) {
    return;
  }
  expect(described.value.truncated).toBe(false);
  expect(described.value.entityCount).toBe(4);
  expect(described.value.text).toBe(CAMPFIRE_OUTLINE);
});

test("D1 describe stays at most 8 KB at default detail", () => {
  const { reader } = createDocument({ snapshot: fixtures.D1() });
  const described = describeScene(reader, {});
  expect(isOk(described)).toBe(true);
  if (!described.ok) {
    return;
  }
  expect(described.value.truncated).toBe(true);
  expect(new TextEncoder().encode(described.value.text).byteLength).toBeLessThanOrEqual(8192);
}, 60_000);
