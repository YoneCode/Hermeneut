import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Tunnel:  ssh -L 4000:localhost:5173 user@host  →  http://localhost:4000
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, process: true, global: true },
      protocolImports: true,
    }),
  ],
  define: { "process.env": {} },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    hmr: { host: "localhost", clientPort: 4000, protocol: "ws" },
  },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true },
});
