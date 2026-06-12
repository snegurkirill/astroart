#!/usr/bin/env node
// scripts/repair-notion.js
// Fixes two bugs from reorder-notion.js:
//   1. DUPLICATES: items 32–37 were both patched (from old IDs) AND re-created
//   2. MISSING:    items 12,15,16,17,18,30 had new IDs ≤ 31 so were never created
//
// Run via "Repair Notion" workflow.

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

function getNum(page) {
  const p = page.properties['#']
  if (!p) return null
  if (p.type === 'number') return p.number
  if (p.type === 'rich_text') return parseInt(p.rich_text.map(t => t.plain_text).join(''))
  return null
}

function getTitle(page) {
  const t = page.properties['Title'] || page.properties['Name']
  if (!t) return '(no title)'
  if (t.type === 'title') return t.title.map(r => r.plain_text).join('')
  return '(unknown)'
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

  console.log('📡  Fetching all Notion pages...')
  const pages = await queryDatabase()
  console.log(`    Found ${pages.length} pages total`)

  // Group pages by # value
  const byNum = new Map()
  for (const page of pages) {
    const num = getNum(page)
    if (num == null) { console.log(`  ⚠️  page ${page.id} has no # value`); continue }
    if (!byNum.has(num)) byNum.set(num, [])
    byNum.get(num).push(page)
  }

  // ── Step 1: delete duplicates ─────────────────────────────────────────────
  console.log('\n🗑   Checking for duplicates...')
  let deleted = 0
  for (const [num, group] of byNum.entries()) {
    if (group.length <= 1) continue
    // Sort: keep the one with more properties filled, delete the rest
    // Heuristic: keep page with longer title (the one created by reorder with full data)
    group.sort((a, b) => getTitle(b).length - getTitle(a).length)
    const keep = group[0]
    const dupes = group.slice(1)
    console.log(`  #${num} "${getTitle(keep)}" — ${dupes.length} duplicate(s)`)
    for (const dupe of dupes) {
      console.log(`    archiving duplicate page ${dupe.id} "${getTitle(dupe)}"`)
      await notion('PATCH', `/pages/${dupe.id}`, { archived: true })
      deleted++
      await new Promise(r => setTimeout(r, 350))
    }
  }
  if (deleted === 0) console.log('  No duplicates found')
  else console.log(`  Deleted ${deleted} duplicate(s)`)

  // ── Step 2: create missing rows ───────────────────────────────────────────
  const presentNums = new Set(byNum.keys())
  const missing = allItems.filter(item => !presentNums.has(item.id))

  console.log(`\n📤  Missing rows: ${missing.length}`)
  if (missing.length === 0) {
    console.log('  Nothing to add')
  } else {
    for (const item of missing) {
      process.stdout.write(`  ${String(item.id).padStart(2, '0')}  ${item.title}...`)
      await createRow(item)
      console.log(' ✓')
      await new Promise(r => setTimeout(r, 350))
    }
  }

  console.log('\n✅  Done.')
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
