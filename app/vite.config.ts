import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// The built site's Content-Security-Policy: everything is served from the site itself (fonts and
// data included); nothing inline. Added at build time only, since the dev server injects inline
// scripts. GitHub Pages cannot send headers, so it goes in a <meta> tag (frame-ancestors is not
// allowed there).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    // right after the charset, before any script or stylesheet it governs
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `$&\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

// https://vite.dev/config/
export default defineConfig({
  // relative asset paths: the site works under any path (GitHub Pages serves it from /<repo>/)
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
