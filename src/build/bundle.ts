import { build, type InlineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "node:fs";
import path from "node:path";

const VIEWS_DIR = path.resolve(import.meta.dirname, "../../src/ui/views");
const OUT_DIR = path.resolve(import.meta.dirname, "../ui/views");

async function bundleViews() {
  if (!fs.existsSync(VIEWS_DIR)) {
    console.log("No UI views directory found, skipping bundle.");
    return;
  }

  const entries = fs
    .readdirSync(VIEWS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  if (entries.length === 0) {
    console.log("No UI views to bundle.");
    return;
  }

  for (const entry of entries) {
    const viewDir = path.join(VIEWS_DIR, entry.name);
    const indexHtml = path.join(viewDir, "index.html");

    if (!fs.existsSync(indexHtml)) {
      console.warn(`Skipping ${entry.name}: no index.html found`);
      continue;
    }

    const outDir = path.join(OUT_DIR, entry.name);

    const config: InlineConfig = {
      root: viewDir,
      plugins: [viteSingleFile()],
      build: {
        outDir,
        emptyOutDir: true,
        minify: true,
      },
      logLevel: "warn",
    };

    console.log(`Bundling view: ${entry.name}`);
    await build(config);
  }

  console.log("All views bundled.");
}

bundleViews().catch((e) => {
  console.error("Bundle failed:", e);
  process.exit(1);
});
