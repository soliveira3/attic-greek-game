import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // relative asset paths: the site works under any path (GitHub Pages serves it from /<repo>/)
  base: './',
  plugins: [react()],
  // the paradigm data is one lazily loaded chunk per part of speech; verbs is the largest
  build: { chunkSizeWarningLimit: 1000 },
  // the app reads ../data (paradigms, golden models, grammar notes); ?raw imports need it allowed
  server: { fs: { allow: ['.', '../data'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // tests over the whole data set take up to ~5 s under coverage on a busy machine (vitest's default
    // limit), so CI runners with fewer cores would fail them at random
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: { 'src/lib/**/*.ts': { lines: 95, functions: 95, branches: 95, statements: 95 } },
    },
  },
})
