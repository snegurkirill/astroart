#!/usr/bin/env node
// scripts/patch-years-notion.js
// PATCHes the Year field on every existing Notion page from data.local.json.
// Run via GitHub Actions: "Patch Years in Notion" workflow.

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

console.log(`🔑  DB_ID: ${DB_ID}`)

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

async function queryDatabase() {
  const results = []
  let cursor = undefined
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
  if (prop.type === 'title') return parseInt(prop.title.map(t => t.plain_text).join(''))
  return null
}

async function main() {
  const local = JSON.parse(readFileSync(join(ROOT, 'src/data.local.json'), 'utf8'))
  const yearMap = {}
  for (const [, v] of Object.entries(local)) {
    if (v.id && v.year) yearMap[v.id] = v.year
  }

  console.log('📡  Fetching Notion pages...')
  const pages = await queryDatabase()
  console.log(`    Found ${pages.length} pages`)

  // Detect which property holds the item number
  const firstProps = pages[0]?.properties || {}
  const numKey = '#' in firstProps ? '#' : Object.keys(firstProps).find(k => firstProps[k].type === 'number') || '#'

  // Detect year column name (could be "Year" or "Year (approx.)")
  const yearKey = 'Year' in firstProps ? 'Year' : 'Year (approx.)'
  console.log(`    Using number column: "${numKey}", year column: "${yearKey}"`)

  let updated = 0
  let skipped = 0

  for (const page of pages) {
    const id = getNum(page.properties[numKey])
    if (!id || !yearMap[id]) { skipped++; continue }

    const year = yearMap[id]
    process.stdout.write(`    ${String(id).padStart(2, '0')}  ${year}...`)

    await notion('PATCH', `/pages/${page.id}`, {
      properties: {
        [yearKey]: { rich_text: [{ text: { content: year } }] },
      },
    })

    console.log(' ✓')
    updated++
    await new Promise(r => setTimeout(r, 350)) // respect 3 req/s rate limit
  }

  console.log(`\n✅  Updated ${updated} pages, skipped ${skipped}`)
}

main().catch(err => {
  console.error('❌ ', err.message)
  process.exit(1)
})
