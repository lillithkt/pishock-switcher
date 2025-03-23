import * as esbuild from "esbuild";

esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  target: ["node21"],
  sourcemap: true,
  external: ["serialport"],
  loader: {
    ".node": "copy",
  },
});
