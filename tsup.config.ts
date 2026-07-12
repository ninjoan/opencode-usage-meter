import { solidPlugin } from "esbuild-plugin-solid";

export default {
  entry: {
    tui: "src/tui.tsx"
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    "@opencode-ai/plugin",
    "@opencode-ai/plugin/tui",
    "@opentui/core",
    "@opentui/solid",
    "solid-js"
  ],
  esbuildPlugins: [
    solidPlugin({
      solid: {
        generate: "universal",
        moduleName: "@opentui/solid"
      }
    })
  ]
};
