import { build } from 'rolldown'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
await build({
  input: resolve(root, 'scripts/server/game-story-handler.mjs'),
  platform: 'node',
  external: ['node:crypto'],
  output: { file: resolve(root, 'api/_lib/game-story-handler.mjs'), format: 'esm', codeSplitting: false },
})
console.log('Built self-contained Discord story handler')
