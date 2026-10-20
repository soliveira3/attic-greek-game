import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the app reads ../data (paradigms, golden models, grammar notes); ?raw imports need it allowed
  server: { fs: { allow: ['.', '../data'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: { 'src/lib/**/*.ts': { lines: 95, functions: 95, branches: 95, statements: 95 } },
    },
  },
})
