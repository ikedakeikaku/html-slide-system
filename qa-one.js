/**
 * qa-one.js — Screenshot + QA for a single template HTML file
 * Usage: node qa-one.js <template.html>
 */
'use strict';
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node qa-one.js <file.html>'); process.exit(1); }
const absPath = path.resolve(file);
const name = path.basename(file, '.html');
const ssDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  try { await page.goto('file://' + absPath, { waitUntil: 'networkidle0', timeout: 15000 }); }
  catch(e) { await page.goto('file://' + absPath, { waitUntil: 'load', timeout: 10000 }); await new Promise(r=>setTimeout(r,2000)); }
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ssDir, name + '.png'), type: 'png' });

  const qa = await page.evaluate(() => {
    var results = [];
    var slides = document.querySelectorAll('.slide');
    slides.forEach(function(slide, i) {
      slides.forEach(function(s) { s.classList.remove('active'); });
      slide.classList.add('active');
      slide.offsetHeight;
      var sr = slide.getBoundingClientRect();
      var isTitle = slide.classList.contains('slide--title') || slide.classList.contains('slide--section') || slide.classList.contains('slide--closing');

      // A1
      var overflow = false;
      slide.querySelectorAll('*').forEach(function(el) {
        var st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') return;
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.classList.contains('gradient-art')) return;
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > sr.right + 5 || r.bottom > sr.bottom + 5 || r.left < sr.left - 5 || r.top < sr.top - 5) overflow = true;
      });
      results.push({ s: i+1, c: 'A1', p: !overflow });

      // A2
      var textEls = slide.querySelectorAll('h1,h2,h3,h4,p,span,td,th,li,div');
      var rects = [];
      textEls.forEach(function(el) {
        if (el.closest('.slide-nav') || el.closest('.progress-bar')) return;
        if (el.textContent.trim().length === 0) return;
        if (el.children.length > 0) {
          var ht = false; el.childNodes.forEach(function(n) { if (n.nodeType===3 && n.textContent.trim()) ht=true; });
          if (!ht) return;
        }
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push({ r: r, e: el });
      });
      var olap = false;
      for (var a=0; a<rects.length && !olap; a++) {
        for (var b=a+1; b<rects.length && !olap; b++) {
          if (rects[a].e.contains(rects[b].e) || rects[b].e.contains(rects[a].e)) continue;
          var ra=rects[a].r, rb=rects[b].r;
          if (!(ra.right<rb.left+2||ra.left>rb.right-2||ra.bottom<rb.top+2||ra.top>rb.bottom-2)) olap=true;
        }
      }
      results.push({ s: i+1, c: 'A2', p: !olap });

      // B1
      var cs = getComputedStyle(slide);
      var pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
      if (isTitle) { pl = Math.max(pl, 120); pr = Math.max(pr, 120); }
      results.push({ s: i+1, c: 'B1', p: pl >= 100 && pr >= 100 });

      // B3
      var vis = !!slide.querySelector('img,svg,canvas,.kpi-card,.kpi-grid,table,.data-table,.gradient-art,.review-results,.result-card,.revision-indicator,.chart-grid-2col,.chart-panel,.toc-list,.flow-diagram,.timeline,.stat-card,.bullet-visual,.comparison-grid,.closing-cards,.stacked-chart');
      results.push({ s: i+1, c: 'B3', p: vis || isTitle });

      // C1
      var kpis = slide.querySelectorAll('.kpi-number,.metric,.highlight-number');
      var kpiOk = true;
      kpis.forEach(function(el) { if (parseFloat(getComputedStyle(el).fontSize) < 48) kpiOk = false; });
      results.push({ s: i+1, c: 'C1', p: kpis.length === 0 || kpiOk });
    });
    var t = results.length, p = results.filter(function(r){return r.p;}).length;
    return { score: Math.round(p/t*100), t: t, p: p, fail: results.filter(function(r){return !r.p;}) };
  });

  console.log(`${name}: ${qa.score}% (${qa.p}/${qa.t})${qa.fail.length ? '' : ' ALL PASS'}`);
  qa.fail.forEach(f => console.log(`  FAIL S${f.s} ${f.c}`));
  await browser.close();
})();
