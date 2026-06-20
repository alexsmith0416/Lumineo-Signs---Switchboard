import { defineConfig } from "vitest/config";

// The engine constructs local-time dates by design (it runs in the user's
// browser timezone in production). The test fixtures encode UTC wall-clock
// expectations — the same assumption the prototype's CI runs under — so pin
// the runner to UTC before any worker forks. Set here (not in a setup file)
// so V8 reads TZ before the Date subsystem initializes in each worker.
process.env.TZ = "UTC";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
