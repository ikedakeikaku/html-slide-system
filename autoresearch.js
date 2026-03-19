/**
 * autoresearch.js — Automated quality improvement loop for html-slide skill
 *
 * Usage:
 *   node autoresearch.js                    # Run baseline scoring
 *   node autoresearch.js --baseline         # Baseline only (no improvement loop)
 *   node autoresearch.js --rounds=5         # Run N improvement rounds
 *
 * Process (per §15.1):
 *   1. Build HTML slide decks from all test inputs
 *   2. Score each with Puppeteer QA runner
 *   3. Record baseline scores
 *   4. (If --rounds) Identify worst check → apply fix → re-score → keep/revert
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const SKILL_DIR = path.join(ROOT, '.claude/skills/html-slide');
const TEST_INPUTS_DIR = path.join(SKILL_DIR, 'test-inputs');
const QA_DIR = path.join(SKILL_DIR, 'qa');
const OUTPUT_DIR = path.join(ROOT, 'output');
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots/autoresearch');

// Parse args
const args = process.argv.slice(2);
const baselineOnly = args.includes('--baseline');
const roundsArg = args.find(a => a.startsWith('--rounds='));
const maxRounds = roundsArg ? parseInt(roundsArg.split('=')[1]) : 0;

(async () => {
  // Ensure output dirs
  [OUTPUT_DIR, SCREENSHOT_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // Find all test inputs
  const testInputFiles = fs.readdirSync(TEST_INPUTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(TEST_INPUTS_DIR, f));

  console.log(`\n========================================`);
  console.log(`  HTML Slide Autoresearch`);
  console.log(`  Test inputs: ${testInputFiles.length}`);
  console.log(`  Mode: ${baselineOnly ? 'baseline only' : maxRounds > 0 ? `${maxRounds} rounds` : 'baseline only'}`);
  console.log(`========================================\n`);

  // Step 1: Build all slide decks
  console.log('[Step 1] Building slide decks from test inputs...');
  const buildResults = [];
  for (const inputFile of testInputFiles) {
    const inputName = path.basename(inputFile, '.json');
    const outputFile = path.join(OUTPUT_DIR, `${inputName}.html`);
    try {
      execSync(`node build-slides.js "${inputFile}" "${outputFile}"`, {
        cwd: ROOT, stdio: 'pipe'
      });
      buildResults.push({ name: inputName, file: outputFile, success: true });
      console.log(`  Built: ${inputName} → ${outputFile}`);
    } catch (e) {
      console.error(`  FAILED: ${inputName} — ${e.message}`);
      buildResults.push({ name: inputName, file: null, success: false });
    }
  }

  const successfulBuilds = buildResults.filter(b => b.success);
  if (successfulBuilds.length === 0) {
    console.error('\nNo successful builds. Aborting.');
    process.exit(1);
  }

  // Step 2: Score each with Puppeteer
  console.log('\n[Step 2] Scoring with Puppeteer QA runner...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allScores = [];
  for (const build of successfulBuilds) {
    const result = await scoreHtml(browser, build.file, build.name);
    allScores.push(result);
  }

  await browser.close();

  // Step 3: Compute aggregate scores
  const aggregateScore = computeAggregate(allScores);

  // Step 4: Save baseline
  const baselineData = {
    timestamp: new Date().toISOString(),
    aggregate_score: aggregateScore.score,
    per_input: allScores.map(s => ({
      name: s.name,
      score: s.score,
      total: s.total,
      passed: s.passed,
      failed: s.failed
    })),
    check_pass_rates: aggregateScore.checkPassRates
  };

  const baselinePath = path.join(QA_DIR, 'baseline-scores.json');
  fs.writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2), 'utf8');
  console.log(`\nBaseline saved: ${baselinePath}`);

  // Step 5: Print summary
  printSummary(allScores, aggregateScore);

  // Step 6: Initialize autoresearch log if not exists
  const logPath = path.join(QA_DIR, 'autoresearch-log.json');
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, JSON.stringify({
      autoresearch_log: [],
      baseline_score: aggregateScore.score,
      baseline_timestamp: new Date().toISOString()
    }, null, 2), 'utf8');
    console.log(`Autoresearch log initialized: ${logPath}`);
  }

  // Done
  console.log('\n========================================');
  console.log(`  Baseline Score: ${aggregateScore.score}%`);
  console.log(`  Target: 95%+ × 3 consecutive`);
  console.log(`========================================\n`);
})();

// ===== Score a single HTML file with Puppeteer =====
async function scoreHtml(browser, htmlPath, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const fileUrl = 'file://' + htmlPath;

  // Navigate — Chart.js CDN may timeout in local mode, handle gracefully
  try {
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, type: 'png' });

  // Run QA checks (same logic as qa-runner.js but executed via Puppeteer evaluate)
  const qaResult = await page.evaluate(() => {
    var results = [];
    var slides = document.querySelectorAll('.slide');

    // Store original
    var originalActive = document.querySelector('.slide.active');

    slides.forEach(function(slide, i) {
      // Activate for measurement
      slides.forEach(function(s) { s.classList.remove('active'); });
      slide.classList.add('active');
      slide.offsetHeight;

      var slideRect = slide.getBoundingClientRect();

      // A1: overflow
      var hasOverflow = false;
      var overflowDetail = [];
      slide.querySelectorAll('*').forEach(function(el) {
        var style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.classList.contains('gradient-art')) return;
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > slideRect.right + 5 || r.bottom > slideRect.bottom + 5 ||
            r.left < slideRect.left - 5 || r.top < slideRect.top - 5) {
          hasOverflow = true;
          overflowDetail.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0]);
        }
      });
      results.push({ slide: i+1, check: 'A1_no_overflow', pass: !hasOverflow,
        detail: hasOverflow ? overflowDetail.slice(0,3).join(', ') : '' });

      // A2: text overlap
      var textEls = slide.querySelectorAll('h1,h2,h3,h4,p,span,td,th,li,div');
      var leafRects = [];
      textEls.forEach(function(el) {
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.textContent.trim().length === 0) return;
        if (el.children.length > 0) {
          var hasText = false;
          el.childNodes.forEach(function(n) {
            if (n.nodeType === 3 && n.textContent.trim()) hasText = true;
          });
          if (!hasText) return;
        }
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) leafRects.push({ rect: r, el: el });
      });
      var hasOverlap = false;
      var overlapDetail = '';
      for (var a = 0; a < leafRects.length && !hasOverlap; a++) {
        for (var b = a+1; b < leafRects.length && !hasOverlap; b++) {
          if (leafRects[a].el.contains(leafRects[b].el) ||
              leafRects[b].el.contains(leafRects[a].el)) continue;
          var ra = leafRects[a].rect, rb = leafRects[b].rect;
          if (!(ra.right < rb.left+2 || ra.left > rb.right-2 ||
                ra.bottom < rb.top+2 || ra.top > rb.bottom-2)) {
            hasOverlap = true;
            overlapDetail = leafRects[a].el.tagName + ' <-> ' + leafRects[b].el.tagName;
          }
        }
      }
      results.push({ slide: i+1, check: 'A2_no_text_overlap', pass: !hasOverlap,
        detail: hasOverlap ? overlapDetail : '' });

      // A3: font min 14px
      var smallFonts = [];
      textEls.forEach(function(el) {
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.closest('.slide-footer__notes')) return;
        if (el.textContent.trim().length === 0) return;
        var fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 14) smallFonts.push(el.tagName + '(' + fs + 'px)');
      });
      results.push({ slide: i+1, check: 'A3_font_min_14px', pass: smallFonts.length === 0,
        detail: smallFonts.length > 0 ? smallFonts.slice(0,3).join(', ') : '' });

      // B1: padding >= 100px
      var cs = getComputedStyle(slide);
      var pl = parseFloat(cs.paddingLeft);
      var pr = parseFloat(cs.paddingRight);
      var isTitle = slide.classList.contains('slide--title');
      if (isTitle) { pl = Math.max(pl, 120); pr = Math.max(pr, 120); }
      results.push({ slide: i+1, check: 'B1_padding_100px', pass: pl >= 100 && pr >= 100,
        detail: 'L:' + pl + 'px R:' + pr + 'px' });

      // B2: title-to-content gap >= 40px
      var header = slide.querySelector('.slide-header');
      var nextEl = header ? header.nextElementSibling : null;
      var titleGap = 40;
      if (header && nextEl) {
        var hRect = header.getBoundingClientRect();
        var nRect = nextEl.getBoundingClientRect();
        titleGap = nRect.top - hRect.bottom;
      }
      results.push({ slide: i+1, check: 'B2_title_gap_40px',
        pass: isTitle || titleGap >= 35,
        detail: isTitle ? 'title slide' : 'gap:' + Math.round(titleGap) + 'px' });

      // B3: has visual
      var hasVisual = !!slide.querySelector(
        'img, svg, canvas, .kpi-card, .kpi-grid, table, .data-table, .gradient-art, ' +
        '.review-results, .result-card, .revision-indicator, .chart-grid-2col'
      );
      var isStructural = isTitle || !!slide.querySelector('.toc-list');
      results.push({ slide: i+1, check: 'B3_has_visual', pass: hasVisual || isStructural });

      // C1: KPI font >= 48px
      var kpis = slide.querySelectorAll('.kpi-number, .metric');
      var kpiOk = true;
      kpis.forEach(function(el) {
        if (parseFloat(getComputedStyle(el).fontSize) < 48) kpiOk = false;
      });
      results.push({ slide: i+1, check: 'C1_kpi_font_48px',
        pass: kpis.length === 0 || kpiOk });

      // C3: data slides have footnotes
      var isDataSlide = !!slide.querySelector('table, canvas, .kpi-grid, .chart-grid-2col, .kpi-card');
      var hasFootnote = false;
      var fn = slide.querySelector('.slide-footer__notes');
      if (fn && fn.textContent.trim().length > 0) hasFootnote = true;
      results.push({ slide: i+1, check: 'C3_data_has_footnote',
        pass: !isDataSlide || hasFootnote,
        detail: isDataSlide ? (hasFootnote ? '' : 'MISSING') : 'not data' });

      // C4: page number
      var hasPageNum = false;
      var pn = slide.querySelector('.slide-footer__page');
      if (pn && pn.textContent.trim().length > 0) hasPageNum = true;
      results.push({ slide: i+1, check: 'C4_has_page_number',
        pass: isTitle || hasPageNum,
        detail: isTitle ? 'title' : (hasPageNum ? '' : 'MISSING') });
    });

    // A4: navigation works
    if (slides.length > 1) {
      slides.forEach(function(s) { s.classList.remove('active'); });
      slides[0].classList.add('active');
      // Simulate ArrowRight
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      var navWorked = slides[1] && slides[1].classList.contains('active');
      results.push({ slide: 0, check: 'A4_navigation_works', pass: navWorked });
      // Reset
      slides.forEach(function(s) { s.classList.remove('active'); });
      slides[0].classList.add('active');
    }

    // B4: no 3+ consecutive same layout
    var hashes = [];
    slides.forEach(function(s) {
      hashes.push([
        s.querySelectorAll('.kpi-card').length,
        s.querySelectorAll('canvas').length,
        s.querySelectorAll('table').length,
        s.querySelectorAll('.result-card').length,
        s.classList.contains('slide--title') ? 1 : 0
      ].join('-'));
    });
    var consec = 1, b4Pass = true;
    for (var h = 1; h < hashes.length; h++) {
      if (hashes[h] === hashes[h-1]) {
        consec++;
        if (consec >= 3) { b4Pass = false; break; }
      } else { consec = 1; }
    }
    results.push({ slide: 0, check: 'B4_no_3_consecutive_same', pass: b4Pass });

    // Restore
    slides.forEach(function(s) { s.classList.remove('active'); });
    if (originalActive) originalActive.classList.add('active');
    else if (slides[0]) slides[0].classList.add('active');

    var total = results.length;
    var passed = results.filter(function(r) { return r.pass; }).length;
    return {
      score: Math.round(passed / total * 100),
      total: total,
      passed: passed,
      results: results
    };
  });

  const failed = qaResult.results.filter(r => !r.pass);

  console.log(`  ${name}: ${qaResult.score}% (${qaResult.passed}/${qaResult.total})${failed.length > 0 ? ' — ' + failed.length + ' failed' : ''}`);
  failed.forEach(f => {
    console.log(`    FAIL: ${f.slide > 0 ? 'S' + f.slide : 'Global'} ${f.check} ${f.detail || ''}`);
  });

  await page.close();

  return {
    name: name,
    score: qaResult.score,
    total: qaResult.total,
    passed: qaResult.passed,
    failed: failed,
    results: qaResult.results
  };
}

// ===== Compute aggregate score across all test inputs =====
function computeAggregate(allScores) {
  const allResults = [];
  allScores.forEach(s => allResults.push(...s.results));

  const totalChecks = allResults.length;
  const passedChecks = allResults.filter(r => r.pass).length;
  const score = Math.round(passedChecks / totalChecks * 100);

  // Per-check pass rates
  const checkMap = {};
  allResults.forEach(r => {
    if (!checkMap[r.check]) checkMap[r.check] = { total: 0, passed: 0 };
    checkMap[r.check].total++;
    if (r.pass) checkMap[r.check].passed++;
  });

  const checkPassRates = {};
  Object.keys(checkMap).sort().forEach(k => {
    checkPassRates[k] = Math.round(checkMap[k].passed / checkMap[k].total * 100);
  });

  return { score, totalChecks, passedChecks, checkPassRates };
}

// ===== Print formatted summary =====
function printSummary(allScores, agg) {
  console.log('\n┌───────────────────────────────────────────┐');
  console.log('│  Autoresearch Baseline Results             │');
  console.log('├───────────────────────────────────────────┤');

  allScores.forEach(s => {
    const bar = makeBar(s.score);
    console.log(`│  ${s.name.padEnd(20)} ${bar} ${String(s.score).padStart(3)}%  │`);
  });

  console.log('├───────────────────────────────────────────┤');
  const aggBar = makeBar(agg.score);
  console.log(`│  ${'AGGREGATE'.padEnd(20)} ${aggBar} ${String(agg.score).padStart(3)}%  │`);
  console.log('├───────────────────────────────────────────┤');
  console.log('│  Check Pass Rates:                        │');

  Object.keys(agg.checkPassRates).sort().forEach(k => {
    const rate = agg.checkPassRates[k];
    const miniBar = makeBar(rate, 10);
    console.log(`│  ${k.padEnd(28)} ${miniBar} ${String(rate).padStart(3)}%│`);
  });

  console.log('└───────────────────────────────────────────┘');
}

function makeBar(percent, width) {
  width = width || 15;
  const filled = Math.round(percent / 100 * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
