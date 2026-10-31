import { context } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
const output = path.join(root, "node_modules/.cache/part-d-preview");
await mkdir(output, { recursive: true });
await copyFile(path.join(directory, "index.html"), path.join(output, "index.html"));
const build = await context({
  absWorkingDir: root,
  entryPoints: [path.join(directory, "entry.tsx")],
  outdir: output,
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  tsconfig: path.join(root, "tsconfig.json"),
  loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "warning",
});
await build.watch();
const port = Number(process.env.PART_D_PORT || 4173);
await build.serve({ host: "127.0.0.1", port, servedir: output });
console.log("Part D preview: http://127.0.0.1:" + port);
console.log("Real math and visuals; temporary canvas and caption adapters.");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => { await build.dispose(); process.exit(0); });
}
