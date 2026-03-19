/**
 * build-slides.js — Build a complete HTML slide deck from a test-input JSON
 *
 * Usage:
 *   node build-slides.js <test-input.json> <output.html>
 *
 * Example:
 *   node build-slides.js skills/html-slide/test-inputs/ir-presentation.json output/ir.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node build-slides.js <input.json> <output.html>');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ===== Template snippet generators =====

function generateTitleGradient(data, slideIndex) {
  const company = escHtml(data.company || 'Company');
  const svgWidth = 56 + company.length * 22;
  return `
    <section class="slide slide--title${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <div class="title-logo">
        <svg viewBox="0 0 ${svgWidth} 40" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="var(--color-primary)"/>
          <text x="52" y="28" font-family="system-ui" font-size="20" font-weight="700" fill="#1A1A1A">${company}</text>
        </svg>
      </div>
      <h1 class="title-main">${data.title}</h1>
      <p class="title-sub">${escHtml(data.subtitle)}</p>
      <p class="title-date">${escHtml(data.date)}</p>
      <div class="gradient-art"></div>
    </section>`;
}

function generateKpi3col(data, slideIndex) {
  const cards = (data.cards || []).map(c => `
          <div class="kpi-card">
            <div class="kpi-card__header">${escHtml(c.header)}</div>
            <div class="kpi-card__body">
              <span class="kpi-label">${escHtml(c.label)}</span>
              <div class="kpi-value">
                <span class="kpi-number">${escHtml(c.number)}</span>
                <span class="kpi-unit">${escHtml(c.unit)}</span>
              </div>
              <span class="kpi-change ${c.change_type || 'positive'}">${escHtml(c.change)}</span>
            </div>
          </div>`).join('');

  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header">
        <div class="slide-header__left">
          <span class="section-badge">${escHtml(data.section_number)}</span>
          <h1 class="slide-title">${escHtml(data.slide_title)}</h1>
        </div>
      </header>
      <div class="kpi-content">
        <div class="kpi-summary">
          <span class="kpi-summary__label">${escHtml(data.summary_label)}</span>
          <span class="kpi-summary__text">${escHtml(data.summary_text)}</span>
        </div>
        <div class="kpi-grid">${cards}
        </div>
      </div>
      <footer class="slide-footer">
        <div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div>
        <div class="slide-footer__page">${escHtml(data.page_number)}</div>
      </footer>
    </section>`;
}

function generateChartBarDual(data, slideIndex) {
  const leftLabels = JSON.stringify(data.left_labels || []);
  const leftData = JSON.stringify(data.left_data || []);
  const rightLabels = JSON.stringify(data.right_labels || []);
  const rightData = JSON.stringify(data.right_data || []);
  const chartId = `chart-${slideIndex}`;

  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header">
        <div class="slide-header__left">
          <span class="section-badge">${escHtml(data.section_number)}</span>
          <h1 class="slide-title">${escHtml(data.slide_title)}</h1>
        </div>
      </header>
      <div class="chart-grid-2col">
        <div class="chart-panel">
          <div class="chart-panel__title">${escHtml(data.left_title)}</div>
          <div class="chart-panel__subtitle">${escHtml(data.left_subtitle)}</div>
          <div class="chart-panel__canvas-wrap">
            <canvas id="${chartId}-left"></canvas>
          </div>
          <div class="chart-panel__yoy">
            <span class="yoy-value">YoY</span>
            <span class="yoy-percent">${escHtml(data.left_yoy)}</span>
          </div>
        </div>
        <div class="chart-panel">
          <div class="chart-panel__title">${escHtml(data.right_title)}</div>
          <div class="chart-panel__subtitle">${escHtml(data.right_subtitle)}</div>
          <div class="chart-panel__canvas-wrap">
            <canvas id="${chartId}-right"></canvas>
          </div>
          <div class="chart-panel__yoy">
            <span class="yoy-value">YoY</span>
            <span class="yoy-percent">${escHtml(data.right_yoy)}</span>
          </div>
        </div>
      </div>
      <footer class="slide-footer">
        <div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div>
        <div class="slide-footer__page">${escHtml(data.page_number)}</div>
      </footer>
    </section>`;
}

function chartLabelsToJs(labels) {
  // Chart.js uses array labels for multi-line: ["1Q","FY24"] renders as 2 lines
  // Convert "1Q\\nFY24" → ["1Q","FY24"], keep simple labels as strings
  const processed = (labels || []).map(function(lbl) {
    if (typeof lbl === 'string' && lbl.includes('\\n')) {
      return lbl.split('\\n');
    }
    return lbl;
  });
  return JSON.stringify(processed);
}

function generateChartScript(data, slideIndex) {
  const leftLabels = chartLabelsToJs(data.left_labels);
  const leftData = JSON.stringify(data.left_data || []);
  const rightLabels = chartLabelsToJs(data.right_labels);
  const rightData = JSON.stringify(data.right_data || []);
  const chartId = `chart-${slideIndex}`;

  return `
    (function() {
      var lLabels = ${leftLabels};
      var lData = ${leftData};
      var rLabels = ${rightLabels};
      var rData = ${rightData};
      var lastL = lData.length - 1;
      var lastR = rData.length - 1;
      function mkColors(data, lastIdx) {
        return data.map(function(_, i) { return i === lastIdx ? '#0652DD' : '#B0C4FF'; });
      }
      var opts = {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 32, bottom: 8, left: 4, right: 4 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end', align: 'top', offset: 4,
            font: { size: 14, weight: 'bold', family: 'system-ui' },
            color: function(ctx) { return ctx.dataIndex === ctx.dataset.data.length - 1 ? '#0652DD' : '#6B7280'; }
          }
        },
        scales: {
          y: { display: false, beginAtZero: true },
          x: { grid: { display: false }, ticks: { font: { size: 12, family: 'system-ui' }, color: '#6B7280', maxRotation: 0 } }
        }
      };
      new Chart(document.getElementById('${chartId}-left'), {
        type: 'bar',
        data: { labels: lLabels, datasets: [{ data: lData, backgroundColor: mkColors(lData, lastL), borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.85 }] },
        options: opts
      });
      new Chart(document.getElementById('${chartId}-right'), {
        type: 'bar',
        data: { labels: rLabels, datasets: [{ data: rData, backgroundColor: mkColors(rData, lastR), borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.85 }] },
        options: opts
      });
    })();`;
}

function generateTableComparison(data, slideIndex) {
  const rows = (data.rows || []).map(r => `
            <tr>
              <td class="row-label">${escHtml(r.label)}</td>
              <td>${escHtml(r.before)}</td>
              <td class="arrow-cell">&#x2192;</td>
              <td class="highlight"><strong>${escHtml(r.after)}</strong></td>
              <td class="change-positive">${escHtml(r.change)}</td>
            </tr>`).join('');

  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header">
        <div class="slide-header__left">
          <span class="section-badge">${escHtml(data.section_number)}</span>
          <h1 class="slide-title">${escHtml(data.slide_title)}</h1>
        </div>
      </header>
      <div class="table-content">
        <div class="revision-indicator">
          <span class="revision-indicator__icon">&#x25B2;</span>
          <span class="revision-indicator__text">${escHtml(data.revision_text)}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th></th>
              <th>期初の業績予想</th>
              <th class="arrow-cell"></th>
              <th class="highlight-col">変更後の業績予想</th>
              <th>変動</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
        <div class="table-supplement">${escHtml(data.supplement)}</div>
      </div>
      <footer class="slide-footer">
        <div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div>
        <div class="slide-footer__page">${escHtml(data.page_number)}</div>
      </footer>
    </section>`;
}

function generateTextReview(data, slideIndex) {
  const policyItems = (data.policy_items || []).map(p =>
    `              <li>${escHtml(p)}</li>`).join('\n');

  const resultCards = (data.results || []).map(r => {
    const accentClass = r.accent ? ' result-card--accent' : '';
    return `
          <div class="result-card${accentClass}">
            <div class="result-card__title">
              <span class="result-card__title-icon">${escHtml(r.icon)}</span>
              ${escHtml(r.title)}
            </div>
            <div class="result-card__body">
              <span class="metric">${escHtml(r.metric)}</span>
              <p class="result-desc">${escHtml(r.desc)}</p>
            </div>
          </div>`;
  }).join('');

  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header">
        <div class="slide-header__left">
          <span class="section-badge">${escHtml(data.section_number)}</span>
          <h1 class="slide-title">${escHtml(data.slide_title)}</h1>
        </div>
      </header>
      <div class="review-layout">
        <div class="review-policy">
          <div class="review-policy__label">
            <span class="review-policy__label-text">期初の<br>事業方針</span>
          </div>
          <div class="review-policy__content">
            <ul>
${policyItems}
            </ul>
          </div>
        </div>
        <div class="review-results">${resultCards}
        </div>
      </div>
      <footer class="slide-footer">
        <div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div>
        <div class="slide-footer__page">${escHtml(data.page_number)}</div>
      </footer>
    </section>`;
}

// ===== Template dispatcher =====
const generators = {
  'title-gradient': generateTitleGradient,
  'kpi-3col': generateKpi3col,
  'chart-bar-dual': generateChartBarDual,
  'table-comparison': generateTableComparison,
  'text-review': generateTextReview,
};

// ===== Build slides =====
let slideSections = '';
let chartScripts = '';
let hasCharts = false;

input.slides.forEach(function(slide, i) {
  const gen = generators[slide.template];
  if (!gen) {
    console.error('Unknown template: ' + slide.template);
    process.exit(1);
  }
  slideSections += gen(slide.data, i);

  if (slide.template === 'chart-bar-dual') {
    hasCharts = true;
    chartScripts += generateChartScript(slide.data, i);
  }
});

// ===== Read design-system CSS =====
const designCSS = fs.readFileSync(
  path.join(__dirname, 'skills/html-slide/design-system.css'), 'utf8'
);

// ===== Read navigation JS =====
const navJS = fs.readFileSync(
  path.join(__dirname, 'skills/html-slide/navigation.js'), 'utf8'
);

// ===== Read QA runner JS =====
const qaRunnerJS = fs.readFileSync(
  path.join(__dirname, 'skills/html-slide/qa/qa-runner.js'), 'utf8'
);

// ===== Additional CSS for templates not fully in design-system.css =====
const additionalCSS = `
    /* ===== Title Slide ===== */
    .slide--title {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 120px 140px;
    }
    .title-logo {
      position: absolute;
      top: 48px;
      left: 140px;
      height: 40px;
    }
    .title-logo svg { height: 40px; width: auto; }
    .title-main {
      font-family: var(--font-heading);
      font-size: 56px;
      font-weight: 800;
      color: var(--color-text);
      line-height: 1.35;
      margin-bottom: var(--space-md);
      max-width: 960px;
    }
    .title-sub {
      font-family: var(--font-body);
      font-size: 24px;
      font-weight: 400;
      color: var(--color-text-muted);
      line-height: 1.6;
      max-width: 800px;
    }
    .title-date {
      font-family: var(--font-body);
      font-size: 18px;
      font-weight: 400;
      color: var(--color-text-muted);
      margin-top: var(--space-lg);
    }

    /* ===== KPI Content ===== */
    .kpi-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .kpi-summary {
      background: var(--color-primary-light);
      border-radius: var(--radius-lg);
      padding: 24px 36px;
      margin-bottom: var(--space-lg);
      display: flex;
      align-items: center;
      gap: var(--space-lg);
    }
    .kpi-summary__label {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-primary);
      white-space: nowrap;
    }
    .kpi-summary__text {
      font-size: 17px;
      line-height: 1.6;
      color: var(--color-text);
    }

    /* ===== Chart layout ===== */
    .chart-panel__canvas-wrap {
      position: relative;
      width: 100%;
      height: 480px;
    }
    .chart-panel__canvas-wrap canvas {
      width: 100% !important;
      height: 100% !important;
    }

    /* ===== Table layout ===== */
    .table-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }
    .revision-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: 20px 32px;
      background: var(--color-accent-light);
      border-radius: var(--radius-lg);
      border-left: 6px solid var(--color-accent);
    }
    .revision-indicator__icon { font-size: 28px; flex-shrink: 0; }
    .revision-indicator__text {
      font-size: 20px;
      font-weight: 700;
      color: var(--color-accent);
    }
    .data-table thead th.highlight-col { background: var(--color-accent); }
    .data-table .arrow-cell {
      color: var(--color-text-muted);
      font-size: 24px;
      padding: 20px 16px;
    }
    .change-positive { color: var(--color-primary); font-weight: 600; }
    .table-supplement {
      background: var(--color-bg-subtle);
      border-radius: var(--radius-md);
      padding: 20px 28px;
      font-size: 16px;
      line-height: 1.7;
      color: var(--color-text);
      border-left: 4px solid var(--color-primary);
    }

    /* ===== Review layout ===== */
    .review-layout {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }
    .review-policy {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 0;
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 2px solid var(--color-primary);
    }
    .review-policy__label {
      background: var(--color-primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 20px;
    }
    .review-policy__label-text {
      display: inline-block;
      padding: 8px 24px;
      background: white;
      border: 2px solid var(--color-primary);
      border-radius: var(--radius-pill);
      font-weight: 700;
      font-size: 15px;
      color: var(--color-primary);
      text-align: center;
      white-space: nowrap;
    }
    .review-policy__content {
      background: var(--color-primary);
      color: white;
      padding: 28px 36px;
      font-size: 17px;
      line-height: 1.9;
    }
    .review-policy__content ul { list-style: none; padding: 0; }
    .review-policy__content li {
      padding-left: 1.2em;
      position: relative;
      margin-bottom: 8px;
    }
    .review-policy__content li::before {
      content: "\\2022";
      position: absolute;
      left: 0;
      color: rgba(255,255,255,0.6);
    }
    .review-results {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-lg);
    }
    .result-card {
      border-left: 5px solid var(--color-primary);
      background: var(--color-bg-subtle);
      padding: 20px 28px;
      border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    }
    .result-card--accent { border-left-color: var(--color-accent); }
    .result-card__title {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-primary);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .result-card--accent .result-card__title { color: var(--color-accent); }
    .result-card__title-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-primary);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .result-card--accent .result-card__title-icon { background: var(--color-accent); }
    .result-card__body .metric {
      font-size: 48px;
      font-weight: 800;
      color: var(--color-primary);
      display: block;
      line-height: 1.2;
      margin-bottom: 6px;
    }
    .result-card--accent .result-card__body .metric { color: var(--color-accent); }
    .result-card__body .result-desc {
      font-size: 15px;
      line-height: 1.6;
      color: var(--color-text);
    }
`;

// ===== Assemble full HTML =====
const chartCDN = hasCharts ? `
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>` : '';

const chartInit = hasCharts ? `
  <script>
    Chart.register(ChartDataLabels);
    ${chartScripts}
  <\/script>` : '';

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(input.title)}</title>
  <style>
${designCSS}
${additionalCSS}
  </style>
</head>
<body>
  <nav class="slide-nav">
    <span class="slide-counter"><span id="current">1</span> / <span id="total">${input.slides.length}</span></span>
    <button onclick="prevSlide()" aria-label="Previous">&#8249;</button>
    <button onclick="nextSlide()" aria-label="Next">&#8250;</button>
    <button onclick="toggleFullscreen()" aria-label="Fullscreen">&#x26F6;</button>
  </nav>
  <div class="progress-bar"><div class="progress-bar__fill" id="progress"></div></div>

  <div class="slides-container">
${slideSections}
  </div>
${chartCDN}
${chartInit}
  <script>
${navJS}
  </script>
  <script>
${qaRunnerJS}
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Built: ${outputPath} (${input.slides.length} slides)`);

// ===== Helpers =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
