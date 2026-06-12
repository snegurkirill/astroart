#!/usr/bin/env node
// scripts/reorder-notion.js
// 1. Patches # on all existing Notion rows using old→new ID mapping
// 2. Creates any new rows that don't exist yet
// Run via "Reorder Notion" workflow after renumbering items by year.

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

// old # → new # (generated after year-based renumbering of all 38 items)
const OLD_TO_NEW = {
  1:1, 2:2, 3:3, 4:5, 5:4, 6:6, 7:7, 8:8, 9:9,
  10:13, 11:11, 12:14, 13:19, 14:20, 15:24, 16:25, 17:26, 18:28, 19:31,
  20:27, 21:35, 22:32, 23:29, 24:33, 25:34, 26:23, 27:21, 28:36, 29:37,
  30:22, 31:10,
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

function getNum(prop) {
  if (!prop) return null
  if (prop.type === 'number') return prop.number
  if (prop.type === 'rich_text') return parseInt(prop.rich_text.map(t => t.plain_text).join(''))
  return null
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

  console.log('📡  Fetching existing Notion pages...')
  const pages = await queryDatabase()
  console.log(`    Found ${pages.length} existing pages`)

  const firstProps = pages[0]?.properties || {}
  const numKey = '#' in firstProps ? '#' : Object.keys(firstProps).find(k => firstProps[k].type === 'number') || '#'

  // Build map: old# → pageId
  const oldNumToPageId = {}
  for (const page of pages) {
    const num = getNum(page.properties[numKey])
    if (num != null) oldNumToPageId[num] = page.id
  }

  const existingNums = new Set(Object.keys(oldNumToPageId).map(Number))

  // ── Step 1: patch # on all existing rows ──────────────────────────────────
  console.log('\n🔢  Renumbering existing rows...')
  let patched = 0
  for (const [oldNum, newNum] of Object.entries(OLD_TO_NEW)) {
    const pageId = oldNumToPageId[parseInt(oldNum)]
    if (!pageId) { console.log(`    ⚠️  old #${oldNum} not found in Notion, skipping`); continue }
    if (parseInt(oldNum) === newNum) { continue } // unchanged

    process.stdout.write(`    #${oldNum} → #${newNum}...`)
    await notion('PATCH', `/pages/${pageId}`, {
      properties: { '#': { number: newNum } },
    })
    console.log(' ✓')
    patched++
    await new Promise(r => setTimeout(r, 350))
  }
  console.log(`    Patched ${patched} rows`)

  // ── Step 2: create new rows that don't exist ──────────────────────────────
  const toAdd = allItems.filter(item => !existingNums.has(item.id))
  if (toAdd.length === 0) {
    console.log('\n✅  No new rows to create')
  } else {
    console.log(`\n📤  Creating ${toAdd.length} new rows...`)
    for (const item of toAdd) {
      process.stdout.write(`    ${String(item.id).padStart(2, '0')}  ${item.title}...`)
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
