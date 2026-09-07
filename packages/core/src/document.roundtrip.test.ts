import { canonicalize, emptyDocument } from "@tessera/schema";
import { createLogger, createMemorySink } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createDocument, fromYDoc, toYDoc } from "./index.js";

test("Yjs mapping round-trip equals canonicalize(snapshot)", () => {
  const oak = docBuilder()
    .entity("grove")
    .entity("oak_01", { parent: "grove", mesh: "oak", material: "bark" })
    .material("bark", { baseColor: "#8b5a2b" })
    .build();
  const snapshots = [emptyDocument(), oak];
  for (const snapshot of snapshots) {
    const ydoc = toYDoc(snapshot);
    expect(canonicalize(fromYDoc(ydoc))).toBe(canonicalize(snapshot));
    const { reader } = createDocument({ snapshot });
    expect(canonicalize(reader.snapshot())).toBe(canonicalize(snapshot));
    expect(reader.snapshot().version).toBe("0.1.0");
  }
  const empty = createDocument();
  expect(empty.reader.snapshot().version).toBe("0.1.0");
  const sink = createMemorySink();
  const logged = createDocument({ logger: createLogger([sink.write]) });
  expect(logged.reader.snapshot().entities).toEqual({});
});
