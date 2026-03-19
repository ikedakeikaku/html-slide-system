---
name: html-slide
description: >
  HTMLウェブページとしてプレゼンテーションスライドを生成するスキル。
  16:9比率のセクションをブラウザで全画面表示し、PowerPointと同等以上の
  プレゼンテーション体験を実現する。

  以下のリクエストでこのスキルを使うこと:
  - 「HTMLスライドを作って」「ウェブスライド」
  - 「ブラウザで表示するプレゼン」
  - 「インタラクティブなスライド」
  - 「Chart.jsでグラフ付きスライド」
  - .pptx が不要で、ブラウザ表示前提の場合全般
---

# HTML Slide Skill

## Quick Reference

| Task | How |
|------|-----|
| New slide deck | Select templates → inject data → combine with _base structure |
| Change theme | Override CSS variables in `:root` |
| Add chart | Use Chart.js + chartjs-plugin-datalabels |
| QA check | Open HTML with `?qa=true` or inject `qa/qa-runner.js` |
| PDF export | Browser print (Ctrl+P) or Puppeteer |

## Generation Workflow (v2: Template-based)

### Step 1: Understand Requirements
- Content topic, audience, tone
- Number of slides (default: 5-10)
- Key metrics/data to include

### Step 2: Select Theme
Default: Corporate Blue. Available themes:
- `corporate-blue` — #0652DD (IR, corporate)
- `midnight` — #1E2761 (executive, board)
- `forest-green` — #2C5F2D (ESG, sustainability)
- `warm-terracotta` — #B85042 (brand, design)
- `teal-trust` — #028090 (tech, SaaS)

### Step 3: Assign Templates to Each Slide

Select from QA-verified templates:

| Template | Use Case | Key Constraints |
|----------|----------|-----------------|
| `title-gradient.html` | Title slide with gradient art | Title: max 30 chars/line, Subtitle: max 60 chars |
| `kpi-3col.html` | 3-column KPI summary cards | Number: max 6 digits, Header: max 15 chars |
| `chart-bar-dual.html` | Side-by-side bar charts (Chart.js) | 9-12 data points per chart, labels: max 8 chars |
| `table-comparison.html` | Before/After comparison table | Row label: max 8 chars JP, 4-5 data columns |
| `text-review.html` | Policy + Results review layout | Policy: max 120 chars, 4 result cards |

### Step 4: Build the HTML

1. Start with the standard HTML skeleton (DOCTYPE, head, CSS variables, body)
2. Include design-system CSS inline (all from `design-system.css`)
3. Include navigation JS inline (from `navigation.js`)
4. For each slide, copy the `<section class="slide">` from the selected template
5. Replace placeholder data with actual content
6. Set `id="slide-N"` sequentially
7. First slide gets `class="slide active"`

### Step 5: QA

1. Open in browser — verify all slides render correctly
2. Test keyboard navigation (Arrow keys)
3. Append `?qa=true` to URL for automated scoring
4. Target: 95%+ QA score

## Design Rules (v2 — QA-verified)

### MUST
- **Padding: 120px** left/right on all slides (v2 fix: was 80px)
- **No side labels** — eliminated to prevent text collision
- **KPI numbers: 48px+ font-size** (recommend 60px)
- **Chart.js for all charts** — CSS bar charts are deprecated
- **Fixed chart height: 480px** to prevent X-axis label clipping
- **Table row labels: min-width 240px** + `white-space: nowrap`
- **Footer on every content slide** (footnotes + page number)
- **Visual element on every slide** (no text-only slides)
- **Line-height: 1.6+** for body text, 1.8+ for insight cards
- **Font minimum: 14px** for all visible text (footnotes can be 11px)

### MUST NOT
- No `position: absolute; left: 12px` side labels (v1 collision bug)
- No CSS-only bar charts (v1 X-axis clipping bug)
- No `padding: 80px` or less (v1 cramped layout)
- No table column width under 200px for Japanese text
- No same layout template 3+ times in a row
- No Chart.js without datalabels plugin
- No external font loading (use system-ui fallback)

## Template Data Replacement Guide

### title-gradient.html
```
.title-main       → Presentation title (max 30 chars/line)
.title-sub         → Subtitle (max 60 chars)
.title-date        → Date string
.title-logo svg    → Company logo SVG or remove
```

### kpi-3col.html
```
.kpi-card__header  → Segment name (max 15 chars)
.kpi-label         → Metric name (max 8 chars)
.kpi-number        → Number value (max 6 digits + comma)
.kpi-unit          → Unit (2-4 chars: 億円, M, % etc)
.kpi-change        → YoY change (class: positive/negative)
.kpi-summary__text → Summary sentence (max 80 chars)
```

### chart-bar-dual.html
```
labels array       → X-axis labels (max 12 items, 8 chars each)
revenueData array  → Left chart numeric values
profitData array   → Right chart numeric values
.chart-panel__title → Chart title (max 15 chars)
.yoy-percent        → YoY percentage
```

### table-comparison.html
```
thead th            → Column headers (max 20 chars)
.row-label          → Row labels (max 8 chars JP)
td content          → Cell values
.highlight          → Accent-colored cells (changed values)
.revision-indicator → Banner text (max 40 chars)
.table-supplement   → Supplementary note (max 100 chars)
```

### text-review.html
```
.review-policy__content → Policy bullets (max 2 items, 60 chars each)
.result-card__title     → Result heading (max 20 chars)
.result-card .metric    → Key metric (number + unit + YoY)
.result-card__body      → Description (max 60 chars)
```

## Autoresearch Mode

Trigger: "スキルのautoresearchを実行" / "スライドスキルを改善して"

### Process
1. Generate slides using test inputs (`test-inputs/*.json`)
2. Run QA with `?qa=true`
3. Parse `QA_RESULT:` from console output
4. Identify lowest-scoring check
5. Make ONE change to template or SKILL.md
6. Re-generate and re-score
7. Keep change if score improves, revert if not
8. Repeat until 95%+ × 3 consecutive passes

### Scope of Changes
- OK: CSS values, SKILL.md rules, design constraints
- CAUTION: Template HTML structure
- FORBIDDEN: Navigation JS, QA checklist itself

### Log
All changes recorded in `qa/autoresearch-log.json`

## File Structure

```
skills/html-slide/
  SKILL.md                    ← This file
  design-system.css           ← CSS variables & common styles
  navigation.js               ← Slide navigation (keyboard, touch, wheel)
  templates/
    title-gradient.html       ← Title: gradient art decoration
    kpi-3col.html             ← KPI: 3-column card grid
    chart-bar-dual.html       ← Chart: dual bar (Chart.js)
    table-comparison.html     ← Table: before/after comparison
    text-review.html          ← Text: policy + results review
  qa/
    qa-runner.js              ← Browser-based QA automation
    checklist.json            ← Check definitions & scoring
    autoresearch-log.json     ← Improvement history
  test-inputs/                ← Fixed test data for autoresearch
  themes/                     ← Color theme overrides
  examples/                   ← Complete sample decks
```
