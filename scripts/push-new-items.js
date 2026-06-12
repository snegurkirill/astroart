#!/usr/bin/env node
// scripts/push-new-items.js
// Pushes items from data.local.json that don't yet exist in Notion (by # value).
// Safe to re-run — skips rows already present.

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

async function getExistingIds() {
  const ids = new Set()
  let cursor
  while (true) {
    const body = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const data = await notion('POST', `/databases/${DB_ID}/query`, body)
    for (const page of data.results) {
      const p = page.properties['#']
      if (p?.type === 'number' && p.number != null) ids.add(p.number)
    }
    if (!data.has_more) break
    cursor = data.next_cursor
  }
  return ids
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
  const items = Object.values(local).sort((a, b) => a.id - b.id)

  console.log('📡  Checking existing Notion rows...')
  const existing = await getExistingIds()
  console.log(`    Found ${existing.size} existing rows`)

  const toAdd = items.filter(item => !existing.has(item.id))
  if (toAdd.length === 0) {
    console.log('✅  Nothing to add — all items already in Notion')
    return
  }

  console.log(`\n📤  Adding ${toAdd.length} new rows...`)
  for (const item of toAdd) {
    process.stdout.write(`    ${String(item.id).padStart(2, '0')}  ${item.title}...`)
    await createRow(item)
    console.log(' ✓')
    await new Promise(r => setTimeout(r, 350))
  }

  console.log(`\n✅  Done. Added ${toAdd.length} rows to Notion.`)
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
