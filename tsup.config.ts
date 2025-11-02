import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/utils/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  minify: true,
  clean: true,
  splitting: false,
  outDir: "dist",
});
