import { build } from 'vite'

/**
 * Собирает интеграционный тест сервера (scripts/integration-test.ts) в один
 * ESM-файл, чтобы запускать его обычным Node без ts-node.
 */
await build({
  configFile: false,
  root: process.cwd(),
  logLevel: 'warn',
  resolve: { preserveSymlinks: true },
  ssr: { noExternal: ['@vtt/shared'], external: ['socket.io-client'] },
  build: {
    ssr: 'scripts/integration-test.ts',
    outDir: '.tmp/test-dist',
    emptyOutDir: true,
    minify: false,
    target: 'node22',
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'integration-test.mjs' }
    }
  }
})
