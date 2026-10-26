import { fileURLToPath } from "node:url";
import { mergeConfig, defineConfig } from "vite";
import base from "../../vite.config";
export default mergeConfig(base, defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [{ name: "isolated-e2e-database", enforce: "pre", resolveId(source, importer) {
    if (source === "./supabase" && importer?.replaceAll("\\", "/").includes("/app/")) return fileURLToPath(new URL("./supabase-mock.ts", import.meta.url));
  } }],
}));
