#!/usr/bin/env node
// scripts/download-images.js
// Downloads up to 3 images per item into public/images/XX-slug/
// Compresses with sharp if > 2000px wide or > 2MB

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'


const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')
const IMAGES_DIR = join(ROOT, 'public', 'images')
const LOCAL_PATH = join(ROOT, 'src', 'data.local.json')

const MAX_PX = 2000
const MAX_BYTES = 2 * 1024 * 1024 // 2MB

// Additional URLs found through research (supplements existing imageOptions)
// Uses Wikimedia thumbnail CDN (thumb/) for large files that exceed rate limits on full-res
const EXTRA_URLS = {
  3:  ['https://upload.wikimedia.org/wikipedia/commons/4/43/Astronomical_Ceiling%2C_Tomb_of_Senenmut_MET_DT207429.jpg',
       'https://images.metmuseum.org/CRDImages/eg/original/DT207429.jpg',
       'https://collectionapi.metmuseum.org/api/collection/v1/iiif/551786/1204855/main-image'],
  4:  ['https://upload.wikimedia.org/wikipedia/commons/4/41/MulApin-BritishMuseum.jpg'],
  7:  ['https://upload.wikimedia.org/wikipedia/commons/7/7d/Dunhuang_Star_Atlas_-_complete.jpg'],
  8:  ['https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Abd_al-Rahman_al-Sufi_Orion.jpg/1280px-Abd_al-Rahman_al-Sufi_Orion.jpg'],
  9:  ['https://upload.wikimedia.org/wikipedia/commons/f/f9/Giotto_-_Scrovegni_-_-18-_-_Adoration_of_the_Magi.jpg'],
  10: ['https://upload.wikimedia.org/wikipedia/commons/b/b3/The_Celestial_Map-_Northern_Hemisphere_MET_DP102235.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/5/59/Albrecht_D%C3%BCrer_-_The_Southern_Hemisphere_of_the_Celestial_Globe_-_WGA7196.jpg'],
  11: ['https://upload.wikimedia.org/wikipedia/commons/8/88/Hans_Holbein_the_Younger_-_The_Ambassadors_-_Google_Art_Project.jpg'],
  12: ['https://upload.wikimedia.org/wikipedia/commons/4/41/Houghton_IC6.G1333.610sa_-_Sidereus_nuncius.jpg'],
  14: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Wright_of_Derby%2C_The_Orrery.jpg/1280px-Wright_of_Derby%2C_The_Orrery.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Wright_of_Derby%2C_The_Orrery.jpg/640px-Wright_of_Derby%2C_The_Orrery.jpg'],
  15: ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/William_Turner_-_Fishermen_at_Sea.jpg/1280px-William_Turner_-_Fishermen_at_Sea.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/William_Turner_-_Fishermen_at_Sea.jpg/640px-William_Turner_-_Fishermen_at_Sea.jpg'],
  16: ['https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/View_from_the_Window_at_Le_Gras%2C_Joseph_Nic%C3%A9phore_Ni%C3%A9pce.jpg/1280px-View_from_the_Window_at_Le_Gras%2C_Joseph_Nic%C3%A9phore_Ni%C3%A9pce.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/View_from_the_Window_at_Le_Gras%2C_by_Joseph_Nicephore_Niepce%2C_1826_or_1827%2C_France_-_Harry_Ransom_Center_-_University_of_Texas_at_Austin_-_DSC08424.jpg/1280px-View_from_the_Window_at_Le_Gras%2C_by_Joseph_Nicephore_Niepce%2C_1826_or_1827%2C_France_-_Harry_Ransom_Center_-_University_of_Texas_at_Austin_-_DSC08424.jpg'],
  17: ['https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/John_W_Draper-The_first_Moon_Photograph_1840.jpg/1280px-John_W_Draper-The_first_Moon_Photograph_1840.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/View_of_the_Moon_by_John_Adams_Whipple_1852.jpg/1280px-View_of_the_Moon_by_John_Adams_Whipple_1852.jpg'],
  18: ['https://upload.wikimedia.org/wikipedia/commons/3/38/1851_07_28_Berkowski.jpg'],
  19: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg'],
  20: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Moonrise%2C_Hernandez%2C_New_Mexico.jpg/1280px-Moonrise%2C_Hernandez%2C_New_Mexico.jpg',
       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Moonrise%2C_Hernandez%2C_New_Mexico.jpg/640px-Moonrise%2C_Hernandez%2C_New_Mexico.jpg'],
  22: ['https://upload.wikimedia.org/wikipedia/commons/b/bc/IKB_191.jpg'],
  25: ['https://live.staticflickr.com/1176/1065929015_20f5c3475a.jpg'],
  37: ['https://images.adsttc.com/media/images/679a/016e/d353/e901/884b/fae5/newsletter/james-turrell-unveils-monumental-commission-for-wadi-alfann-in-alula_4.jpg?1738146216',
       'https://images.adsttc.com/media/images/679a/015a/d353/e901/884b/fade/newsletter/james-turrell-unveils-monumental-commission-for-wadi-alfann-in-alula_2.jpg?1738146277',
       'https://images.adsttc.com/media/images/679a/0164/d353/e901/884b/fae1/newsletter/james-turrell-unveils-monumental-commission-for-wadi-alfann-in-alula_3.jpg?1738146186'],
}

function findFolder(id) {
  const prefix = String(id).padStart(2, '0') + '-'
  const all = readdirSync(IMAGES_DIR)
  return all.find(f => f.startsWith(prefix))
}

function alreadyDownloaded(folderPath) {
  if (!existsSync(folderPath)) return []
  return readdirSync(folderPath).filter(f => !f.startsWith('.') && /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
}

function urlToFilename(url, index) {
  const raw = url.split('?')[0].split('/').pop() || `image-${index}`
  const ext = extname(raw) || '.jpg'
  const base = raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  // Ensure it has a valid extension
  return base.endsWith(ext) ? base : base + ext
}

async function downloadAndSave(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; astroart-gallery/1.0)' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

async function processImage(buf, destPath) {
  let img = sharp(buf, { limitInputPixels: false })
  const meta = await img.metadata()
  const width = meta.width || 0
  const sizeBytes = buf.length

  const needsResize = width > MAX_PX
  const needsCompress = sizeBytes > MAX_BYTES

  if (needsResize || needsCompress) {
    const targetWidth = needsResize ? MAX_PX : undefined
    const ext = extname(destPath).toLowerCase()
    if (ext === '.png') {
      buf = await img.resize(targetWidth).png({ compressionLevel: 9 }).toBuffer()
    } else {
      buf = await img.resize(targetWidth).jpeg({ quality: 82, progressive: true }).toBuffer()
      // Update extension to .jpg if it was something else
      destPath = destPath.replace(/\.[^.]+$/, '.jpg')
    }
    const saved = sizeBytes - buf.length
    console.log(`    ✂️  compressed ${Math.round(sizeBytes/1024)}KB → ${Math.round(buf.length/1024)}KB${needsResize ? ` (${width}px → ${MAX_PX}px)` : ''}`)
  }

  writeFileSync(destPath, buf)
  return destPath
}

async function main() {
  const local = JSON.parse(readFileSync(LOCAL_PATH, 'utf8'))
  const items = Object.values(local).sort((a, b) => a.id - b.id)

  let totalDownloaded = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const item of items) {
    // Skip item 29 (Paperno) — already has 3 local photos
    if (item.id === 29) { console.log(`  ${String(item.id).padStart(2)}  ${item.title?.slice(0,30)} — skipping (has local photos)`); continue }

    const folder = findFolder(item.id)
    if (!folder) { console.log(`  ${String(item.id).padStart(2)}  ⚠️  no folder found`); continue }
    const folderPath = join(IMAGES_DIR, folder)

    const existing = alreadyDownloaded(folderPath)
    if (existing.length >= 3) {
      console.log(`  ${String(item.id).padStart(2)}  ${item.title?.slice(0,30)} — already has ${existing.length} files`)
      totalSkipped++
      continue
    }

    // Collect URLs: existing imageOptions + extras, deduplicated
    const allUrls = [...new Set([
      ...(item.imageOptions || []).filter(u => u.startsWith('http')),
      ...(EXTRA_URLS[item.id] || []),
    ])].slice(0, 3)

    if (allUrls.length === 0) {
      console.log(`  ${String(item.id).padStart(2)}  ${item.title?.slice(0,30)} — no URLs, skipping`)
      continue
    }

    console.log(`\n  ${String(item.id).padStart(2)}  ${item.title?.slice(0,35)}`)

    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i]
      const filename = String(i + 1).padStart(2, '0') + '-' + urlToFilename(url, i + 1)
      const destPath = join(folderPath, filename)

      if (existsSync(destPath)) { console.log(`    [${i+1}] already exists — skip`); continue }

      process.stdout.write(`    [${i+1}] downloading...`)
      try {
        const buf = await downloadAndSave(url, destPath)
        const finalPath = await processImage(buf, destPath)
        console.log(` ✓  ${basename(finalPath)} (${Math.round(buf.length/1024)}KB)`)
        totalDownloaded++
      } catch (err) {
        console.log(` ✗  ${err.message.slice(0, 80)}`)
        totalFailed++
      }

      // Polite delay — Wikimedia aggressively rate-limits rapid requests
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  console.log(`\n✅  Done: ${totalDownloaded} downloaded, ${totalSkipped} already complete, ${totalFailed} failed`)
  console.log('    Run "npm run discover && npm run generate" to update data.js')
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
