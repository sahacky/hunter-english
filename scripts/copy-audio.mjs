// Copies repo-root audio/ into dist/audio so `vite build` + static hosting
// (GitHub Pages / Cloudflare) serve pre-recorded opus files.
// Dev server already serves project-root files as-is.
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const src = join(root, 'audio')
const dest = join(root, 'dist', 'audio')

if (!existsSync(src)) {
  console.error('copy-audio: audio/ not found — run from repo root')
  process.exit(1)
}
cpSync(src, dest, { recursive: true })
console.log('copy-audio: dist/audio updated')
