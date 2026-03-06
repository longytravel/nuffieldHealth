# SensAI Video Production Plan

## Status: VIDEO RENDERED — READY FOR REVIEW

---

## What's Done

### Video Render (COMPLETE)
- **Output:** `video/output.mp4` (~13.9 min, 1920x1080, 30fps, h264)
- **Total frames:** 25,088
- **Scenes:** 16 with fade transitions (15-frame crossfade between each)
- **Tool:** Remotion 4.0.431 (React-based programmatic video)
- **Concurrency:** 8x rendering
- **Project:** `video/` directory with full source (re-renderable)

### Screenshots (COMPLETE)
- **24 screenshots** + 1 bonus captured via Playwright MCP
- **Resolution:** 1920x1080 PNG
- **Location:** `nuffield-health/assets/screenshots/` (source) and `video/public/screenshots/` (Remotion)
- **Consultant used:** Dr Bryan Youl (Bronze tier, score 50) for profile/rewrite screenshots
- **Live copilot query:** "Which specialty has the most missing photos?" → Clinical Radiology response captured

### Remotion Project (COMPLETE)
- **Location:** `video/`
- **16 scene components** in `video/src/scenes/`
- **5 shared components:** SlideLayout, Screenshot, FadeText, BrandFrame, NumberCounter
- **Animations:** Ken Burns pan/zoom on screenshots, spring entrances, number counters, line-by-line text reveals
- **Preview:** `cd video && npm run studio` (opens Remotion Studio on port 3100)
- **Re-render:** `cd video && npm run render` (requires ffmpeg in PATH)

### Audio Voiceover (COMPLETE)
- **16 MP3 files** generated via ElevenLabs API
- **Voice:** George — "Warm, Captivating Storyteller" (British male), voice ID `JBFqnCBsd6RMkjVDRZzb`
- **Model:** eleven_multilingual_v2
- **Location:** `nuffield-health/assets/audio/`
- **Total size:** 12.9 MB
- **Generation script:** `nuffield-health/scripts/generate-voiceover.mjs` (re-runnable with `--scene N` for individual scenes)

### Script (COMPLETE)
- **File:** `_bmad-output/planning-artifacts/video-script-sensai-platform.md`
- **Version:** v2 (storytelling rewrite — emotional arc, not feature-list)
- **16 scenes**, ~11 minutes total
- **Emotional arc:** Patient vulnerability → Invisible problem → SensAI enters → Platform power → Rewrite Engine climax → Transformation → Close

### Audio Files Inventory
```
Scene01-The-Hook.mp3                        (0.5 MB, ~30s)
Scene02-The-Scale-of-the-Invisible-Pro.mp3  (0.7 MB, ~45s)
Scene03-Enter-SensAI.mp3                    (0.5 MB, ~35s)
Scene04-The-Dashboard-Seeing-Everythin.mp3  (1.4 MB, ~70s)
Scene05-Consultant-Explorer-Finding-An.mp3  (1.0 MB, ~55s)
Scene06-Consultant-Profile-The-Full-St.mp3  (1.2 MB, ~60s)
Scene07-Hospital-Benchmarking-Whos-Lea.mp3  (0.6 MB, ~35s)
Scene08-Specialty-Analysis-Different-S.mp3  (0.7 MB, ~30s)
Scene09-Action-Centre-From-Insight-to-.mp3  (1.1 MB, ~50s)
Scene10-Review-Queue-The-Human-Safety-.mp3  (0.6 MB, ~30s)
Scene11-Reports-StakeholderReady-in-Se.mp3  (0.7 MB, ~30s)
Scene12-The-Rewrite-Engine-Where-AI-Be.mp3  (1.6 MB, ~70s)
Scene13-Configuration-Your-Rules-Your-.mp3  (0.7 MB, ~35s)
Scene14-AI-Copilot-Ask-Anything.mp3         (0.5 MB, ~30s)
Scene15-The-Transformation-What-Change.mp3  (0.9 MB, ~45s)
Scene16-Closing.mp3                         (0.1 MB, ~15s)
```

---

## What's Next

### Polish & Review
- Watch the full video and note any timing/visual issues
- Optional: add subtle background music (10-15% volume under narration)
- Optional: adjust scene pacing if any feels too long/short (edit `video/src/lib/constants.ts` SCENE_DURATIONS)
- Optional: swap/add screenshots for more visual variety
- Re-render after any changes: `cd video && npm run render`

---

## Completed Phases (Reference)

### Phase 1: Take Screenshots (24 captures) — DONE

The app must be running first:
```bash
cd nuffield-health
pnpm dev
```
The app runs at `http://localhost:3000` (Next.js).

Use Playwright (available via MCP) to navigate to each page and capture screenshots. Save all screenshots to `nuffield-health/assets/screenshots/`.

**IMPORTANT:** The app uses a dark theme. Ensure browser window is sized consistently — recommend **1920x1080** for all captures. Some scenes need zoomed/cropped views of specific sections — take the full page first, then crop or take element-level screenshots.

#### Screenshot List

| # | Filename | Page/URL | What to capture | For Scene |
|---|----------|----------|-----------------|-----------|
| 1 | `01-sensai-logo.png` | N/A — use brand asset | SensAI logo from `Branding/image.png` | 3, 15, 16 |
| 2 | `02-nuffield-profile-external.png` | External Nuffield site (optional) | A real consultant profile with visible gaps (no photo, thin bio). Can skip if too complex — use a text slide instead | 2 |
| 3 | `03-dashboard-full.png` | `http://localhost:3000/` | Full dashboard page with sidebar visible | 3, 4 |
| 4 | `04-dashboard-kpi-cards.png` | `http://localhost:3000/` | Zoomed into the 8 KPI cards row at top | 4 |
| 5 | `05-dashboard-tier-donut.png` | `http://localhost:3000/` | Tier distribution donut chart area | 4 |
| 6 | `06-dashboard-quick-actions.png` | `http://localhost:3000/` | Quick Actions panel | 4 |
| 7 | `07-dashboard-hospital-leaderboard.png` | `http://localhost:3000/` | Hospital Leaderboard section at bottom | 4 |
| 8 | `08-consultants-full.png` | `http://localhost:3000/consultants` | Full consultants page — filter sidebar open + table with data | 5 |
| 9 | `09-consultants-filtered.png` | `http://localhost:3000/consultants?quality_tier=Bronze&has_photo=false` | Same page with filters applied — show Bronze + no photo filter chips visible, narrowed results | 5 |
| 10 | `10-profile-detail-header.png` | `http://localhost:3000/consultants/[pick-a-slug]` | Consultant detail page — score gauge, tier badge, flags, header section. Pick a consultant with a Bronze or Silver tier and some flags for visual interest | 6 |
| 11 | `11-profile-detail-ai-tab.png` | Same page, AI Assessment tab clicked | AI Assessment tab open showing evidence/reasoning text | 6 |
| 12 | `12-hospitals-full.png` | `http://localhost:3000/hospitals` | Hospital benchmarking card grid with tier distribution bars | 7 |
| 13 | `13-specialties-full.png` | `http://localhost:3000/specialties` | Specialty analysis cards + heatmap if visible | 8 |
| 14 | `14-actions-impact-cards.png` | `http://localhost:3000/actions` | Top section — the 4 impact summary cards (current vs projected with green deltas) | 9 |
| 15 | `15-actions-table.png` | `http://localhost:3000/actions` | Prioritised actions table below the impact cards | 9 |
| 16 | `16-review-queue.png` | `http://localhost:3000/consultants/review` | Review queue with flagged profiles, severity badges, checkboxes | 10 |
| 17 | `17-reports-pdf.png` | `http://localhost:3000/reports` | Reports page — PDF preview tab active | 11 |
| 18 | `18-reports-csv.png` | `http://localhost:3000/reports` | Reports page — CSV export builder tab active | 11 |
| 19 | `19-rewrite-workspace.png` | `http://localhost:3000/rewrite?slug=[pick-a-slug]` | Rewrite workspace showing element cards with current content | 12 |
| 20 | `20-rewrite-before-after.png` | Same page after a rewrite is triggered | Before/after comparison + source evidence panel. NOTE: This may require triggering an actual rewrite or having pre-existing rewrite data in the DB. If no rewrite data exists, capture the workspace in its initial state showing the element cards — still valuable | 12 |
| 21 | `21-rewrite-benchmarks.png` | Same page | Benchmark bar showing top performers. May be part of the same view | 12 |
| 22 | `22-configuration-full.png` | `http://localhost:3000/configuration` | Configuration page — weights table, tier thresholds, gate rules | 13 |
| 23 | `23-copilot-open.png` | Any page with Copilot widget open | AI Copilot widget opened (Ctrl+K), ideally with a query typed and response visible. If the copilot requires an API call to show a response, just capture it with a query typed in | 14 |
| 24 | `24-copilot-response.png` | Same | Copilot showing a result/response. If not possible to trigger live, capture the empty state with the query box visible | 14 |

#### Choosing a Consultant for Detail Screenshots
Pick a consultant slug that:
- Has a **Silver or Bronze** tier (more visually interesting than Gold — shows room for improvement)
- Has **some flags** (fail or warn — shows severity badges)
- Has a **populated AI assessment** (bio_depth_reason, plain_english_reason etc. not null)
- Has **treatments and qualifications** listed (content to show in tabs)

To find one, query the DB:
```bash
cd nuffield-health
npx tsx -e "
  const { db } = require('./src/db');
  const { consultants } = require('./src/db/schema');
  const { eq, and, isNotNull, not } = require('drizzle-orm');
  // Find a Silver/Bronze consultant with flags and AI reasoning
  const result = db.select({ slug: consultants.slug, name: consultants.name, tier: consultants.quality_tier, flags: consultants.flags })
    .from(consultants)
    .where(and(
      not(eq(consultants.quality_tier, 'Gold')),
      isNotNull(consultants.bio_depth_reason)
    ))
    .limit(5)
    .all();
  console.log(JSON.stringify(result, null, 2));
"
```
Or just browse `http://localhost:3000/consultants?quality_tier=Silver` and pick one that looks good.

#### Screenshot Technical Details
- **Resolution:** 1920x1080 (set via Playwright `browser_resize`)
- **Format:** PNG
- **Save to:** `nuffield-health/assets/screenshots/`
- **Tool:** Playwright MCP (`browser_navigate` → `browser_take_screenshot`)
- For zoomed sections: use `browser_snapshot` to find element refs, then `browser_take_screenshot` with element ref for targeted captures
- For the Copilot: navigate to any page, use `browser_press_key` with Ctrl+K to open it, type a query, then screenshot

---

### Phase 2: Assemble the Video — DONE (Remotion)

#### Option A: Remotion (Code-Driven) — USED
Build a Remotion project that imports screenshots + audio and renders a video.

```bash
# From project root
npx create-video@latest video --template blank
cd video
npm install
```

Structure:
```
video/
├── src/
│   ├── Root.tsx              — Register all compositions
│   ├── Video.tsx             — Main sequence (all scenes in order)
│   ├── scenes/
│   │   ├── Scene01-Hook.tsx          — Text-on-dark, line-by-line fade
│   │   ├── Scene02-Problem.tsx       — Animated numbers + screenshot
│   │   ├── Scene03-EnterSensAI.tsx   — Logo reveal + sidebar slide-in
│   │   ├── Scene04-Dashboard.tsx     — Screenshot with Ken Burns zoom
│   │   ├── Scene05-Explorer.tsx      — Two screenshots (unfiltered → filtered)
│   │   ├── Scene06-Profile.tsx       — Score gauge focus + tab switch
│   │   ├── Scene07-Hospitals.tsx     — Card grid screenshot
│   │   ├── Scene08-Specialties.tsx   — Heatmap screenshot
│   │   ├── Scene09-Actions.tsx       — Impact cards + table
│   │   ├── Scene10-Review.tsx        — Flagged profiles
│   │   ├── Scene11-Reports.tsx       — PDF + CSV tabs
│   │   ├── Scene12-Rewrite.tsx       — Multi-screenshot (workspace → before/after → benchmarks)
│   │   ├── Scene13-Config.tsx        — Configuration screenshot
│   │   ├── Scene14-Copilot.tsx       — Copilot widget screenshots
│   │   ├── Scene15-Transformation.tsx — Stats animation + logo
│   │   └── Scene16-Closing.tsx       — Logo + tagline fade
│   ├── components/
│   │   ├── SlideLayout.tsx           — Consistent frame (dark bg, padding, brand bar)
│   │   ├── Screenshot.tsx            — Image with optional Ken Burns pan/zoom
│   │   ├── FadeText.tsx              — Line-by-line text reveal synced to timing
│   │   ├── NumberCounter.tsx         — Counting number animation (3,800...)
│   │   └── BrandFrame.tsx            — SensAI logo + tagline centered
│   └── assets/                       — Symlink or copy from nuffield-health/assets/
│       ├── screenshots/
│       ├── audio/
│       └── branding/
├── package.json
└── remotion.config.ts
```

Each scene component:
1. Imports its audio MP3 via `<Audio src={...} />`
2. Uses `useCurrentFrame()` and `fps` to time visual transitions to the audio
3. Returns the visual composition (screenshot + overlays + text)

Render command:
```bash
npx remotion render Video output.mp4
```

#### Option B: Clipchamp (Manual)
If Remotion proves too complex or user prefers manual:
1. Open Clipchamp (Start menu → search "Clipchamp")
2. Create new video (16:9, 1080p)
3. Import all 16 MP3s + all screenshots
4. Drag audio onto timeline scene by scene
5. Place matching screenshots over each audio clip
6. Add text overlays for Scene 1 (text-on-dark) and Scene 16 (closing)
7. Add transitions between scenes (simple fade/dissolve)
8. Export as MP4

---

### Phase 3: Polish (Optional)

- **Background music:** Royalty-free ambient track from YouTube Audio Library. Keep it very low (10-15% volume) under the narration.
- **Text overlays:** Key stats that appear on screen during narration (e.g., "3,800 profiles" animates in during Scene 2)
- **Transitions:** Simple crossfade between scenes (0.5-1s). No flashy effects.
- **Intro/outro cards:** Dark background with SensAI logo for Scenes 1, 15, 16

---

## File Locations Summary

| Asset | Path |
|-------|------|
| **Final video** | `video/output.mp4` |
| Remotion project (re-renderable) | `video/` |
| Video script (v2) | `_bmad-output/planning-artifacts/video-script-sensai-platform.md` |
| This production plan | `_bmad-output/planning-artifacts/video-production-plan.md` |
| Audio MP3s (16 files) | `nuffield-health/assets/audio/` |
| Screenshots (24 + 1 bonus) | `nuffield-health/assets/screenshots/` |
| ElevenLabs generation script | `nuffield-health/scripts/generate-voiceover.mjs` |
| SensAI brand logo | `Branding/image.png` |
| App source code | `nuffield-health/src/app/` |
| ElevenLabs API key | `nuffield-health/.env` → `ELEVENLABS_API_KEY` |

## ElevenLabs Config (for regeneration)

- **Voice:** George — `JBFqnCBsd6RMkjVDRZzb`
- **Model:** `eleven_multilingual_v2`
- **Settings:** stability 0.65, similarity 0.78, style 0.35, speaker boost on
- **Regenerate single scene:** `node scripts/generate-voiceover.mjs --scene 4`
- **Regenerate all:** `node scripts/generate-voiceover.mjs`
- **Preview text only:** `node scripts/generate-voiceover.mjs --dry-run`

## App Startup (needed for screenshots)

```bash
cd nuffield-health
pnpm dev
# App runs at http://localhost:3000
```

Database must have data from a previous scrape run. The latest run should have consultant data populated. If the app shows no data, a scrape run needs to be executed first (see CLAUDE.md for instructions).

---

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| No voice recording | User preference | Using AI voiceover instead |
| Voice | George (British Storyteller) | Matches narrative tone, British for Nuffield/UK context |
| Script style | Emotional storytelling v2 | v1 was too corporate/flat — rewritten with dramatic arc |
| Video tool | Remotion (primary) or Clipchamp (fallback) | Remotion is code-driven, repeatable, fits React stack |
| Audio first | Before screenshots | Audio dictates timing; screenshots sync to narration |
| All 16 scenes at once | User upgraded ElevenLabs plan | 12,958 chars exceeds free tier (10,000) |
| Remotion version | 4.0.431 | Latest stable; 4.0.261 (initially tried) didn't exist for @remotion/media |
| Profile subject | Dr Bryan Youl | Bronze tier (score 50), good flags and AI evidence for visual interest |
| Copilot query | "Which specialty has most missing photos?" | Conservative API spend; produced rich Clinical Radiology response |
| Scene 2 approach | Text slide with stats | User chose animated numbers over screenshot of external Nuffield site |
| ffmpeg | winget install Gyan.FFmpeg | Required by Remotion for h264 encoding |
