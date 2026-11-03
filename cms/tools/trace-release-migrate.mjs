import { copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'

// Use the tracer bundled with the pinned Next version, without a second NFT pin.
const require = createRequire(import.meta.url)
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft')
try {
  const root = realpathSync(process.cwd()), standalone = join(root, '.next/standalone')
  const { fileList } = await nodeFileTrace([join(root, '.next/release-migrate.mjs')], {
    base: root, processCwd: root, mixedModules: true,
    ignore: ['**/.state/**', '**/.env*', '**/.devenv/**', '**/.direnv/**'],
  })
  let added = 0
  for (const name of fileList) {
    // Application code and explicit migration modules were bundled by Bun.
    // Supplement only actual dependencies; never copy source/runtime state.
    if (!name.startsWith('node_modules/')) continue
    const from = resolve(root, name), canonical = realpathSync(from)
    if (!canonical.startsWith(join(root, 'node_modules') + sep) || relative(root, from).startsWith('..') || !lstatSync(from).isFile()) throw new Error()
    const to = join(standalone, name)
    if (!existsSync(to)) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); added++ }
  }
  console.log(`CMS migration dependency trace added ${added} files.`)
} catch {
  console.error('CMS migration dependency trace failed; raw dependency/filesystem errors suppressed.')
  process.exitCode = 1
}
