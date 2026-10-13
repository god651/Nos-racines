import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const r = (p: string) => path.resolve(__dirname, p);

// Application téléphone : une seule page, chemins relatifs (marche en fichier local,
// dans l'application Android et en page web).
export default defineConfig({
  base: "./",
  plugins: [react()],
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
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
