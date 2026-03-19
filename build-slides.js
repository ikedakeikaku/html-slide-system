/**
 * build-slides.js — Build a complete HTML slide deck from a test-input JSON
 *
 * Usage:
 *   node build-slides.js <test-input.json> <output.html>
 *
 * Example:
 *   node build-slides.js .claude/.claude/skills/html-slide/test-inputs/ir-presentation.json output/ir.html
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

// ===== New template generators (16 additional) =====

function generateTitleImage(data, slideIndex) {
  const company = escHtml(data.company || 'Company');
  return `
    <section class="slide slide--title-image${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <div class="title-image-bg"></div>
      <div class="title-image-overlay"></div>
      <div class="title-image-content">
        <div class="title-logo"><svg viewBox="0 0 ${56 + company.length * 22} 40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="8" fill="var(--color-primary)"/><text x="52" y="28" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${company}</text></svg></div>
        <div class="title-image-accent"></div>
        <h1 class="title-image-main">${data.title || ''}</h1>
        <p class="title-image-sub">${escHtml(data.subtitle)}</p>
        <p class="title-image-date">${escHtml(data.date)}</p>
      </div>
    </section>`;
}

function generateTitleMinimal(data, slideIndex) {
  return `
    <section class="slide slide--title slide--title-minimal${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <h1 class="title-minimal-main">${data.title || ''}</h1>
      <div class="title-minimal-accent"></div>
      <p class="title-minimal-sub">${escHtml(data.subtitle)}</p>
      <p class="title-minimal-date">${escHtml(data.date)}</p>
    </section>`;
}

function generateToc(data, slideIndex) {
  const items = (data.items || []).map((item, idx) => `
        <div class="toc-item">
          <div class="toc-item__left"><span class="toc-badge">${idx + 1}</span><span class="toc-item__title">${escHtml(item.title)}</span></div>
          <span class="toc-item__page">P.${escHtml(item.page)}</span>
        </div>`).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <h1 class="slide-title" style="font-size:40px;font-weight:800;margin-bottom:48px;">${escHtml(data.slide_title || '目次')}</h1>
      <div class="toc-list">${items}
      </div>
      <footer class="slide-footer">
        <div class="slide-footer__notes"></div>
        <div class="slide-footer__page">${escHtml(data.page_number || '2')}</div>
      </footer>
    </section>`;
}

function generateSectionDivider(data, slideIndex) {
  return `
    <section class="slide slide--section${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}" style="display:flex;flex-direction:column;justify-content:center;padding:120px 140px;position:absolute;top:0;left:0;">
      <div style="position:absolute;right:80px;top:50%;transform:translateY(-50%);font-size:320px;font-weight:900;color:rgba(6,82,221,0.06);line-height:1;pointer-events:none;">${escHtml(data.section_number || '01')}</div>
      <div style="font-size:14px;font-weight:700;color:var(--color-primary);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">SECTION ${escHtml(data.section_number || '01')}</div>
      <h1 style="font-size:40px;font-weight:800;color:var(--color-text);margin-bottom:16px;">${escHtml(data.slide_title)}</h1>
      <p style="font-size:20px;color:var(--color-text-muted);">${escHtml(data.subtitle || '')}</p>
      <div class="gradient-art"></div>
    </section>`;
}

function generateKpi2col(data, slideIndex) {
  const cards = (data.cards || []).map(c => `
          <div class="kpi-card">
            <div class="kpi-card__header">${escHtml(c.header)}</div>
            <div class="kpi-card__body">
              <span class="kpi-label">${escHtml(c.label)}</span>
              <div class="kpi-value"><span class="kpi-number" style="font-size:72px;">${escHtml(c.number)}</span><span class="kpi-unit">${escHtml(c.unit)}</span></div>
              <span class="kpi-change ${c.change_type || 'positive'}">${escHtml(c.change)}</span>
            </div>
          </div>`).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="kpi-content">
        <div class="kpi-summary"><span class="kpi-summary__label">${escHtml(data.summary_label)}</span><span class="kpi-summary__text">${escHtml(data.summary_text)}</span></div>
        <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);">${cards}</div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateKpiHighlight(data, slideIndex) {
  const items = (data.highlights || []).map(h => `
          <div class="highlight-card" style="text-align:center;flex:1;">
            <span style="font-size:18px;color:var(--color-text-muted);display:block;margin-bottom:16px;">${escHtml(h.label)}</span>
            <span class="highlight-number" style="font-size:96px;font-weight:800;color:var(--color-primary);display:block;line-height:1.1;">${escHtml(h.number)}</span>
            <span style="font-size:24px;color:var(--color-text-muted);display:block;margin:8px 0;">${escHtml(h.unit)}</span>
            <span style="display:inline-block;padding:8px 24px;border:2px solid var(--color-primary);border-radius:999px;font-weight:700;color:var(--color-primary);margin:12px 0;">${escHtml(h.change)}</span>
            <p style="font-size:16px;color:var(--color-text-muted);margin-top:8px;">${escHtml(h.desc || '')}</p>
          </div>`).join('<div style="width:1px;background:var(--color-border);margin:0 40px;"></div>');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="kpi-grid" style="display:flex;align-items:center;justify-content:center;flex:1;padding:40px 0;">${items}</div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateChartBarSingle(data, slideIndex) {
  const chartId = `chart-single-${slideIndex}`;
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="chart-panel"><div class="chart-panel__title">${escHtml(data.chart_title)}</div><div class="chart-panel__subtitle">${escHtml(data.chart_subtitle)}</div>
        <div class="chart-panel__canvas-wrap" style="height:520px;"><canvas id="${chartId}"></canvas></div>
        <div class="chart-panel__yoy" style="text-align:right;margin-top:16px;"><span class="yoy-value">YoY</span><span class="yoy-percent">${escHtml(data.yoy)}</span></div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}
function generateChartBarSingleScript(data, slideIndex) {
  const labels = chartLabelsToJs(data.labels);
  const chartData = JSON.stringify(data.data || []);
  const chartId = `chart-single-${slideIndex}`;
  return `
    (function(){var d=${chartData};new Chart(document.getElementById('${chartId}'),{type:'bar',data:{labels:${labels},datasets:[{data:d,backgroundColor:d.map(function(_,i){return i===d.length-1?'#0652DD':'#B0C4FF'}),borderRadius:4,barPercentage:0.7,categoryPercentage:0.85}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:32,bottom:8}},plugins:{legend:{display:false},datalabels:{anchor:'end',align:'top',offset:4,font:{size:14,weight:'bold',family:'system-ui'},color:function(ctx){return ctx.dataIndex===ctx.dataset.data.length-1?'#0652DD':'#6B7280'}}},scales:{y:{display:false,beginAtZero:true},x:{grid:{display:false},ticks:{font:{size:12},color:'#6B7280',maxRotation:0}}}}});})();`;
}

function generateChartStacked(data, slideIndex) {
  const chartId = `chart-stacked-${slideIndex}`;
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="chart-panel stacked-chart"><div class="chart-panel__title">${escHtml(data.chart_title)}</div><div class="chart-panel__subtitle">${escHtml(data.chart_subtitle)}</div>
        <div class="chart-panel__canvas-wrap" style="height:520px;"><canvas id="${chartId}"></canvas></div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}
function generateChartStackedScript(data, slideIndex) {
  const labels = chartLabelsToJs(data.labels);
  const datasets = (data.datasets || []).map((ds, idx) => {
    const colors = ['#B0C4FF','#6B9AFF','#0652DD','#003BB5','#FF4757'];
    return `{label:'${escHtml(ds.label)}',data:${JSON.stringify(ds.data)},backgroundColor:'${colors[idx]||colors[0]}'}`;
  }).join(',');
  return `
    (function(){new Chart(document.getElementById('chart-stacked-${slideIndex}'),{type:'bar',data:{labels:${labels},datasets:[${datasets}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:8,bottom:8}},plugins:{legend:{position:'top',labels:{font:{size:13,family:'system-ui'}}},datalabels:{display:true,color:'#fff',font:{size:12,weight:'bold'},formatter:function(v){return v+'%';}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,max:100,ticks:{callback:function(v){return v+'%'}}}}}});})();`;
}

function generateChartLine(data, slideIndex) {
  const chartId = `chart-line-${slideIndex}`;
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="chart-panel"><div class="chart-panel__subtitle">${escHtml(data.chart_subtitle)}</div>
        <div class="chart-panel__canvas-wrap" style="height:520px;"><canvas id="${chartId}"></canvas></div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}
function generateChartLineScript(data, slideIndex) {
  const labels = chartLabelsToJs(data.labels);
  const datasets = (data.datasets || []).map(ds =>
    `{label:'${escHtml(ds.label)}',data:${JSON.stringify(ds.data)},borderColor:'${ds.color||'#0652DD'}',backgroundColor:'${ds.bg||'rgba(6,82,221,0.1)'}',tension:0.3,pointRadius:4,fill:${ds.fill||false}}`
  ).join(',');
  return `
    (function(){new Chart(document.getElementById('chart-line-${slideIndex}'),{type:'line',data:{labels:${labels},datasets:[${datasets}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:16,bottom:8}},plugins:{legend:{position:'top',labels:{font:{size:13,family:'system-ui'}}},datalabels:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true}}}});})();`;
}

function generateChartPie(data, slideIndex) {
  const chartId = `chart-pie-${slideIndex}`;
  const legendItems = (data.segments || []).map(s =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--color-border);"><div style="display:flex;align-items:center;gap:12px;"><div style="width:16px;height:16px;border-radius:4px;background:${s.color||'#0652DD'};"></div><div><div style="font-weight:600;font-size:16px;">${escHtml(s.label)}</div><div style="font-size:13px;color:var(--color-text-muted);">${escHtml(s.sub||'')}</div></div></div><div style="font-size:24px;font-weight:800;">${escHtml(s.percent)}</div></div>`
  ).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;">
        <div style="position:relative;"><canvas id="${chartId}" style="max-height:450px;"></canvas>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;"><div style="font-size:48px;font-weight:800;color:var(--color-text);">${escHtml(data.center_value)}</div><div style="font-size:16px;color:var(--color-text-muted);">${escHtml(data.center_label)}</div></div>
        </div>
        <div>${legendItems}</div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}
function generateChartPieScript(data, slideIndex) {
  const colors = ['#B0C4FF','#6B9AFF','#0652DD','#003BB5','#FF4757'];
  const vals = JSON.stringify((data.segments||[]).map(s => s.value));
  const lbls = JSON.stringify((data.segments||[]).map(s => s.label));
  const cols = JSON.stringify((data.segments||[]).map((s,i) => s.color||colors[i]||colors[0]));
  return `
    (function(){new Chart(document.getElementById('chart-pie-${slideIndex}'),{type:'doughnut',data:{labels:${lbls},datasets:[{data:${vals},backgroundColor:${cols},borderWidth:0}]},options:{responsive:true,cutout:'55%',plugins:{legend:{display:false},datalabels:{color:'#fff',font:{size:14,weight:'bold'},formatter:function(v,ctx){var t=ctx.dataset.data.reduce(function(a,b){return a+b},0);return Math.round(v/t*100)+'%';}}}}});})();`;
}

function generateTableData(data, slideIndex) {
  const headers = (data.headers || []).map(h => `<th>${escHtml(h)}</th>`).join('');
  const rows = (data.rows || []).map((row, ri) => {
    const cls = ri === (data.rows||[]).length - 1 ? ' style="font-weight:700;border-top:2px solid var(--color-primary);"' : '';
    const cells = row.map((cell, ci) => {
      const isLabel = ci === 0;
      const highlight = cell.highlight ? ` class="${cell.highlight}"` : '';
      const val = typeof cell === 'object' ? cell.value : cell;
      return isLabel ? `<td class="row-label">${escHtml(val)}</td>` : `<td${highlight}>${escHtml(val)}</td>`;
    }).join('');
    return `<tr${cls}>${cells}</tr>`;
  }).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateText2col(data, slideIndex) {
  function colHtml(col, accent) {
    const hdrCls = accent ? ' accent' : '';
    const items = (col.items || []).map(item =>
      `<div style="border-left:4px solid ${accent?'var(--color-accent)':'var(--color-primary)'};padding:16px 24px;margin-bottom:16px;background:var(--color-bg-subtle);border-radius:0 8px 8px 0;"><div style="font-weight:700;margin-bottom:4px;">${escHtml(item.title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;">${escHtml(item.desc)}</div></div>`
    ).join('');
    return `<div><div class="comparison-header${hdrCls}">${escHtml(col.header)}</div>${items}</div>`;
  }
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="comparison-grid">${colHtml(data.left || {}, false)}${colHtml(data.right || {}, true)}</div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateTextBullet(data, slideIndex) {
  const bullets = (data.bullets || []).map((b, idx) =>
    `<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;"><div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">${idx+1}</div><div><div style="font-weight:700;font-size:17px;margin-bottom:4px;">${escHtml(b.title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;">${escHtml(b.desc)}</div></div></div>`
  ).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="bullet-visual" style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start;">
        <div>${bullets}</div>
        <div style="background:linear-gradient(135deg,var(--color-primary),var(--color-primary-dark));border-radius:16px;padding:48px 40px;color:#fff;text-align:center;">
          <div style="font-size:14px;margin-bottom:8px;opacity:0.8;">${escHtml(data.visual_label || '')}</div>
          <div style="font-size:64px;font-weight:800;line-height:1.1;">${escHtml(data.visual_number || '')}</div>
          <div style="font-size:20px;margin:8px 0;">${escHtml(data.visual_unit || '')}</div>
          <div style="width:60px;height:2px;background:rgba(255,255,255,0.3);margin:16px auto;"></div>
          <div style="font-size:14px;opacity:0.8;">${escHtml(data.visual_desc || '')}</div>
        </div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateFlowDiagram(data, slideIndex) {
  const steps = (data.steps || []).map((step, idx, arr) => {
    const arrow = idx < arr.length - 1 ? '<div style="display:flex;align-items:center;font-size:28px;color:var(--color-primary);padding:0 8px;">&#x2192;</div>' : '';
    const lastCls = idx === arr.length - 1 ? 'var(--color-accent)' : 'var(--color-primary)';
    return `<div style="flex:1;background:var(--color-bg-subtle);border-radius:12px;overflow:hidden;text-align:center;"><div style="background:${lastCls};color:#fff;padding:12px;font-weight:700;font-size:15px;">STEP ${idx+1}</div><div style="padding:20px 16px;"><div style="font-weight:700;font-size:17px;margin-bottom:8px;">${escHtml(step.title)}</div><div style="font-size:14px;color:var(--color-text-muted);line-height:1.5;">${escHtml(step.desc)}</div>${step.metric?`<div style="color:var(--color-primary);font-weight:700;font-size:14px;margin-top:8px;">${escHtml(step.metric)}</div>`:''}</div></div>${arrow}`;
  }).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="flow-diagram" style="display:flex;align-items:stretch;gap:0;margin-top:24px;">${steps}</div>
      ${data.summary ? `<div style="margin-top:40px;padding:20px 28px;background:var(--color-primary-light);border-radius:12px;display:flex;gap:24px;align-items:center;"><span style="font-weight:700;color:var(--color-primary);">ポイント</span><span style="font-size:16px;line-height:1.6;">${escHtml(data.summary)}</span></div>` : ''}
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateTimeline(data, slideIndex) {
  const milestones = (data.milestones || []).map((m, idx) => {
    const active = m.active ? 'var(--color-accent)' : 'var(--color-primary)';
    const status = m.status ? `<span style="display:inline-block;padding:4px 16px;background:${active};color:#fff;border-radius:999px;font-size:13px;font-weight:600;margin-top:8px;">${escHtml(m.status)}</span>` : '';
    return `<div style="flex:1;text-align:center;"><div style="display:inline-block;padding:6px 20px;background:${m.active?'var(--color-accent-light)':'var(--color-primary-light)'};color:${active};border-radius:999px;font-weight:700;font-size:14px;margin-bottom:16px;">${escHtml(m.date)}</div><div style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">PHASE ${idx+1}</div><div style="width:24px;height:24px;border-radius:50%;border:3px solid ${active};margin:0 auto 16px;background:#fff;"></div><div style="background:var(--color-bg-subtle);border-radius:12px;padding:20px 16px;"><div style="font-weight:700;font-size:17px;margin-bottom:8px;">${escHtml(m.title)}</div><div style="font-size:14px;color:var(--color-text-muted);line-height:1.5;">${escHtml(m.desc)}</div>${status}</div></div>`;
  }).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div class="timeline" style="display:flex;gap:24px;align-items:flex-start;margin-top:24px;">${milestones}</div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateClosing(data, slideIndex) {
  const cards = (data.actions || []).map((a, idx) =>
    `<div class="closing-cards" style="background:var(--color-bg-subtle);border-radius:12px;padding:28px;border-top:4px solid var(--color-primary);"><div style="width:40px;height:40px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;margin-bottom:16px;">${idx+1}</div><div style="font-weight:700;font-size:18px;margin-bottom:8px;">${escHtml(a.title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;margin-bottom:12px;">${escHtml(a.desc)}</div>${a.deadline?`<div style="font-size:14px;font-weight:700;color:var(--color-accent);">期限：${escHtml(a.deadline)}</div>`:''}</div>`
  ).join('');
  return `
    <section class="slide slide--closing${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title || 'まとめ・Next Steps')}</h1></div></header>
      <div style="display:grid;grid-template-columns:repeat(${(data.actions||[]).length},1fr);gap:32px;">${cards}</div>
      ${data.thanks ? `<div style="text-align:center;margin-top:auto;padding-top:48px;"><div style="font-size:28px;font-weight:700;color:var(--color-text-muted);">Thank you</div><div style="font-size:16px;color:var(--color-text-muted);margin-top:8px;">${escHtml(data.thanks)}</div></div>` : ''}
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote || '')}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

// ===== Seminar template generators (8 additional) =====

function generateStatement(data, slideIndex) {
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <div class="statement-layout" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;position:relative;">
        <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.15;pointer-events:none;" width="600" height="600" viewBox="0 0 600 600">
          <circle cx="300" cy="300" r="280" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-dasharray="8 12"/>
          <circle cx="300" cy="300" r="200" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-dasharray="4 8"/>
        </svg>
        <div style="width:80px;height:5px;background:var(--color-primary);border-radius:3px;margin-bottom:48px;"></div>
        <h1 style="font-size:80px;font-weight:800;line-height:1.3;max-width:1400px;margin-bottom:40px;">${data.statement || ''}</h1>
        <p style="font-size:24px;color:var(--color-text-muted);line-height:1.6;max-width:900px;">${escHtml(data.subtitle || '')}</p>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote || '')}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateBeforeAfter(data, slideIndex) {
  function items(arr, type) {
    return (arr || []).map(item => {
      var iconCls = type === 'before' ? 'background:var(--color-accent-light);color:var(--color-accent);' : 'background:var(--color-primary-light);color:var(--color-primary);';
      var icon = type === 'before' ? '&#x2717;' : '&#x2713;';
      return `<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;"><div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;${iconCls}">${icon}</div><div><div style="font-weight:700;font-size:18px;margin-bottom:4px;">${escHtml(item.title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;">${escHtml(item.desc)}</div></div></div>`;
    }).join('');
  }
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:grid;grid-template-columns:1fr 80px 1fr;align-items:stretch;">
        <div style="background:var(--color-bg-subtle);border-radius:12px;padding:40px 36px;display:flex;flex-direction:column;">
          <span style="display:inline-flex;align-items:center;justify-content:center;padding:8px 28px;border-radius:999px;font-weight:700;font-size:16px;margin-bottom:28px;align-self:flex-start;background:var(--color-text-muted);color:white;">Before</span>
          ${items(data.before_items, 'before')}
          ${data.before_metric ? `<div style="margin-top:auto;padding-top:24px;border-top:2px solid var(--color-border);text-align:center;"><span style="font-size:48px;font-weight:800;color:var(--color-text-muted);display:block;line-height:1.2;">${escHtml(data.before_metric)}</span><div style="font-size:15px;color:var(--color-text-muted);margin-top:4px;">${escHtml(data.metric_label || '')}</div></div>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 48 48" width="48" height="48" fill="none"><path d="M16 24h16m0 0l-6-6m6 6l-6 6" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div style="background:var(--color-primary-light);border:2px solid var(--color-primary);border-radius:12px;padding:40px 36px;display:flex;flex-direction:column;">
          <span style="display:inline-flex;align-items:center;justify-content:center;padding:8px 28px;border-radius:999px;font-weight:700;font-size:16px;margin-bottom:28px;align-self:flex-start;background:var(--color-primary);color:white;">After</span>
          ${items(data.after_items, 'after')}
          ${data.after_metric ? `<div style="margin-top:auto;padding-top:24px;border-top:2px solid var(--color-border);text-align:center;"><span style="font-size:48px;font-weight:800;color:var(--color-primary);display:block;line-height:1.2;">${escHtml(data.after_metric)}</span><div style="font-size:15px;color:var(--color-text-muted);margin-top:4px;">${escHtml(data.metric_label || '')}</div></div>` : ''}
        </div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateSteps(data, slideIndex) {
  const steps = (data.steps || []).map((step, idx, arr) => {
    const isLast = idx === arr.length - 1;
    const iconColor = isLast ? 'var(--color-accent)' : 'var(--color-primary)';
    const arrow = idx < arr.length - 1 ? `<div style="display:flex;align-items:center;padding-top:28px;"><svg viewBox="0 0 32 32" width="32" height="32" fill="none"><path d="M8 16h16m0 0l-5-5m5 5l-5 5" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>` : '';
    return `<div style="flex:1;text-align:center;"><div style="width:80px;height:80px;border-radius:50%;background:${iconColor};color:white;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;margin:0 auto 24px;position:relative;z-index:2;">${idx+1}</div><div style="font-size:20px;font-weight:700;margin-bottom:12px;">${escHtml(step.title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;padding:0 20px;">${escHtml(step.desc)}</div>${step.detail ? `<div style="margin-top:16px;padding:12px 20px;background:var(--color-bg-subtle);border-radius:8px;margin-left:20px;margin-right:20px;"><div style="font-size:13px;color:var(--color-text-muted);margin-bottom:4px;">${escHtml(step.detail_label||'')}</div><div style="font-size:18px;font-weight:700;color:var(--color-primary);">${escHtml(step.detail)}</div></div>` : ''}</div>${arrow}`;
  }).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:flex;align-items:flex-start;gap:0;margin-top:24px;">${steps}</div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateQuote(data, slideIndex) {
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:40px 80px;">
        <div style="font-size:120px;line-height:1;color:var(--color-primary);opacity:0.2;font-family:Georgia,serif;margin-bottom:8px;">"</div>
        <p style="font-size:32px;font-weight:600;line-height:1.7;text-align:center;max-width:1200px;margin-bottom:40px;">${escHtml(data.quote)}</p>
        <div style="width:60px;height:3px;background:var(--color-primary);border-radius:2px;margin-bottom:32px;"></div>
        <div style="display:flex;align-items:center;gap:20px;">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none"><circle cx="16" cy="12" r="6" fill="var(--color-primary)"/><path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="var(--color-primary)" opacity="0.3"/></svg>
          </div>
          <div style="text-align:left;"><div style="font-size:20px;font-weight:700;">${escHtml(data.source_name)}</div><div style="font-size:16px;color:var(--color-text-muted);margin-top:4px;">${escHtml(data.source_role)}</div></div>
        </div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateImageFull(data, slideIndex) {
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="border-radius:12px;overflow:hidden;height:560px;">
        ${data.image_url ? `<img src="${escHtml(data.image_url)}" style="width:100%;height:100%;object-fit:cover;" alt="${escHtml(data.image_alt||'')}">` :
        `<div style="width:100%;height:100%;background:linear-gradient(135deg,#E8EEFF 0%,#F0F4FF 30%,#E8EEFF 60%,#D6E2FF 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
          <svg viewBox="0 0 80 80" width="80" height="80" fill="none"><rect x="4" y="12" width="72" height="52" rx="4" stroke="var(--color-primary)" stroke-width="2.5"/><circle cx="28" cy="32" r="8" fill="var(--color-primary)" opacity="0.3"/><path d="M4 52l20-16 12 10 16-20 24 26" stroke="var(--color-primary)" stroke-width="2" fill="none"/></svg>
          <span style="font-size:16px;color:var(--color-text-muted);opacity:0.6;">${escHtml(data.placeholder_text || '画像をここに配置')}</span>
        </div>`}
      </div>
      <div style="display:flex;align-items:flex-start;gap:24px;margin-top:20px;padding:20px 28px;background:var(--color-bg-subtle);border-radius:8px;border-left:4px solid var(--color-primary);">
        <div><div style="font-size:18px;font-weight:700;margin-bottom:4px;">${escHtml(data.caption_title)}</div><div style="font-size:15px;color:var(--color-text-muted);line-height:1.6;">${escHtml(data.caption_text)}</div></div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateQuestion(data, slideIndex) {
  const stats = (data.stats || []).map(s =>
    `<div style="text-align:center;"><span style="font-size:48px;font-weight:800;color:var(--color-accent);display:block;line-height:1.1;">${escHtml(s.number)}</span><div style="font-size:15px;color:var(--color-text-muted);margin-top:8px;">${escHtml(s.label)}</div></div>`
  ).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;position:relative;">
        <div style="margin-bottom:32px;">
          <svg viewBox="0 0 80 80" width="80" height="80" fill="none"><circle cx="40" cy="40" r="36" fill="var(--color-primary-light)" stroke="var(--color-primary)" stroke-width="2"/><text x="40" y="52" text-anchor="middle" font-size="40" font-weight="800" fill="var(--color-primary)" font-family="system-ui">?</text></svg>
        </div>
        <h1 style="font-size:52px;font-weight:800;line-height:1.4;max-width:1200px;margin-bottom:40px;">${data.question || ''}</h1>
        <p style="font-size:20px;color:var(--color-text-muted);line-height:1.7;max-width:900px;">${escHtml(data.context || '')}</p>
        ${stats ? `<div style="display:flex;gap:64px;margin-top:48px;">${stats}</div>` : ''}
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateChecklist(data, slideIndex) {
  const items = (data.items || []).map(item => {
    const done = item.done;
    const borderColor = done ? '#22C55E' : 'var(--color-primary)';
    const check = done
      ? `<div style="width:32px;height:32px;border-radius:6px;background:#22C55E;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 18 18" width="18" height="18" fill="none"><path d="M4 9l3.5 3.5L14 5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
      : `<div style="width:32px;height:32px;border-radius:6px;background:white;border:2px solid var(--color-border);flex-shrink:0;"></div>`;
    return `<div style="display:flex;align-items:flex-start;gap:16px;padding:20px 24px;background:var(--color-bg-subtle);border-radius:8px;border-left:4px solid ${borderColor};">${check}<div><div style="font-size:18px;font-weight:700;margin-bottom:4px;">${escHtml(item.title)}</div><div style="font-size:14px;color:var(--color-text-muted);line-height:1.5;">${escHtml(item.desc)}</div></div></div>`;
  }).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 48px;">${items}</div>
      ${data.summary ? `<div style="margin-top:32px;padding:20px 28px;background:var(--color-primary-light);border-radius:12px;display:flex;align-items:center;gap:24px;"><svg viewBox="0 0 40 40" width="40" height="40" fill="none"><circle cx="20" cy="20" r="18" fill="var(--color-primary)" opacity="0.15"/><path d="M14 20l4 4 8-8" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div style="font-size:17px;line-height:1.6;">${escHtml(data.summary)}</div></div>` : ''}
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote)}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

function generateCta(data, slideIndex) {
  const contacts = (data.contacts || []).map(c =>
    `<div style="display:flex;align-items:center;gap:16px;padding:16px 24px;background:var(--color-bg-subtle);border-radius:8px;"><div style="width:44px;height:44px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 22 22" width="22" height="22" fill="none"><circle cx="11" cy="11" r="9" stroke="var(--color-primary)" stroke-width="1.8"/></svg></div><div><div style="font-size:14px;color:var(--color-text-muted);">${escHtml(c.label)}</div><div style="font-size:20px;font-weight:700;color:var(--color-primary);">${escHtml(c.value)}</div></div></div>`
  ).join('');
  return `
    <section class="slide${slideIndex === 0 ? ' active' : ''}" id="slide-${slideIndex + 1}">
      <header class="slide-header"><div class="slide-header__left"><span class="section-badge">${escHtml(data.section_number)}</span><h1 class="slide-title">${escHtml(data.slide_title)}</h1></div></header>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;">
        <div style="display:flex;flex-direction:column;gap:32px;">
          <p style="font-size:28px;font-weight:700;line-height:1.5;">${escHtml(data.message)}</p>
          <div style="display:flex;flex-direction:column;gap:20px;">${contacts}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:24px;">
          <div style="width:280px;height:280px;background:white;border:2px solid var(--color-border);border-radius:12px;display:flex;align-items:center;justify-content:center;padding:20px;">
            <svg viewBox="0 0 200 200" width="200" height="200" fill="var(--color-text)"><rect x="20" y="20" width="60" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><rect x="36" y="36" width="28" height="28" rx="2"/><rect x="120" y="20" width="60" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><rect x="136" y="36" width="28" height="28" rx="2"/><rect x="20" y="120" width="60" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><rect x="36" y="136" width="28" height="28" rx="2"/><rect x="90" y="90" width="20" height="20" rx="2"/><rect x="120" y="120" width="16" height="16" rx="1"/><rect x="148" y="120" width="16" height="16" rx="1"/><rect x="120" y="148" width="16" height="16" rx="1"/><rect x="148" y="148" width="16" height="16" rx="1"/></svg>
          </div>
          <div style="font-size:16px;color:var(--color-text-muted);text-align:center;">${escHtml(data.qr_label || 'QRコードから資料ダウンロード')}</div>
          ${data.url ? `<div style="display:inline-block;padding:14px 36px;background:var(--color-primary);color:white;border-radius:999px;font-size:20px;font-weight:700;">${escHtml(data.url)}</div>` : ''}
        </div>
      </div>
      <footer class="slide-footer"><div class="slide-footer__notes"><p>${escHtml(data.footnote || '')}</p></div><div class="slide-footer__page">${escHtml(data.page_number)}</div></footer>
    </section>`;
}

// ===== Template dispatcher =====
const generators = {
  'title-gradient': generateTitleGradient,
  'title-image': generateTitleImage,
  'title-minimal': generateTitleMinimal,
  'toc': generateToc,
  'section-divider': generateSectionDivider,
  'kpi-3col': generateKpi3col,
  'kpi-2col': generateKpi2col,
  'kpi-highlight': generateKpiHighlight,
  'chart-bar-dual': generateChartBarDual,
  'chart-bar-single': generateChartBarSingle,
  'chart-stacked': generateChartStacked,
  'chart-line': generateChartLine,
  'chart-pie': generateChartPie,
  'table-comparison': generateTableComparison,
  'table-data': generateTableData,
  'text-review': generateTextReview,
  'text-2col': generateText2col,
  'text-bullet': generateTextBullet,
  'flow-diagram': generateFlowDiagram,
  'timeline': generateTimeline,
  'closing': generateClosing,
  'statement': generateStatement,
  'before-after': generateBeforeAfter,
  'steps': generateSteps,
  'quote': generateQuote,
  'image-full': generateImageFull,
  'question': generateQuestion,
  'checklist': generateChecklist,
  'cta': generateCta,
};

const chartTemplates = {
  'chart-bar-dual': generateChartScript,
  'chart-bar-single': generateChartBarSingleScript,
  'chart-stacked': generateChartStackedScript,
  'chart-line': generateChartLineScript,
  'chart-pie': generateChartPieScript,
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

  const chartGen = chartTemplates[slide.template];
  if (chartGen) {
    hasCharts = true;
    chartScripts += chartGen(slide.data, i);
  }
});

// ===== Read design-system CSS =====
const designCSS = fs.readFileSync(
  path.join(__dirname, '.claude/skills/html-slide/design-system.css'), 'utf8'
);

// ===== Read navigation JS =====
const navJS = fs.readFileSync(
  path.join(__dirname, '.claude/skills/html-slide/navigation.js'), 'utf8'
);

// ===== Read QA runner JS =====
const qaRunnerJS = fs.readFileSync(
  path.join(__dirname, '.claude/skills/html-slide/qa/qa-runner.js'), 'utf8'
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

    /* ===== Title Image ===== */
    .slide--title-image { padding: 0 !important; position: relative; }
    .title-image-bg { position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(6,82,221,0.03) 0px,rgba(6,82,221,0.03) 2px,transparent 2px,transparent 12px),linear-gradient(135deg,#0a1628 0%,#1a2744 50%,#0d1f3c 100%); }
    .title-image-overlay { position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,22,40,0.95) 0%,rgba(10,22,40,0.7) 60%,rgba(10,22,40,0.3) 100%); }
    .title-image-content { position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;padding:120px 140px;height:100%; }
    .title-image-content .title-logo { margin-bottom:auto; }
    .title-image-accent { width:80px;height:4px;background:var(--color-primary);margin-bottom:24px; }
    .title-image-main { font-size:48px;font-weight:800;color:#fff;line-height:1.35;max-width:900px;margin-bottom:16px; }
    .title-image-sub { font-size:20px;color:rgba(255,255,255,0.7);max-width:700px; }
    .title-image-date { font-size:16px;color:rgba(255,255,255,0.5);margin-top:32px; }

    /* ===== Title Minimal ===== */
    .slide--title-minimal { display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center; }
    .title-minimal-main { font-size:56px;font-weight:800;line-height:1.35;margin-bottom:24px; }
    .title-minimal-accent { width:80px;height:4px;background:var(--color-primary);margin-bottom:32px; }
    .title-minimal-sub { font-size:24px;color:var(--color-text-muted); }
    .title-minimal-date { font-size:18px;color:var(--color-text-muted);margin-top:32px; }

    /* ===== TOC ===== */
    .toc-list { display:flex;flex-direction:column;gap:32px;padding:0 40px; }
    .toc-item { display:flex;justify-content:space-between;align-items:center; }
    .toc-item__left { display:flex;align-items:center;gap:20px; }
    .toc-badge { display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:var(--color-primary);color:#fff;font-weight:700;font-size:20px;border-radius:8px; }
    .toc-item__title { font-size:24px;font-weight:600; }
    .toc-item__page { font-size:16px;color:var(--color-text-muted); }

    /* ===== Section Divider ===== */
    .slide--section { overflow:hidden; }
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
