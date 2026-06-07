import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Cover both colocated tests (src/**) and the standalone tests/ directory.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
