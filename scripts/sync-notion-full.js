#!/usr/bin/env node
// scripts/sync-notion-full.js
// Full sync: matches Notion rows to data.local.json by title,
// then patches # values, creates missing rows, archives stale rows.
// Safe to re-run at any time.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

const TOKEN = process.env.NOTION_TOKEN?.trim()

function cleanDbId(raw) {
  if (!raw) return ''
  const match = raw.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{32})/i)
  return match ? match[1].replace(/-/g, '') : raw.trim()
}

const DB_ID = cleanDbId(process.env.NOTION_DB_ID)

if (!TOKEN || !DB_ID) {
  console.error('❌  Missing NOTION_TOKEN or NOTION_DB_ID')
  process.exit(1)
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
}

async function notion(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method, headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${data.message}`)
  return data
}

function richText(str) {
  return [{ text: { content: String(str || '').slice(0, 2000) } }]
}

async function queryDatabase() {
  const results = []
  let cursor
  while (true) {
    const body = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const data = await notion('POST', `/databases/${DB_ID}/query`, body)
    results.push(...data.results)
    if (!data.has_more) break
    cursor = data.next_cursor
  }
  return results
}

function getTitle(page) {
  for (const key of ['Title', 'Name']) {
    const prop = page.properties[key]
    if (prop?.type === 'title') return prop.title.map(r => r.plain_text).join('').trim()
  }
  return ''
}

function getNum(page) {
  const p = page.properties['#']
  if (!p) return null
  if (p.type === 'number') return p.number
  if (p.type === 'rich_text') return parseInt(p.rich_text.map(t => t.plain_text).join(''))
  return null
}

function normalise(s) {
  return String(s || '').toLowerCase().replace(/[\s ]+/g, ' ').trim()
}

async function createRow(item) {
  await notion('POST', '/pages', {
    parent: { database_id: DB_ID },
    properties: {
      Title:       { title: richText(item.title) },
      '#':         { number: item.id },
      Artist:      { rich_text: richText(item.artist || item.collective || '') },
      Collective:  { rich_text: richText(item.collective || '') },
      Year:        { rich_text: richText(item.year || '') },
      Type:        { rich_text: richText(item.type || '') },
      Medium:      { rich_text: richText(item.medium || '') },
      Idea:        { rich_text: richText(item.idea || '') },
      Description: { rich_text: richText(item.description || '') },
      Sources:     { rich_text: richText((item.sources || []).join('\n')) },
    },
  })
}

async function main() {
  const local = JSON.parse(readFileSync(join(ROOT, 'src/data.local.json'), 'utf8'))
  const allItems = Object.values(local).sort((a, b) => a.id - b.id)

  // Build lookup by normalised title
  const titleToItem = new Map(allItems.map(item => [normalise(item.title), item]))

  console.log('📡  Fetching all Notion pages...')
  const pages = await queryDatabase()
  console.log(`    Found ${pages.length} pages`)

  // Group by normalised title to catch duplicates
  const titleToPages = new Map()
  for (const page of pages) {
    const key = normalise(getTitle(page))
    if (!titleToPages.has(key)) titleToPages.set(key, [])
    titleToPages.get(key).push(page)
  }

  const matched = new Set()

  // ── Step 1: process pages that match a known item title ──────────────────
  console.log('\n🔄  Syncing known items...')
  let patched = 0, archived_dup = 0

  for (const [titleKey, group] of titleToPages.entries()) {
    const item = titleToItem.get(titleKey)
    if (!item) continue  // handled in step 2

    matched.add(titleKey)

    // Sort group: keep the one with a valid # closest to the correct value first
    group.sort((a, b) => {
      const da = Math.abs((getNum(a) || 999) - item.id)
      const db = Math.abs((getNum(b) || 999) - item.id)
      return da - db
    })

    const keep = group[0]
    const dupes = group.slice(1)

    // Archive duplicates
    for (const dupe of dupes) {
      process.stdout.write(`  dup  #${getNum(dupe)} "${getTitle(dupe)}" → archive...`)
      await notion('PATCH', `/pages/${dupe.id}`, { archived: true })
      console.log(' ✓')
      archived_dup++
      await new Promise(r => setTimeout(r, 350))
    }

    // Patch # if wrong
    const current = getNum(keep)
    if (current !== item.id) {
      process.stdout.write(`  #${current} → #${item.id}  "${item.title.slice(0, 35)}"...`)
      await notion('PATCH', `/pages/${keep.id}`, {
        properties: { '#': { number: item.id } },
      })
      console.log(' ✓')
      patched++
      await new Promise(r => setTimeout(r, 350))
    }
  }

  console.log(`  Patched ${patched}, archived ${archived_dup} duplicates`)

  // ── Step 2: archive pages with unrecognised titles ────────────────────────
  console.log('\n🗑   Archiving stale rows...')
  let archived_stale = 0
  for (const [titleKey, group] of titleToPages.entries()) {
    if (titleToItem.has(titleKey)) continue  // known item, handled above
    for (const page of group) {
      process.stdout.write(`  stale  "${getTitle(page)}" → archive...`)
      await notion('PATCH', `/pages/${page.id}`, { archived: true })
      console.log(' ✓')
      archived_stale++
      await new Promise(r => setTimeout(r, 350))
    }
  }
  if (archived_stale === 0) console.log('  Nothing stale')

  // ── Step 3: create items not found in Notion ──────────────────────────────
  console.log('\n📤  Creating missing rows...')
  let created = 0
  for (const item of allItems) {
    if (matched.has(normalise(item.title))) continue
    process.stdout.write(`  ${String(item.id).padStart(2, '0')}  "${item.title.slice(0, 40)}"...`)
    await createRow(item)
    console.log(' ✓')
    created++
    await new Promise(r => setTimeout(r, 350))
  }
  if (created === 0) console.log('  Nothing to create')

  console.log(`\n✅  Done. Patched ${patched}, created ${created}, archived ${archived_dup + archived_stale}.`)
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
