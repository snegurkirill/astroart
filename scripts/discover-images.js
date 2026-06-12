#!/usr/bin/env node
// scripts/discover-images.js
// Scans public/images/ for each item's folder and updates imageOptions
// + image in data.local.json. Run after adding new photos.

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')
const IMAGES_DIR = join(ROOT, 'public', 'images')
const LOCAL_PATH = join(ROOT, 'src', 'data.local.json')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

function scanFolder(folderName) {
  const folderPath = join(IMAGES_DIR, folderName)
  if (!existsSync(folderPath)) return []

  return readdirSync(folderPath)
    .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort()
    .map(f => `images/${folderName}/${f}`)
}

function main() {
  const local = JSON.parse(readFileSync(LOCAL_PATH, 'utf8'))

  if (!existsSync(IMAGES_DIR)) {
    console.log('⚠️   public/images/ not found — nothing to discover')
    return
  }

  const allFolders = readdirSync(IMAGES_DIR)
  let updated = 0

  for (const [id, item] of Object.entries(local)) {
    const prefix = String(id).padStart(2, '0') + '-'
    const folder = allFolders.find(f => f.startsWith(prefix))
    if (!folder) continue

    const images = scanFolder(folder)
    if (images.length === 0) continue

    const changed =
      item.image !== images[0] ||
      JSON.stringify(item.imageOptions) !== JSON.stringify(images)

    if (changed) {
      local[id].image = images[0]
      local[id].imageOptions = images
      updated++
      console.log(`  ${prefix.slice(0, -1)}  ${images.length} photo(s) → ${images[0]}`)
    }
  }

  writeFileSync(LOCAL_PATH, JSON.stringify(local, null, 2))

  if (updated > 0) {
    console.log(`\n✅  ${updated} item(s) updated in data.local.json`)
    console.log('    Run "npm run generate" to rebuild data.js')
  } else {
    console.log('✅  No image changes found')
  }
}

main()
