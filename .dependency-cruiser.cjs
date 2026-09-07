/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: "\\.(test|bench|int)\\.ts$|vitest\\.config\\.ts$|vite\\.config\\.ts$",
      },
      to: {},
    },
    {
      name: "apps-not-imported",
      comment: "INV-ARCH: apps/* are never imported by packages.",
      severity: "error",
      from: { path: "^packages" },
      to: { path: "^apps" },
    },
    {
      name: "evals-bridges-not-imported",
      severity: "error",
      from: { path: "^packages" },
      to: { path: "^(evals|bridges)" },
    },
    {
      name: "three-isolation",
      comment: "three.js only in engine; math-only review exception in spatial.",
      severity: "error",
      from: { pathNot: "^packages/(engine|spatial)/" },
      to: { path: "node_modules/three" },
    },
    {
      name: "INV-ARCH-06-cli-headless",
      comment: "apps/cli must not load three (INV-ARCH-06).",
      severity: "error",
      from: { path: "^apps/cli/" },
      to: { path: "node_modules/three" },
    },
    {
      name: "ai-sdk-isolation",
      severity: "error",
      from: { pathNot: "^packages/providers-llm/" },
      to: { path: "node_modules/(ai|@ai-sdk|@openrouter)" },
    },
    {
      name: "mcp-sdk-isolation",
      severity: "error",
      from: { pathNot: "^(packages/mcp/|apps/mcp-server/)" },
      to: { path: "node_modules/@modelcontextprotocol" },
    },
    {
      name: "yjs-isolation",
      severity: "error",
      from: { pathNot: "^packages/(core|collab|storage)/" },
      to: { path: "node_modules/yjs" },
    },
    {
      name: "y-indexeddb-isolation",
      comment: "y-indexeddb is allowed only in @tessera/storage (T-0102).",
      severity: "error",
      from: { pathNot: "^packages/storage/" },
      to: { path: "node_modules/y-indexeddb" },
    },
    {
      name: "react-isolation",
      severity: "error",
      from: { pathNot: "^(packages/ui/|apps/web/|apps/desktop/|apps/docs/)" },
      to: { path: "node_modules/react" },
    },
    {
      name: "gltf-transform-isolation",
      severity: "error",
      from: { pathNot: "^packages/(assets|exporters)/" },
      to: { path: "node_modules/@gltf-transform" },
    },
    {
      name: "testing-not-in-prod",
      severity: "error",
      from: {
        path: "^packages/.+/src/",
        pathNot: ["\\.(test|bench|int|browser\\.test)\\.ts$", "^packages/testing/"],
      },
      to: { path: "^packages/testing/" },
    },
    {
      name: "no-node-builtins-in-browser-packages",
      severity: "error",
      from: {
        path: "^packages/(std|schema|core|spatial|llm|generation|engine|agent|ui|plugin-api)/",
      },
      to: { dependencyTypes: ["core"], path: "^node:" },
    },
    {
      name: "INV-ARCH-02-engine-no-command-bus",
      comment: "Engine never imports CommandBus (INV-ARCH-02 / INV-RND-03).",
      severity: "error",
      from: { path: "^packages/engine/" },
      to: { path: "packages/core/.+/command-bus" },
    },
    {
      name: "no-deep-imports",
      severity: "error",
      from: {},
      to: { path: "@tessera/[^/]+/src/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|\\.turbo|node_modules)(/|$)" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
