---
name: html-slide
description: >
  HTMLウェブページとしてプレゼンテーションスライドを生成する。
  16:9比率のセクションをブラウザで全画面表示し、メルカリ決算資料品質の
  プレゼンテーションを実現する。単一HTMLファイルで完結、外部依存なし。

  以下のリクエストでこのスキルを使うこと:
  - 「HTMLスライドを作って」「ウェブスライド」「ブラウザで表示するプレゼン」
  - 「インタラクティブなスライド」「Chart.jsでグラフ付きスライド」
  - .pptx が不要で、ブラウザ表示前提の場合全般
---

# HTML Slide Generation Skill

Read `design-system.css` and `navigation.js` in this skill folder before generating.
Each template file in `templates/` is a standalone QA-verified example — open in browser to see.

## Workflow

1. **Requirements** — topic, audience, slide count (5-10), key data
2. **Theme** — set `:root` CSS variables (default: Corporate Blue `#0652DD`)
3. **Template selection** — assign one template per slide from the table below
4. **Build** — assemble single HTML: inline CSS from `design-system.css` + template-specific CSS, slide sections, inline JS from `navigation.js`
5. **Data injection** — replace placeholders with user data, respecting max-char limits
6. **Deliver** — single `.html` file. User opens in browser, presses F11 for fullscreen

## Available Templates

| Template | Purpose | Use When |
|----------|---------|----------|
| `title-gradient` | Title slide with gradient art | First slide. Company name, title, subtitle, date |
| `kpi-3col` | 3-column KPI cards + summary bar | Key metrics overview. 3 big numbers with YoY |
| `chart-bar-dual` | Side-by-side bar charts (Chart.js) | Time-series comparison. Revenue vs Profit etc |
| `table-comparison` | Before/After comparison table | Plan revisions, pricing, budget vs actual |
| `text-review` | Policy box + 4 result cards | Strategy review, achievements + issues |

## Slide Construction Rules

### HTML Skeleton
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <style>
    /* Paste full contents of design-system.css here */
    /* Then paste template-specific CSS below */
  </style>
</head>
<body>
  <nav class="slide-nav">
    <span class="slide-counter"><span id="current">1</span> / <span id="total">{{N}}</span></span>
    <button onclick="prevSlide()">&#8249;</button>
    <button onclick="nextSlide()">&#8250;</button>
    <button onclick="toggleFullscreen()">&#x26F6;</button>
  </nav>
  <div class="progress-bar"><div class="progress-bar__fill" id="progress"></div></div>
  <div class="slides-container">
    <!-- Slide sections go here -->
  </div>
  <!-- Chart.js CDN if any chart slides -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
  <script>Chart.register(ChartDataLabels);</script>
  <!-- Chart init scripts -->
  <script>
    /* Paste full contents of navigation.js here */
  </script>
</body>
</html>
```

### Per-Slide Section Format
- First slide: `<section class="slide slide--title active" id="slide-1">`
- Others: `<section class="slide" id="slide-N">`
- Every content slide needs `<footer class="slide-footer">` with footnotes + page number

## Design Rules (QA-verified, DO NOT CHANGE)

### MUST
- **Slide padding: 120px** left/right (title slides: 140px)
- **No side labels** — removed to prevent collision
- **KPI numbers: 60px** font-size (minimum 48px)
- **Metric text in review cards: 48px** font-size
- **Chart.js for all charts** — no CSS-only charts
- **Chart height: 480px** fixed inside `.chart-panel__canvas-wrap`
- **Chart.js multi-line labels**: pass `["1Q","FY24"]` array, NOT `"1Q\nFY24"` string
- **chartjs-plugin-datalabels** registered on every chart
- **Table row labels: min-width 240px** + `white-space: nowrap`
- **Footer on every content slide**: footnote + page number
- **Visual element on every slide** — no text-only slides
- **Line-height: 1.6+** body, 1.8+ insight cards
- **Font minimum: 14px** (footnotes can be 11px)
- **Description text in `<p class="result-desc">`**, not bare text nodes (prevents overlap false-positive)

### MUST NOT
- No `position: absolute; left: 12px` side labels
- No CSS-only bar charts
- No `padding: 80px` or less
- No table column < 200px for Japanese
- No 3+ consecutive same-template slides
- No Chart.js without datalabels plugin
- No literal `\n` in Chart.js label strings

## Template Reference: title-gradient

**CSS additions** (beyond design-system.css):
```css
.slide--title { display:flex; flex-direction:column; justify-content:center; padding:120px 140px; }
.title-logo { position:absolute; top:48px; left:140px; height:40px; }
.title-main { font-size:56px; font-weight:800; line-height:1.35; max-width:960px; margin-bottom:24px; }
.title-sub { font-size:24px; color:var(--color-text-muted); max-width:800px; }
.title-date { font-size:18px; color:var(--color-text-muted); margin-top:40px; }
```

**HTML** (replace `{{...}}`):
```html
<section class="slide slide--title active" id="slide-1">
  <div class="title-logo">
    <svg viewBox="0 0 {{WIDTH}} 40"><rect width="40" height="40" rx="8" fill="var(--color-primary)"/>
    <text x="52" y="28" font-family="system-ui" font-size="20" font-weight="700" fill="#1A1A1A">{{COMPANY}}</text></svg>
  </div>
  <h1 class="title-main">{{TITLE_LINE1}}<br>{{TITLE_LINE2}}</h1>
  <p class="title-sub">{{SUBTITLE}}</p>
  <p class="title-date">{{DATE}}</p>
  <div class="gradient-art"></div>
</section>
```
- SVG width: `56 + company_name_length * 22`
- Title: max 30 chars/line
- Subtitle: max 60 chars

## Template Reference: kpi-3col

**CSS additions**:
```css
.kpi-content { display:flex; flex-direction:column; }
.kpi-summary { background:var(--color-primary-light); border-radius:12px; padding:24px 36px; margin-bottom:40px; display:flex; align-items:center; gap:40px; }
.kpi-summary__label { font-size:18px; font-weight:700; color:var(--color-primary); white-space:nowrap; }
.kpi-summary__text { font-size:17px; line-height:1.6; }
```

**HTML**:
```html
<section class="slide" id="slide-{{N}}">
  <header class="slide-header">
    <div class="slide-header__left">
      <span class="section-badge">{{SECTION}}</span>
      <h1 class="slide-title">{{TITLE}}</h1>
    </div>
  </header>
  <div class="kpi-content">
    <div class="kpi-summary">
      <span class="kpi-summary__label">{{PERIOD}}</span>
      <span class="kpi-summary__text">{{SUMMARY}}</span>
    </div>
    <div class="kpi-grid">
      <!-- Repeat 3x -->
      <div class="kpi-card">
        <div class="kpi-card__header">{{SEGMENT}}</div>
        <div class="kpi-card__body">
          <span class="kpi-label">{{METRIC}}</span>
          <div class="kpi-value">
            <span class="kpi-number">{{NUMBER}}</span>
            <span class="kpi-unit">{{UNIT}}</span>
          </div>
          <span class="kpi-change positive">{{CHANGE}}</span>
        </div>
      </div>
    </div>
  </div>
  <footer class="slide-footer">
    <div class="slide-footer__notes"><p>{{FOOTNOTE}}</p></div>
    <div class="slide-footer__page">{{PAGE}}</div>
  </footer>
</section>
```
- Segment header: max 15 chars
- Number: max 6 digits + comma
- `kpi-change` class: `positive` (blue) or `negative` (red)

## Template Reference: chart-bar-dual

**CSS additions**:
```css
.chart-panel__canvas-wrap { position:relative; width:100%; height:480px; }
.chart-panel__canvas-wrap canvas { width:100%!important; height:100%!important; }
```

**HTML** (2 panels side by side in `.chart-grid-2col`):
```html
<section class="slide" id="slide-{{N}}">
  <header class="slide-header">...</header>
  <div class="chart-grid-2col">
    <div class="chart-panel">
      <div class="chart-panel__title">{{LEFT_TITLE}}</div>
      <div class="chart-panel__subtitle">{{LEFT_UNIT}}</div>
      <div class="chart-panel__canvas-wrap"><canvas id="chart-left"></canvas></div>
      <div class="chart-panel__yoy"><span class="yoy-value">YoY</span><span class="yoy-percent">{{LEFT_YOY}}</span></div>
    </div>
    <div class="chart-panel"><!-- same structure, id="chart-right" --></div>
  </div>
  <footer class="slide-footer">...</footer>
</section>
```

**Chart.js init** (after CDN scripts):
```javascript
Chart.register(ChartDataLabels);
new Chart(document.getElementById('chart-left'), {
  type: 'bar',
  data: {
    labels: [["1Q","FY24"],"2Q","3Q","4Q",["1Q","FY25"],"2Q","3Q","4Q",["1Q","FY26"]],
    // ↑ IMPORTANT: use arrays for multi-line labels, NOT "1Q\nFY24"
    datasets: [{
      data: [442,481,484,465,449,492,499,485,568],
      backgroundColor: data.map((_,i) => i===data.length-1 ? '#0652DD' : '#B0C4FF'),
      borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.85
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { top: 32, bottom: 8 } },
    plugins: {
      legend: { display: false },
      datalabels: { anchor:'end', align:'top', offset:4, font:{size:14,weight:'bold',family:'system-ui'},
        color: ctx => ctx.dataIndex===ctx.dataset.data.length-1 ? '#0652DD' : '#6B7280' }
    },
    scales: { y:{display:false,beginAtZero:true}, x:{grid:{display:false},ticks:{font:{size:12},color:'#6B7280',maxRotation:0}} }
  }
});
```

## Template Reference: table-comparison

**CSS additions**:
```css
.table-content { display:flex; flex-direction:column; gap:40px; }
.revision-indicator { display:flex; align-items:center; gap:24px; padding:20px 32px; background:var(--color-accent-light); border-radius:12px; border-left:6px solid var(--color-accent); }
.revision-indicator__text { font-size:20px; font-weight:700; color:var(--color-accent); }
.data-table thead th.highlight-col { background:var(--color-accent); }
.data-table .arrow-cell { color:var(--color-text-muted); font-size:24px; padding:20px 16px; }
.change-positive { color:var(--color-primary); font-weight:600; }
.table-supplement { background:var(--color-bg-subtle); border-radius:8px; padding:20px 28px; font-size:16px; line-height:1.7; border-left:4px solid var(--color-primary); }
```

**HTML**: Revision banner → `<table class="data-table">` with 5 columns (label, before, arrow, after, change) → supplement note → footer

## Template Reference: text-review

**CSS additions**:
```css
.review-layout { display:flex; flex-direction:column; gap:40px; }
.review-policy { display:grid; grid-template-columns:200px 1fr; border-radius:12px; overflow:hidden; border:2px solid var(--color-primary); }
.review-policy__label { background:var(--color-primary-light); display:flex; align-items:center; justify-content:center; padding:24px 20px; }
.review-policy__content { background:var(--color-primary); color:white; padding:28px 36px; font-size:17px; line-height:1.9; }
.review-results { display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.result-card { border-left:5px solid var(--color-primary); background:var(--color-bg-subtle); padding:20px 28px; border-radius:0 12px 12px 0; }
.result-card--accent { border-left-color:var(--color-accent); }
.result-card__body .metric { font-size:48px; font-weight:800; color:var(--color-primary); display:block; line-height:1.2; margin-bottom:6px; }
.result-card--accent .result-card__body .metric { color:var(--color-accent); }
.result-card__body .result-desc { font-size:15px; line-height:1.6; }
```

**HTML**: Policy box (label + content) → 4 result cards in 2x2 grid → footer.
Each card: `.result-card__title` (icon + text) → `.metric` (48px number) → `<p class="result-desc">` (description)

## Themes

Override `:root` variables. Available presets:

| Theme | Primary | Accent | Use Case |
|-------|---------|--------|----------|
| Corporate Blue | `#0652DD` | `#FF4757` | IR, corporate (default) |
| Midnight | `#1E2761` | `#F9A825` | Executive, board |
| Forest Green | `#2C5F2D` | `#FF6B35` | ESG, sustainability |
| Teal Trust | `#028090` | `#FF6B6B` | Tech, SaaS |
| Warm Terracotta | `#B85042` | `#A7BEAE` | Brand, design |

## QA

### Automated (12 checks)
Append `?qa=true` to URL or use `node autoresearch.js --baseline`:
- A1: No overflow, A2: No text overlap, A3: Font>=14px, A4: Navigation works
- B1: Padding>=100px, B2: Title gap>=40px, B3: Has visual, B4: No 3x same layout
- C1: KPI>=48px, C3: Data has footnotes, C4: Has page numbers, C5: No literal escapes

### Manual
Always screenshot all slides with Puppeteer and visually verify. Canvas-rendered text (Chart.js labels) cannot be checked by DOM inspection.

## Autoresearch

Trigger: "autoresearchを実行" or "スキルを改善して"

```
node autoresearch.js --baseline     # Score all test inputs
node full-qa.js                     # Per-slide screenshots + detailed QA
```

Process: Build → Score → Identify worst check → ONE change → Re-score → Keep/Revert
Log: `qa/autoresearch-log.json`
