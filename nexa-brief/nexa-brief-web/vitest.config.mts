import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // Los tests .mjs existentes usan node:test y se ejecutan con Node.
    include: ["**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/*.browser.spec.{ts,tsx}", "**/*.e2e.spec.{ts,tsx}"],
  },
});
