/**
 * full-qa.js — Screenshot every slide of every test-input deck + detailed QA scoring
 *
 * Captures individual screenshots per slide, runs full QA checks,
 * and outputs per-slide details to identify any real-world quality issues.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUTPUT_DIR = path.join(__dirname, 'output');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/full-qa');

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const htmlFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ name: path.basename(f, '.html'), path: path.join(OUTPUT_DIR, f) }));

  console.log(`Full QA: ${htmlFiles.length} decks\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allResults = [];

  for (const deck of htmlFiles) {
    console.log(`=== ${deck.name} ===`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      await page.goto('file://' + deck.path, { waitUntil: 'networkidle0', timeout: 15000 });
    } catch (e) {
      await page.goto('file://' + deck.path, { waitUntil: 'load', timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));
    }
    await new Promise(r => setTimeout(r, 1000));

    // Get slide count
    const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
    console.log(`  Slides: ${slideCount}`);

    // Screenshot each slide
    for (let i = 0; i < slideCount; i++) {
      await page.evaluate((idx) => {
        const slides = document.querySelectorAll('.slide');
        slides.forEach(s => s.classList.remove('active'));
        slides[idx].classList.add('active');
      }, i);
      await new Promise(r => setTimeout(r, 300));

      const ssPath = path.join(SCREENSHOT_DIR, `${deck.name}-slide${i + 1}.png`);
      await page.screenshot({ path: ssPath, type: 'png' });
    }

    // Run full QA on all slides
    const qaResult = await page.evaluate(() => {
      var results = [];
      var slides = document.querySelectorAll('.slide');
      var originalActive = document.querySelector('.slide.active');

      slides.forEach(function(slide, i) {
        slides.forEach(function(s) { s.classList.remove('active'); });
        slide.classList.add('active');
        slide.offsetHeight;

        var slideRect = slide.getBoundingClientRect();
        var isTitle = slide.classList.contains('slide--title');

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
            overflowDetail.push({
              tag: el.tagName,
              cls: (el.className || '').toString().split(' ')[0],
              right: Math.round(r.right - slideRect.right),
              bottom: Math.round(r.bottom - slideRect.bottom)
            });
          }
        });
        results.push({ slide: i+1, check: 'A1_no_overflow', pass: !hasOverflow,
          detail: hasOverflow ? JSON.stringify(overflowDetail.slice(0,3)) : '' });

        // A2: text overlap (with parent-child exclusion)
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
              var elA = leafRects[a].el, elB = leafRects[b].el;
              overlapDetail = elA.tagName + '.' + (elA.className||'').toString().split(' ')[0] +
                '("' + elA.textContent.trim().substring(0,30) + '") <-> ' +
                elB.tagName + '.' + (elB.className||'').toString().split(' ')[0] +
                '("' + elB.textContent.trim().substring(0,30) + '")';
            }
          }
        }
        results.push({ slide: i+1, check: 'A2_no_text_overlap', pass: !hasOverlap,
          detail: overlapDetail });

        // A3: font min 14px
        var smallFonts = [];
        textEls.forEach(function(el) {
          if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
          if (el.closest('.slide-footer__notes')) return;
          if (el.textContent.trim().length === 0) return;
          var fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs > 0 && fs < 14) {
            smallFonts.push({
              tag: el.tagName,
              cls: (el.className||'').toString().split(' ')[0],
              size: fs,
              text: el.textContent.trim().substring(0,20)
            });
          }
        });
        results.push({ slide: i+1, check: 'A3_font_min_14px', pass: smallFonts.length === 0,
          detail: smallFonts.length > 0 ? JSON.stringify(smallFonts) : '' });

        // B1: padding >= 100px
        var cs = getComputedStyle(slide);
        var pl = parseFloat(cs.paddingLeft);
        var pr = parseFloat(cs.paddingRight);
        if (isTitle) { pl = Math.max(pl, 120); pr = Math.max(pr, 120); }
        results.push({ slide: i+1, check: 'B1_padding_100px', pass: pl >= 100 && pr >= 100,
          detail: 'L:' + Math.round(pl) + ' R:' + Math.round(pr) });

        // B2: title-to-content gap
        var header = slide.querySelector('.slide-header');
        var nextEl = header ? header.nextElementSibling : null;
        var titleGap = 40;
        if (header && nextEl) {
          titleGap = nextEl.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
        }
        results.push({ slide: i+1, check: 'B2_title_gap_40px',
          pass: isTitle || titleGap >= 35,
          detail: isTitle ? 'title' : 'gap:' + Math.round(titleGap) });

        // B3: has visual
        var hasVisual = !!slide.querySelector(
          'img, svg, canvas, .kpi-card, .kpi-grid, table, .data-table, .gradient-art, ' +
          '.review-results, .result-card, .revision-indicator, .chart-grid-2col'
        );
        results.push({ slide: i+1, check: 'B3_has_visual', pass: hasVisual || isTitle });

        // C1: KPI >= 48px
        var kpis = slide.querySelectorAll('.kpi-number, .metric');
        var kpiOk = true;
        var kpiDetail = [];
        kpis.forEach(function(el) {
          var fs = parseFloat(getComputedStyle(el).fontSize);
          kpiDetail.push(el.textContent.trim().substring(0,15) + ':' + fs + 'px');
          if (fs < 48) kpiOk = false;
        });
        results.push({ slide: i+1, check: 'C1_kpi_font_48px',
          pass: kpis.length === 0 || kpiOk,
          detail: kpiDetail.join(', ') });

        // C3: footnotes on data slides
        var isDataSlide = !!slide.querySelector('table, canvas, .kpi-grid, .chart-grid-2col, .kpi-card');
        var fn = slide.querySelector('.slide-footer__notes');
        var hasFootnote = fn && fn.textContent.trim().length > 0;
        results.push({ slide: i+1, check: 'C3_data_has_footnote',
          pass: !isDataSlide || hasFootnote,
          detail: isDataSlide ? (hasFootnote ? fn.textContent.trim().substring(0,40) : 'MISSING') : 'n/a' });

        // C4: page number
        var pn = slide.querySelector('.slide-footer__page');
        var hasPage = pn && pn.textContent.trim().length > 0;
        results.push({ slide: i+1, check: 'C4_has_page_number',
          pass: isTitle || hasPage,
          detail: isTitle ? 'title' : (hasPage ? pn.textContent.trim() : 'MISSING') });

        // C5: no literal escape sequences in visible text
        var escapeMatches = [];
        slide.querySelectorAll('*').forEach(function(el) {
          if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
          if (el.children.length > 0) return; // only leaf nodes
          var txt = el.textContent || '';
          if (/\\n|\\t|\\r/.test(txt)) {
            escapeMatches.push(el.tagName + ': "' + txt.trim().substring(0,30) + '"');
          }
        });
        results.push({ slide: i+1, check: 'C5_no_literal_escape',
          pass: escapeMatches.length === 0,
          detail: escapeMatches.length > 0 ? escapeMatches.join('; ') : '' });
      });

      // A4: navigation
      if (slides.length > 1) {
        slides.forEach(function(s) { s.classList.remove('active'); });
        slides[0].classList.add('active');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        var navOk = slides[1].classList.contains('active');
        results.push({ slide: 0, check: 'A4_navigation_works', pass: navOk });
        slides.forEach(function(s) { s.classList.remove('active'); });
        slides[0].classList.add('active');
      }

      // B4: consecutive layout
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
        if (hashes[h] === hashes[h-1]) { consec++; if (consec >= 3) { b4Pass = false; break; } }
        else consec = 1;
      }
      results.push({ slide: 0, check: 'B4_no_3_consecutive_same', pass: b4Pass,
        detail: 'hashes: ' + hashes.join(' | ') });

      // Restore
      slides.forEach(function(s) { s.classList.remove('active'); });
      if (originalActive) originalActive.classList.add('active');
      else if (slides[0]) slides[0].classList.add('active');

      var total = results.length;
      var passed = results.filter(function(r) { return r.pass; }).length;
      return { score: Math.round(passed/total*100), total: total, passed: passed, results: results };
    });

    // Print per-slide results
    const failed = qaResult.results.filter(r => !r.pass);
    console.log(`  Score: ${qaResult.score}% (${qaResult.passed}/${qaResult.total})`);

    if (failed.length > 0) {
      failed.forEach(f => {
        console.log(`  FAIL: ${f.slide > 0 ? 'Slide ' + f.slide : 'Global'} | ${f.check} | ${f.detail}`);
      });
    }

    // Print all per-slide details for full visibility
    const perSlide = {};
    qaResult.results.forEach(r => {
      const key = r.slide > 0 ? 'Slide ' + r.slide : 'Global';
      if (!perSlide[key]) perSlide[key] = [];
      perSlide[key].push(r);
    });
    Object.keys(perSlide).forEach(k => {
      const checks = perSlide[k];
      const allPass = checks.every(c => c.pass);
      if (!allPass) {
        checks.filter(c => !c.pass).forEach(c => {
          // already printed above
        });
      }
    });

    allResults.push({
      name: deck.name,
      score: qaResult.score,
      total: qaResult.total,
      passed: qaResult.passed,
      failed: failed,
      results: qaResult.results
    });

    await page.close();
    console.log('');
  }

  await browser.close();

  // Aggregate
  const allChecks = [];
  allResults.forEach(r => allChecks.push(...r.results));
  const totalAll = allChecks.length;
  const passedAll = allChecks.filter(r => r.pass).length;
  const aggScore = Math.round(passedAll / totalAll * 100);

  // Per-check rates
  const checkMap = {};
  allChecks.forEach(r => {
    if (!checkMap[r.check]) checkMap[r.check] = { total: 0, passed: 0 };
    checkMap[r.check].total++;
    if (r.pass) checkMap[r.check].passed++;
  });

  console.log('===========================================');
  console.log(`AGGREGATE: ${aggScore}% (${passedAll}/${totalAll})`);
  console.log('-------------------------------------------');
  Object.keys(checkMap).sort().forEach(k => {
    const c = checkMap[k];
    const rate = Math.round(c.passed / c.total * 100);
    const bar = '█'.repeat(Math.round(rate/10)) + '░'.repeat(10 - Math.round(rate/10));
    const status = rate === 100 ? '  ' : ' ←';
    console.log(`  ${k.padEnd(28)} ${bar} ${String(rate).padStart(3)}%${status}`);
  });
  console.log('===========================================');

  // Save detailed results
  const reportPath = path.join(__dirname, 'screenshots/full-qa/report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ aggregate: aggScore, results: allResults }, null, 2));
  console.log(`\nDetailed report: ${reportPath}`);
})();
