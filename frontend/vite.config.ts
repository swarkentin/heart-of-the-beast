import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Render provides the source revision used for this static-site build.
  define: {
    __APP_COMMIT__: JSON.stringify(process.env.RENDER_GIT_COMMIT || process.env.VITE_APP_COMMIT || ""),
  },
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (path) => path.slice(4),
      },
    },
  },
});
