const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TEMPLATES = [
  'title-gradient.html',
  'kpi-3col.html',
  'chart-bar-dual.html',
  'table-comparison.html',
  'text-review.html',
];

const TEMPLATE_DIR = path.join(__dirname, '.claude/skills/html-slide/templates');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const tpl of TEMPLATES) {
    const filePath = path.join(TEMPLATE_DIR, tpl);
    const name = tpl.replace('.html', '');
    console.log(`\n=== ${name} ===`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const fileUrl = 'file://' + filePath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 }).catch(async () => {
      // Chart.js CDN may fail in file:// mode, retry with longer wait
      await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));
    });

    // Wait for any Chart.js rendering
    await new Promise(r => setTimeout(r, 1000));

    const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
    console.log(`  Screenshot: ${screenshotPath}`);

    // Run QA checks inline
    const qaResult = await page.evaluate(() => {
      const results = [];
      const slides = document.querySelectorAll('.slide');

      slides.forEach((slide, i) => {
        slide.classList.add('active');
        slide.offsetHeight; // force layout

        // A1: overflow
        const slideRect = slide.getBoundingClientRect();
        let overflow = false;
        const overflowEls = [];
        slide.querySelectorAll('*').forEach(el => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
          if (el.classList.contains('gradient-art')) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.right > slideRect.right + 5 || r.bottom > slideRect.bottom + 5 ||
              r.left < slideRect.left - 5 || r.top < slideRect.top - 5) {
            overflow = true;
            overflowEls.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0]);
          }
        });
        results.push({ slide: i+1, check: 'A1_no_overflow', pass: !overflow,
          detail: overflow ? overflowEls.slice(0,3).join(', ') : '' });

        // A2: text overlap
        const textEls = slide.querySelectorAll('h1,h2,h3,h4,p,span,td,th,li,div');
        const leafRects = [];
        textEls.forEach(el => {
          if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
          if (el.textContent.trim().length === 0) return;
          if (el.children.length > 0) {
            let hasText = false;
            el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) hasText = true; });
            if (!hasText) return;
          }
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) leafRects.push({ rect: r, tag: el.tagName, el: el });
        });
        let hasOverlap = false;
        for (let a = 0; a < leafRects.length && !hasOverlap; a++) {
          for (let b = a+1; b < leafRects.length && !hasOverlap; b++) {
            // Skip parent-child pairs
            if (leafRects[a].el.contains(leafRects[b].el) ||
                leafRects[b].el.contains(leafRects[a].el)) continue;
            const ra = leafRects[a].rect, rb = leafRects[b].rect;
            if (!(ra.right < rb.left+2 || ra.left > rb.right-2 || ra.bottom < rb.top+2 || ra.top > rb.bottom-2)) {
              hasOverlap = true;
            }
          }
        }
        results.push({ slide: i+1, check: 'A2_no_text_overlap', pass: !hasOverlap });

        // B1: padding >= 100px
        const cs = getComputedStyle(slide);
        const pl = parseFloat(cs.paddingLeft);
        const pr = parseFloat(cs.paddingRight);
        results.push({ slide: i+1, check: 'B1_padding_100px', pass: pl >= 100 && pr >= 100,
          detail: `L:${pl}px R:${pr}px` });

        // B3: has visual
        const hasVisual = !!slide.querySelector(
          'img, svg, canvas, .kpi-card, .kpi-grid, table, .data-table, .gradient-art, ' +
          '.review-results, .result-card, .revision-indicator, .chart-grid-2col'
        );
        const isTitle = slide.classList.contains('slide--title');
        results.push({ slide: i+1, check: 'B3_has_visual', pass: hasVisual || isTitle });

        // C1: KPI font >= 48px
        const kpis = slide.querySelectorAll('.kpi-number, .metric');
        let kpiOk = true;
        kpis.forEach(el => { if (parseFloat(getComputedStyle(el).fontSize) < 48) kpiOk = false; });
        results.push({ slide: i+1, check: 'C1_kpi_font_48px',
          pass: kpis.length === 0 || kpiOk });
      });

      const total = results.length;
      const passed = results.filter(r => r.pass).length;
      return { score: Math.round(passed/total*100), total, passed, results,
               failed: results.filter(r => !r.pass) };
    });

    console.log(`  QA Score: ${qaResult.score}% (${qaResult.passed}/${qaResult.total})`);
    if (qaResult.failed.length > 0) {
      qaResult.failed.forEach(f => {
        console.log(`  FAIL: Slide ${f.slide} — ${f.check} ${f.detail || ''}`);
      });
    } else {
      console.log(`  All checks PASSED`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n=== Done ===');
})();
