import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const version = process.env.APP_BUILD_ID || process.env.GITHUB_SHA || new Date().toISOString();

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), {
    name: "app-release",
    transformIndexHtml: () => [{ tag: "meta", attrs: { name: "app-version", content: version }, injectTo: "head" }],
    generateBundle(_, bundle) {
      const assets = Object.values(bundle).filter(file => file.type === "chunk" ? file.isEntry : file.fileName.endsWith(".css")).map(file => file.fileName);
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version, assets }) });
    },
  }],
});
