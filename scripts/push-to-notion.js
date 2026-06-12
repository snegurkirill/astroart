#!/usr/bin/env node
// scripts/push-to-notion.js
// ONE-TIME: pushes current local content into an empty Notion database.
// Sets up the schema (columns) and creates one row per item.
// Run once, then use sync-notion.js to pull changes back.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

const TOKEN = process.env.NOTION_TOKEN?.trim()

// Accept any format: full URL, UUID with hyphens, raw 32-char hex
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

console.log(`🔑  DB_ID resolved to: ${DB_ID}`)

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
}

async function notion(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${data.message}`)
  return data
}

function richText(str) {
  return [{ text: { content: String(str || '').slice(0, 2000) } }]
}

// ── Step 1: set up database schema ───────────────────────────────────────────

async function setupSchema() {
  console.log('🛠   Setting up Notion database schema...')
  await notion('PATCH', `/databases/${DB_ID}`, {
    properties: {
      // "Name" is the default Notion title column — rename it
      Name:        { name: 'Title', title: {} },
      '#':         { number: { format: 'number' } },
      Artist:      { rich_text: {} },
      Collective:  { rich_text: {} },
      Year:        { rich_text: {} },
      Type:        { rich_text: {} },
      Medium:      { rich_text: {} },
      Idea:        { rich_text: {} },
      Description: { rich_text: {} },
      Sources:     { rich_text: {} },
    },
  })
  console.log('✅  Schema ready')
}

// ── Step 2: create one page (row) per item ────────────────────────────────────

async function createRow(item) {
  await notion('POST', '/pages', {
    parent: { database_id: DB_ID },
    properties: {
      Title:       { title: richText(item.title) },
      '#':         { number: item.id },
      Artist:      { rich_text: richText(item.artist || '') },
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load local content
  const local = JSON.parse(readFileSync(join(ROOT, 'src/data.local.json'), 'utf8'))
  const items = Object.values(local).sort((a, b) => a.id - b.id)

  await setupSchema()

  console.log(`\n📤  Creating ${items.length} rows in Notion...`)
  for (const item of items) {
    process.stdout.write(`    ${String(item.id).padStart(2, '0')}  ${item.title}...`)
    await createRow(item)
    console.log(' ✓')
    // Small delay to respect Notion rate limits (3 req/s)
    await new Promise(r => setTimeout(r, 350))
  }

  console.log('\n✅  All items pushed to Notion.')
  console.log('    Open your database and review the content.')
  console.log('    From now on: edit in Notion → run "Sync from Notion" workflow → deploys.')
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
