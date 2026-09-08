import { isErr, isOk, ok, tesseraError } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";
import { describeScene } from "../describe-scene.js";
import { createJobQueue } from "../job-queue.js";
import { createUndoService } from "../undo-service.js";
import { createQueryHost } from "./host.js";

const author = { kind: "user" as const, id: "tester" };

test("query error paths, unused assets, history filter, and describe branches", () => {
  const snapshot = docBuilder()
    .entity("oak", {
      mesh: "box",
      material: "bark",
      transform: { scale: [1, 2, 1], rotation: [15, 0, 0], position: [1, 0, 0] },
    })
    .entity("pine", { transform: { scale: [2, 2, 2] } })
    .entity("kid", { parent: "pine" })
    .entity("cyl_e", { mesh: "cyl" })
    .entity("cone_e", { mesh: "cone" })
    .entity("plane_e", { mesh: "plane" })
    .entity("torus_e", { mesh: "torus" })
    .entity("cap_e", { mesh: "cap" })
    .material("bark")
    .geometry("spare", { type: "sphere", radius: 1 })
    .geometry("cyl", {
      type: "cylinder",
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      segments: 16,
    })
    .geometry("cone", { type: "cone", radius: 0.5, height: 1, segments: 16 })
    .geometry("plane", { type: "plane", size: [2, 2] })
    .geometry("torus", {
      type: "torus",
      radius: 1,
      tube: 0.2,
      radialSegments: 8,
      tubularSegments: 16,
    })
    .geometry("cap", { type: "capsule", radius: 0.3, height: 1, segments: 8 })
    .build();
  const { doc, reader } = createDocument({ snapshot });
  const undo = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: undo.capture });
  expect(undo.capture.stackSize("missing")).toBe(0);
  undo.capture.trimStack("missing", 0);
  const oak = [...reader.entities()].find((entity) => entity.name === "oak");
  expect(oak !== undefined).toBe(true);
  if (oak === undefined) {
    return;
  }
  expect(isOk(bus.execute("entity.rename", { target: oak.id, name: "oak_01" }, { author }))).toBe(
    true,
  );
  const queries = createQueryHost(doc, { history: () => undo.committed() });
  expect(isErr(queries.query("entity.get", { target: "e_zzzzzzzzzz" }))).toBe(true);
  expect(isErr(queries.query("entity.children", { target: "e_zzzzzzzzzz" }))).toBe(true);
  expect(isOk(queries.query("entity.get", { target: oak.id }))).toBe(true);
  expect(isOk(queries.query("entity.children", { target: oak.id }))).toBe(true);
  expect(isErr(queries.query("asset.get", { id: "a_zzzzzzzzzz" }))).toBe(true);
  expect(isOk(queries.query("asset.list", { unused: true }))).toBe(true);
  expect(isOk(queries.query("asset.list", { unused: false }))).toBe(true);
  expect(isOk(queries.query("asset.list", { unused: false, kind: "material" }))).toBe(true);
  expect(isErr(queries.query("scene.measure", { a: "e_zzzzzzzzzz", mode: "bounds" }))).toBe(true);
  expect(isOk(queries.query("scene.find", { name: "oak_0?" }))).toBe(true);
  expect(isOk(queries.query("scene.find", { name: "oak_01.txt" }))).toBe(true);
  expect(isOk(queries.query("scene.find", { component: "transform" }))).toBe(true);
  expect(isErr(queries.query("scene.find", { within: "e_zzzzzzzzzz" }))).toBe(true);
  expect(isErr(queries.query("scene.measure", { a: oak.id, mode: "distance" }))).toBe(true);
  expect(isErr(queries.query("scene.describe", { root: "e_zzzzzzzzzz" }))).toBe(true);
  expect(isErr(queries.query("no.such", {}))).toBe(true);
  expect(isErr(queries.query("scene.find", { limit: -1 }))).toBe(true);
  const byRun = queries.query("history.list", { runId: "r_zzzzzzzzzz", limit: 1 });
  expect(isOk(byRun)).toBe(true);
  const outlined = describeScene(reader, { detail: "outline" });
  expect(isOk(outlined)).toBe(true);
  const summarized = describeScene(reader, { detail: "summary", root: oak.id });
  expect(isOk(summarized)).toBe(true);
  const full = describeScene(reader, { detail: "full", includeAssets: true });
  expect(isOk(full)).toBe(true);
  const tiny = describeScene(reader, { maxChars: 8 });
  expect(isOk(tiny) && tiny.value.truncated).toBe(true);
  const encoder = new TextEncoder();
  const treeOnly = describeScene(reader, { includeAssets: false });
  expect(isOk(treeOnly)).toBe(true);
  if (treeOnly.ok) {
    const treeBytes = encoder.encode(treeOnly.value.text).byteLength;
    const cutAssets = describeScene(reader, { includeAssets: true, maxChars: treeBytes + 7 });
    expect(isOk(cutAssets) && cutAssets.value.truncated).toBe(true);
    const lines = treeOnly.value.text.split("\n");
    const prefix = lines.slice(0, Math.min(4, lines.length)).join("\n");
    const siblingCut = describeScene(reader, { maxChars: encoder.encode(prefix).byteLength + 8 });
    expect(isOk(siblingCut)).toBe(true);
  }
  expect(undo.undo.history({ kind: "author", authorId: author.id }, 1).length).toBe(1);
  expect(undo.undo.history({ kind: "author", authorId: author.id }).length).toBeGreaterThan(0);
  expect(undo.undo.canUndo({ kind: "author", authorId: author.id })).toBe(true);
  const pine = [...reader.entities()].find((entity) => entity.name === "pine");
  expect(pine !== undefined).toBe(true);
  if (pine === undefined) {
    return;
  }
  expect(isOk(queries.query("scene.measure", { a: oak.id, b: pine.id, mode: "bounds" }))).toBe(
    true,
  );
  expect(isErr(queries.query("scene.measure", { a: oak.id, b: "e_zzzzzzzzzz", mode: "gap" }))).toBe(
    true,
  );
  expect(
    isOk(
      bus.execute(
        "component.add",
        { target: pine.id, type: "camera", value: { type: "orthographic", fov: 50 } },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "component.add",
        {
          target: oak.id,
          type: "light",
          value: { type: "directional", intensity: 3, castShadow: true },
        },
        { author },
      ),
    ),
  ).toBe(true);
  const cyl = [...reader.entities()].find((entity) => entity.name === "cyl_e");
  expect(cyl !== undefined).toBe(true);
  if (cyl !== undefined) {
    expect(
      isOk(
        bus.execute(
          "component.add",
          {
            target: cyl.id,
            type: "light",
            value: { type: "area", intensity: 5, castShadow: false },
          },
          { author },
        ),
      ),
    ).toBe(true);
  }
  expect(isOk(bus.execute("tags.add", { target: oak.id, tags: ["wood"] }, { author }))).toBe(true);
  expect(isOk(queries.query("scene.find", { tag: "wood" }))).toBe(true);
  const importedAt = reader.snapshot().meta.createdAt;
  const envCreated = bus.execute(
    "asset.create",
    {
      asset: {
        kind: "environment",
        name: "hdr",
        license: "unknown",
        provenance: { source: "derived", importedAt },
        source: { kind: "color", color: "#112233" },
      },
    },
    { author },
  );
  expect(isOk(envCreated)).toBe(true);
  const env = [...reader.assets("environment")][0];
  expect(env !== undefined).toBe(true);
  if (env !== undefined) {
    expect(
      isOk(
        bus.execute(
          "environment.set",
          { patch: { sky: { kind: "environment", asset: env.id } } },
          { author },
        ),
      ),
    ).toBe(true);
  }
  expect(isOk(describeScene(reader, { detail: "outline", includeAssets: true }))).toBe(true);
  const runId = "r_cccccccccc";
  expect(
    isOk(bus.execute("entity.rename", { target: oak.id, name: "oak_run" }, { author, runId })),
  ).toBe(true);
  expect(isOk(queries.query("history.list", { runId }))).toBe(true);
  expect(isOk(queries.query("history.list", {}))).toBe(true);
  expect(undo.undo.history({ kind: "run", runId }).length).toBeGreaterThan(0);
  for (let index = 0; index < 8; index += 1) {
    bus.execute("entity.create", { name: `leaf_${String(index)}` }, { author });
  }
  const crowdedTree = describeScene(reader);
  expect(isOk(crowdedTree)).toBe(true);
  if (crowdedTree.ok) {
    const lines = crowdedTree.value.text.split("\n");
    const prefix = lines.slice(0, Math.min(5, lines.length)).join("\n");
    const crowded = describeScene(reader, {
      maxChars: encoder.encode(prefix).byteLength + 12,
      includeAssets: true,
    });
    expect(isOk(crowded) && crowded.value.truncated).toBe(true);
  }
});

test("describe empty document and includeAssets with no assets", () => {
  const { reader } = createDocument();
  const described = describeScene(reader, { includeAssets: true, detail: "summary" });
  expect(isOk(described)).toBe(true);
});

test("job failure, throw, progress, and cancel no-ops", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: doc.logger });
  const failed = jobs.enqueue({
    kind: "bake",
    label: "fail",
    author,
    async run() {
      return { ok: false, error: tesseraError("CONFLICT", "nope") };
    },
  });
  const failedResult = await failed.result();
  expect(isErr(failedResult) && failedResult.error.code === "CONFLICT").toBe(true);
  const thrown = jobs.enqueue({
    kind: "bake",
    label: "throw",
    author,
    async run() {
      throw new Error("boom");
    },
  });
  const thrownResult = await thrown.result();
  expect(isErr(thrownResult) && thrownResult.error.code === "INVARIANT_VIOLATION").toBe(true);
  const commitFail = jobs.enqueue({
    kind: "bake",
    label: "commit",
    author,
    async run() {
      return ok(1);
    },
    commit() {
      return { ok: false, error: tesseraError("CONFLICT", "commit") };
    },
  });
  const commitResult = await commitFail.result();
  expect(isErr(commitResult) && commitResult.error.code === "CONFLICT").toBe(true);
  const progressed = jobs.enqueue({
    kind: "export",
    label: "progress",
    author,
    async run({ progress }) {
      progress(0.5, "half");
      return ok(undefined);
    },
  });
  await progressed.result();
  expect(jobs.get(progressed.id)?.progress).toBe(1);
  jobs.cancel("j_zzzzzzzzzz");
  jobs.cancel(progressed.id);
  expect(jobs.get("missing")).toBeUndefined();
  expect(jobs.list().length).toBeGreaterThan(0);
  expect(jobs.list({ kind: "nope" })).toEqual([]);
  expect(jobs.list({ state: "queued" })).toEqual([]);
  const failedWithMessage = jobs.enqueue({
    kind: "bake",
    label: "msg-fail",
    author,
    async run({ progress }) {
      progress(0.2, "working");
      return { ok: false, error: tesseraError("CONFLICT", "nope") };
    },
  });
  await failedWithMessage.result();
  const status = jobs.get(failedWithMessage.id);
  expect(status?.message).toBe("working");
  expect(status?.error !== undefined).toBe(true);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = jobs.enqueue({
    kind: "export",
    label: "running-cancel",
    author,
    async run({ signal }) {
      await gate;
      if (signal.aborted) {
        throw new Error("aborted");
      }
      return ok(undefined);
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(jobs.get(running.id)?.state).toBe("running");
  jobs.cancel(running.id);
  release?.();
  const runningCancelled = await running.result();
  expect(isErr(runningCancelled) && runningCancelled.error.code === "CANCELLED").toBe(true);
  const queued = jobs.enqueue({
    kind: "generate",
    label: "later",
    author,
    async run() {
      return ok(undefined);
    },
  });
  jobs.cancel(queued.id);
  const cancelled = await queued.result();
  expect(isErr(cancelled) && cancelled.error.code === "CANCELLED").toBe(true);
});
