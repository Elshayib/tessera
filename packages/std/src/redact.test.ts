import { expect, test } from "vitest";
import { redact } from "./redact.js";

test("redact nested secret keys", () => {
  const redacted = redact({
    id: "e_ok",
    apiKey: "abc",
    nested: {
      password: "p",
      items: [{ authorization: "Bearer x", cookie: "a=b", name: "lamp" }],
    },
    token: "t",
    secret: "s",
  });

  expect(redacted).toEqual({
    id: "e_ok",
    apiKey: "[redacted]",
    nested: {
      password: "[redacted]",
      items: [{ authorization: "[redacted]", cookie: "[redacted]", name: "lamp" }],
    },
    token: "[redacted]",
    secret: "[redacted]",
  });

  const cyclic: Record<string, unknown> = { id: "e_ok" };
  cyclic.self = cyclic;
  const cyclicRedacted = redact(cyclic);
  expect(cyclicRedacted).toMatchObject({ id: "e_ok", self: "[circular]" });

  const cyclicList: unknown[] = [];
  cyclicList.push(cyclicList);
  expect(redact(cyclicList)).toEqual(["[circular]"]);

  expect(redact("plain")).toBe("plain");
});
