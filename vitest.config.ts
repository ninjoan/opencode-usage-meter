import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    allowOnly: false,
    include: ["tests/**/*.{spec,test}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"]
    }
  }
});
