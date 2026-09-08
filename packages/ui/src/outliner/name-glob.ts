/**
 * `scene.find` name glob (`04` §10): `*` and `?`, case-insensitive (Q-0062).
 *
 * @public
 */
export function globMatch(name: string, glob: string): boolean {
  let pattern = "";
  for (const char of glob) {
    if (char === "*") {
      pattern += ".*";
    } else if (char === "?") {
      pattern += ".";
    } else {
      pattern += escapeRegex(char);
    }
  }
  return new RegExp(`^${pattern}$`, "i").test(name);
}

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
