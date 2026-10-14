import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { defineConfig, type Plugin } from "vite";

const r = (p: string) => path.resolve(__dirname, p);

// Application téléphone : une seule page, chemins relatifs (marche en fichier local,
// dans l'application Android et en page web).
// Version iPhone (VITE_PWA=1) : après la fabrication, le service worker reçoit la liste
// de tous les fichiers de l'application, pour l'ouvrir même sans Internet.
function serviceWorker(): Plugin {
  let out = "";
  return {
    name: "nr-service-worker",
    apply: "build",
    configResolved(c) {
      out = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      if (process.env.VITE_PWA !== "1") return;
      const files: string[] = [];
      const walk = (d: string) =>
        fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else files.push("./" + path.relative(out, p).split(path.sep).join("/"));
        });
      walk(out);
      const keep = files.filter((f) => !/voir|\.map$|sw\.js$|\.jpe?g$/.test(f) && !f.endsWith(".woff"));
      const version = (process.env.VITE_APP_VERSION || "") + "-" + Date.now().toString(36);
      const tpl = fs.readFileSync(r("pwa/sw-template.js"), "utf8");
      fs.writeFileSync(path.join(out, "sw.js"), tpl.replace("__VERSION__", version).replace("__FILES__", JSON.stringify(keep, null, 0)));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), serviceWorker()],
  resolve: {
    alias: [
      { find: "next/link", replacement: r("shims/next-link.tsx") },
      { find: "next/navigation", replacement: r("shims/next-navigation.ts") },
      { find: "next/server", replacement: r("shims/next-server.ts") },
      { find: "next/headers", replacement: r("shims/next-headers.ts") },
      { find: "server-only", replacement: r("shims/empty.ts") },
      { find: /^@\//, replacement: r(".") + "/" },
    ],
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    // Deux pages : l'application, et la page publique des QR codes (voir.html).
    rollupOptions: { input: { index: r("index.html"), voir: r("voir.html") } },
  },
});
