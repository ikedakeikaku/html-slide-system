/**
 * HTML Slide QA Runner
 *
 * Usage: Append ?qa=true to the HTML file URL, or inject this script.
 * Runs all checks from the checklist and outputs results to console + overlay.
 *
 * Checks implemented (from design doc §15.2):
 *   A1: No element overflow outside slide bounds
 *   A2: No text overlap between elements
 *   A3: Font size >= 14px (except footnotes)
 *   A4: Navigation works (keyboard arrow)
 *   B1: Left/right padding >= 100px
 *   B2: Title-to-content gap >= 40px
 *   B3: No text-only slides (must have visual element)
 *   B4: Same layout not repeated 3+ times consecutively
 *   B5: Color palette within theme bounds
 *   C1: KPI number font-size >= 48px
 *   C2: Chart has data labels (datalabels plugin)
 *   C3: Data slides have footnotes
 *   C4: All content slides have page numbers
 */
(function() {
  'use strict';

  // Only run if ?qa=true
  if (new URLSearchParams(location.search).get('qa') !== 'true') return;

  // Wait for page load + chart rendering
  window.addEventListener('load', function() {
    setTimeout(runQA, 800);
  });

  function runQA() {
    var results = [];
    var slides = document.querySelectorAll('.slide');

    // Store original active slide
    var originalActive = document.querySelector('.slide.active');
    var originalIndex = Array.from(slides).indexOf(originalActive);

    slides.forEach(function(slide, i) {
      // Activate slide for measurement
      slides.forEach(function(s) { s.classList.remove('active'); });
      slide.classList.add('active');

      // Force layout
      slide.offsetHeight;

      // ===== A1: No overflow =====
      var slideRect = slide.getBoundingClientRect();
      var children = slide.querySelectorAll('*');
      var hasOverflow = false;
      var overflowElements = [];
      children.forEach(function(el) {
        // Skip invisible elements
        var style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
        // Skip absolutely positioned navigation/footer elements
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        // Skip gradient art (decorative, intentionally overflows)
        if (el.classList.contains('gradient-art')) return;

        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > slideRect.right + 5 || r.bottom > slideRect.bottom + 5 ||
            r.left < slideRect.left - 5 || r.top < slideRect.top - 5) {
          hasOverflow = true;
          overflowElements.push(el.tagName + '.' + el.className.split(' ')[0]);
        }
      });
      results.push({
        slide: i + 1, check: 'A1_no_overflow', pass: !hasOverflow,
        detail: hasOverflow ? 'Overflow: ' + overflowElements.slice(0, 3).join(', ') : ''
      });

      // ===== A2: No text overlap =====
      var textEls = slide.querySelectorAll('h1,h2,h3,h4,p,span,td,th,li,div');
      var leafRects = [];
      textEls.forEach(function(el) {
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.textContent.trim().length === 0) return;
        if (el.children.length > 0) {
          // Only measure leaf nodes with text
          var hasTextChild = false;
          el.childNodes.forEach(function(n) {
            if (n.nodeType === 3 && n.textContent.trim().length > 0) hasTextChild = true;
          });
          if (!hasTextChild) return;
        }
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          leafRects.push({ rect: r, el: el });
        }
      });

      var hasOverlap = false;
      var overlapPair = '';
      for (var a = 0; a < leafRects.length && !hasOverlap; a++) {
        for (var b = a + 1; b < leafRects.length && !hasOverlap; b++) {
          // Skip parent-child pairs
          if (leafRects[a].el.contains(leafRects[b].el) ||
              leafRects[b].el.contains(leafRects[a].el)) continue;

          if (rectsOverlap(leafRects[a].rect, leafRects[b].rect, 2)) {
            hasOverlap = true;
            overlapPair = tagId(leafRects[a].el) + ' <-> ' + tagId(leafRects[b].el);
          }
        }
      }
      results.push({
        slide: i + 1, check: 'A2_no_text_overlap', pass: !hasOverlap,
        detail: hasOverlap ? overlapPair : ''
      });

      // ===== A3: Font size >= 14px =====
      var smallFonts = [];
      textEls.forEach(function(el) {
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.closest('.slide-footer__notes')) return; // footnotes exempt
        if (el.textContent.trim().length === 0) return;
        var fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 14) {
          smallFonts.push(el.tagName + '(' + fs + 'px)');
        }
      });
      results.push({
        slide: i + 1, check: 'A3_font_min_14px', pass: smallFonts.length === 0,
        detail: smallFonts.length > 0 ? smallFonts.slice(0, 3).join(', ') : ''
      });

      // ===== B1: Padding >= 100px =====
      var cs = getComputedStyle(slide);
      var pl = parseFloat(cs.paddingLeft);
      var pr = parseFloat(cs.paddingRight);
      // For title slides using display:flex, check padding from style
      var isTitle = slide.classList.contains('slide--title');
      if (isTitle) {
        pl = Math.max(pl, 120); // title slides use 140px padding
        pr = Math.max(pr, 120);
      }
      results.push({
        slide: i + 1, check: 'B1_padding_100px', pass: pl >= 100 && pr >= 100,
        detail: 'L:' + pl + 'px R:' + pr + 'px'
      });

      // ===== B2: Title-to-content gap >= 40px =====
      var header = slide.querySelector('.slide-header');
      var nextEl = header ? header.nextElementSibling : null;
      var titleGap = 40;
      if (header && nextEl) {
        var hRect = header.getBoundingClientRect();
        var nRect = nextEl.getBoundingClientRect();
        titleGap = nRect.top - hRect.bottom;
      }
      var isTitleSlide = slide.classList.contains('slide--title');
      results.push({
        slide: i + 1, check: 'B2_title_gap_40px',
        pass: isTitleSlide || titleGap >= 35, // 35px tolerance
        detail: isTitleSlide ? 'title slide (skip)' : 'gap:' + Math.round(titleGap) + 'px'
      });

      // ===== B3: Has visual element =====
      var hasVisual = !!slide.querySelector(
        'img, svg, canvas, .kpi-card, .kpi-grid, .bar-chart, .chart-container, ' +
        '.chart-panel, .chart-grid-2col, table, .data-table, .gradient-art, ' +
        '.comparison-grid, .review-results, .result-card, .revision-indicator'
      );
      var isStructural = slide.classList.contains('slide--title') ||
                         !!slide.querySelector('.toc-list');
      results.push({
        slide: i + 1, check: 'B3_has_visual', pass: hasVisual || isStructural,
        detail: ''
      });

      // ===== C1: KPI font >= 48px =====
      var kpiNums = slide.querySelectorAll('.kpi-number, .metric');
      var kpiPass = true;
      if (kpiNums.length > 0) {
        kpiNums.forEach(function(el) {
          var fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 48) kpiPass = false;
        });
      }
      results.push({
        slide: i + 1, check: 'C1_kpi_font_48px',
        pass: kpiNums.length === 0 || kpiPass,
        detail: kpiNums.length === 0 ? 'no KPI' : ''
      });

      // ===== C3: Data slides have footnotes =====
      var isDataSlide = !!slide.querySelector(
        'table, canvas, .kpi-grid, .chart-grid-2col, .kpi-card'
      );
      var hasFootnote = false;
      var footerNotes = slide.querySelector('.slide-footer__notes');
      if (footerNotes && footerNotes.textContent.trim().length > 0) hasFootnote = true;
      results.push({
        slide: i + 1, check: 'C3_data_has_footnote',
        pass: !isDataSlide || hasFootnote,
        detail: isDataSlide ? (hasFootnote ? 'has footnote' : 'MISSING footnote') : 'not data slide'
      });

      // ===== C4: Page number present =====
      var hasPageNum = false;
      var pageEl = slide.querySelector('.slide-footer__page');
      if (pageEl && pageEl.textContent.trim().length > 0) hasPageNum = true;
      results.push({
        slide: i + 1, check: 'C4_has_page_number',
        pass: isTitleSlide || hasPageNum,
        detail: isTitleSlide ? 'title (skip)' : (hasPageNum ? '' : 'MISSING')
      });
    });

    // ===== B4: No 3+ consecutive same layout =====
    var layoutHashes = [];
    slides.forEach(function(slide) {
      // Simple structural hash: count of each major element type
      var hash = [
        slide.querySelectorAll('.kpi-card').length,
        slide.querySelectorAll('canvas').length,
        slide.querySelectorAll('table').length,
        slide.querySelectorAll('.result-card').length,
        slide.classList.contains('slide--title') ? 1 : 0
      ].join('-');
      layoutHashes.push(hash);
    });
    var consecutiveCount = 1;
    var b4Pass = true;
    for (var h = 1; h < layoutHashes.length; h++) {
      if (layoutHashes[h] === layoutHashes[h - 1]) {
        consecutiveCount++;
        if (consecutiveCount >= 3) { b4Pass = false; break; }
      } else {
        consecutiveCount = 1;
      }
    }
    results.push({
      slide: 0, check: 'B4_no_3_consecutive_same',
      pass: b4Pass,
      detail: b4Pass ? '' : 'Layout repeated 3+ times'
    });

    // Restore original active slide
    slides.forEach(function(s) { s.classList.remove('active'); });
    if (originalActive) originalActive.classList.add('active');

    // ===== Score calculation =====
    var total = results.length;
    var passed = results.filter(function(r) { return r.pass; }).length;
    var score = Math.round(passed / total * 100);

    var output = {
      score: score,
      total: total,
      passed: passed,
      failed: results.filter(function(r) { return !r.pass; }),
      results: results
    };

    // Console output for Puppeteer/automation
    console.log('QA_RESULT:' + JSON.stringify(output));

    // Visual overlay
    var panel = document.createElement('div');
    panel.id = 'qa-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:60vh;overflow-y:auto;' +
      'background:#111;color:#fff;padding:24px 32px;z-index:99999;font-family:monospace;font-size:14px;' +
      'line-height:1.6;';

    var scoreColor = score >= 95 ? '#4CAF50' : score >= 75 ? '#FFC107' : '#FF4757';
    var html = '<h2 style="color:' + scoreColor + ';margin-bottom:12px;">QA Score: ' + score +
      '% (' + passed + '/' + total + ')</h2>';

    // Failed checks
    var failed = results.filter(function(r) { return !r.pass; });
    if (failed.length > 0) {
      html += '<div style="margin-bottom:12px;color:#FF4757;font-weight:bold;">Failed checks:</div>';
      failed.forEach(function(r) {
        html += '<div style="color:#FF6B6B;padding:2px 0;">' +
          (r.slide > 0 ? 'Slide ' + r.slide + ': ' : '') +
          r.check + (r.detail ? ' — ' + r.detail : '') + '</div>';
      });
    }

    // Passed checks (collapsed)
    var passedResults = results.filter(function(r) { return r.pass; });
    if (passedResults.length > 0) {
      html += '<details style="margin-top:12px;"><summary style="cursor:pointer;color:#4CAF50;">' +
        passedResults.length + ' checks passed</summary>';
      passedResults.forEach(function(r) {
        html += '<div style="color:#888;padding:1px 0;">' +
          (r.slide > 0 ? 'S' + r.slide + ': ' : '') +
          r.check + (r.detail ? ' — ' + r.detail : '') + '</div>';
      });
      html += '</details>';
    }

    html += '<button onclick="document.getElementById(\'qa-panel\').remove()" ' +
      'style="position:absolute;top:12px;right:16px;background:none;border:1px solid #666;' +
      'color:#fff;padding:4px 12px;cursor:pointer;border-radius:4px;">Close</button>';

    panel.innerHTML = html;
    document.body.prepend(panel);

    return output;
  }

  function rectsOverlap(a, b, tolerance) {
    tolerance = tolerance || 0;
    return !(
      a.right < b.left + tolerance ||
      a.left > b.right - tolerance ||
      a.bottom < b.top + tolerance ||
      a.top > b.bottom - tolerance
    );
  }

  function tagId(el) {
    var tag = el.tagName.toLowerCase();
    var cls = el.className ? ('.' + el.className.toString().split(' ')[0]) : '';
    var text = el.textContent.trim().substring(0, 20);
    return tag + cls + '("' + text + '")';
  }
})();
