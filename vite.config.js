import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const usePolling = process.env.VITE_WATCH_USE_POLLING === "true";

/**
 * Configures the Vite dev server for the React client.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
  plugins: [react()],
  server: {
    watch: usePolling
      ? {
        usePolling: true,
        interval: 300,
      }
      : undefined,
  },
});
