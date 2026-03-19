# Project: HTML Slide System

## Overview
メルカリ決算資料品質のHTMLプレゼンテーションスライドを生成するシステム。
テンプレートベースのアプローチにより、安定した品質を保証する。

## Skills
- `.claude/skills/html-slide/` — HTMLスライド生成スキル
  - 「HTMLスライドを作って」「ウェブスライド」「ブラウザプレゼン」で発動
  - テンプレート5種: title-gradient, kpi-3col, chart-bar-dual, table-comparison, text-review
  - design-system.css と navigation.js を必ず読んでからスライドを生成すること

## Commands
- `node build-slides.js <input.json> <output.html>` — テスト入力からスライド生成
- `node autoresearch.js --baseline` — QAベースライン取得
- `node full-qa.js` — 全スライドのスクリーンショット＋詳細QA

## Key Rules
- スライド生成時は必ず `design-system.css` をインラインで含める
- Chart.js のラベルで改行する場合は配列 `["1Q","FY24"]` を使い、文字列 `"1Q\nFY24"` は使わない
- 全スライドに脚注＋ページ番号を入れる（タイトルスライド除く）
- padding は 120px 以上（タイトルスライドは 140px）
