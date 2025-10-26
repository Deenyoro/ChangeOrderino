#!/usr/bin/env node
/**
 * Sync LICENSE files from repository root to public/ directory
 *
 * This ensures LICENSE files are available during local development
 * and maintains consistency with CI builds.
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../../..')
const publicDir = resolve(__dirname, '../public')

const files = [
  { src: 'LICENSE', dest: 'LICENSE' },
  { src: 'THIRD-PARTY-LICENSES', dest: 'THIRD-PARTY-LICENSES' }
]

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

let hadErrors = false

for (const { src, dest } of files) {
  const srcPath = resolve(rootDir, src)
  const destPath = resolve(publicDir, dest)

  if (!existsSync(srcPath)) {
    console.warn(`⚠️  Warning: ${src} not found at ${srcPath}`)
    hadErrors = true
    continue
  }

  try {
    copyFileSync(srcPath, destPath)
    console.log(`✅ Copied ${src} → public/${dest}`)
  } catch (err) {
    console.error(`❌ Failed to copy ${src}:`, err.message)
    hadErrors = true
  }
}

if (hadErrors) {
  console.warn('\n⚠️  Some LICENSE files were not synced. This may cause runtime errors.')
  console.warn('Make sure LICENSE and THIRD-PARTY-LICENSES exist at repository root.')
  // Don't fail - just warn. CI will catch missing files with explicit checks.
} else {
  console.log('\n✅ All LICENSE files synced successfully')
}
