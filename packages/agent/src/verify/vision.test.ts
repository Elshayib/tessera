import { expect, test } from "vitest";
import { parseVerdict } from "./vision.js";

test("Verdict parse structured and fenced json", () => {
  const structured = parseVerdict({
    pass: false,
    score: 3,
    issues: [{ entity: "e_0000000000", problem: "float", suggestion: "snap" }],
  });
  expect(structured.ok).toBe(true);
  if (!structured.ok) {
    return;
  }
  expect(structured.value.score).toBe(3);
  const fenced = parseVerdict('notes\n```json\n{"pass":true,"score":5,"issues":[]}\n```');
  expect(fenced.ok).toBe(true);
  if (!fenced.ok) {
    return;
  }
  expect(fenced.value.pass).toBe(true);
});
