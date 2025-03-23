import * as esbuild from "esbuild";
import { exec } from "pkg";

(async () => {
  await esbuild.build({
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

  if (process.argv.includes("--exe")) {
    console.log("Packaging...");
    await exec(["package.json", "--output", "dist/PiShock-ButtplugIO.exe"]);
  }
  console.log("Done!");
})();
