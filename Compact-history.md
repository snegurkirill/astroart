# Astro Art — Project Log

## Stack
- **Vite + React** (no Three.js — CSS 3D transforms only)
- **GitHub Pages** via GitHub Actions CI/CD
- **Notion** as editorial CMS for text content
- Live: https://snegurkirill.github.io/astroart/
- Repo: https://github.com/snegurkirill/astroart

---

## Architecture

### Two modes
- **Journey** — CSS `preserve-3d` 3D scroll. Cards along Z-axis, alternating left/right, lerp camera (10% per frame). Scroll via wheel + touch.
- **Observation** — full detail view, opened by clicking any visible card.

### Key files
```
src/
  data.js           ← auto-generated, do not hand-edit
  data.local.json   ← source of truth for local content (images, color, description, text overrides)
  components/
    Inward.jsx      ← 3D journey scene
    Above.jsx       ← bottom bar (progress indicator / back button)
    Observation.jsx ← detail view
  App.jsx

scripts/
  discover-images.js   ← scans public/images/ → updates data.local.json
  generate-data.js     ← data.local.json → src/data.js (no Notion needed)
  sync-notion.js       ← Notion + data.local.json → src/data.js → commit → push
  push-to-notion.js    ← one-time: pushes local content INTO Notion (already ran)

public/images/
  01-lascaux/      02-nebra/      03-senenmut/
  04-dendera/      05-mul-apin/   06-farnese-atlas/
  07-dunhuang/     08-al-sufi/    09-giotto/
  10-hevelius/     11-holbein/    12-wright-derby/
  13-van-gogh/     14-ansel-adams/ 15-roden-crater/
  16-kusama/       17-eliasson/   18-paglen/
  19-halo/         20-katie-paterson/ 21-robert-hodgin/
  22-fedorova/     23-paperno/    ← 3 photos already added

.github/workflows/
  deploy.yml          ← on push: discover → generate → build → Pages
  sync.yml            ← manual trigger: Notion sync → commit → deploy
  push-to-notion.yml  ← one-time setup (already used, can ignore)
```

---

## Content management flow

### Adding images
1. Drop files into `public/images/XX-slug/` (any filename, any order)
2. `git push`
3. Action auto-discovers → first file alphabetically = cover

### Editing text
1. Edit in Notion database
2. GitHub → Actions → **Sync from Notion** → Run workflow
3. Deploys in ~30s

### Images + text together
1. Add images to folder
2. Edit Notion
3. `git push` + run Sync from Notion

### Local-only update (no Notion)
```bash
npm run discover   # scan images → update data.local.json
npm run generate   # data.local.json → src/data.js
git push
```

---

## Notion integration
- **Token:** stored in GitHub Secret `NOTION_TOKEN`
- **DB ID:** stored in GitHub Secret `NOTION_DB_ID`
- Notion database has these columns: `#`, `Title`, `Artist`, `Collective`, `Year`, `Type`, `Medium`, `Idea`, `Description`, `Sources`
- **Page body** (below properties) = `notes` field — synced as free text
- Images are NOT stored in Notion (Notion image URLs expire in ~1hr)

---

## Data structure (per item)
```js
{
  id,           // 1–23
  title,        // original language
  artist,       // original name
  collective,
  type,
  medium,
  year,
  idea,         // Russian
  description,  // Russian, longer text
  notes,        // from Notion page body
  color,        // hex fallback when no image
  image,        // 'images/23-paperno/01.jpg' or external URL
  imageOptions, // all images for this item
  sources,      // array of URLs
}
```

Gallery displays items in **reverse order** (newest first, `.reverse()` in data.js).

---

## Key technical decisions & bugs fixed

### preserve-3d pointer events bug
Cards in the Queue (behind camera) weren't receiving hover/click events.
**Cause:** the `preserve-3d` container at `worldZ = cameraZ` was intercepting all pointer events for cards at `worldZ < cameraZ`.
**Fix:** `pointerEvents: 'none'` on the preserve-3d container div (`Inward.jsx` line ~190). Cards with `pointerEvents: 'auto'` still receive events correctly.

### Observation mode scroll (mobile)
`display: flex` on the scroll container caused `scrollHeight === clientHeight` — content never overflowed.
**Fix:** Removed flex from outer container, used `margin: 0 auto` on article + `minHeight: '100%'` to preserve bottom-anchoring for short content.

### Inward always mounted
Inward stays mounted during Observation mode (opacity:0 wrapper) to preserve scroll position. `opacity: 0` on a parent creates a stacking context that composites `position:fixed` children — effectively hides them without unmounting.

### Image sizing
- Holbein and Van Gogh use 1280px Wikimedia thumbnails (originals are 600MB+)
- Eliasson Cloudinary "private" URL works despite the path name

---

## npm scripts
```
npm run dev        # local dev server (localhost:5173)
npm run build      # production build
npm run discover   # scan images, update data.local.json
npm run generate   # data.local.json → src/data.js
npm run sync       # full Notion sync (needs env vars)
```

---

## Pending / Notes
- **"View" button on cards** shifts on mobile; low priority (hover isn't a mobile pattern anyway — consider hiding on touch devices)
- **Mobile journey layout** — cards cluster at 375px; deferred for later rethink
- **Multi-image Observation view** — imageOptions array is populated but UI only shows first image; photo carousel/gallery not yet built
- **Notion sync error history** — `invalid_request_url` was caused by malformed DB_ID in secret; fixed by adding `cleanDbId()` sanitizer in both sync scripts
