# HTMLスライド生成システム 設計書

## 1. 設計思想

### 1.1 なぜHTMLか — パラダイムシフト

従来のAIスライド生成は python-pptx や PptxGenJS を介して PowerPoint 形式を出力していたが、以下の構造的問題がある。

- **フォーマットの複雑さ**: OOXML は座標・EMU単位・XML名前空間など人間にもAIにも扱いづらい
- **レンダリングの不透明さ**: 生成結果を確認するには LibreOffice 変換→PDF→画像 という多段パイプラインが必要
- **表現力の限界**: グラデーション、アニメーション、インタラクティブチャートなどが困難
- **QAコスト**: 座標のズレ、フォント未埋込、オブジェクト重なりなど見えないバグが多発

本システムでは **「スライドを16:9比率のHTMLセクションとして生成する」** パラダイムを採用する。

- AIの最も得意な出力形式（コード）を活用
- ブラウザのレンダリングエンジンがCSS Grid/Flexbox/SVG/Canvasを正確に描画
- 即座にブラウザで確認、スクリーンショットでQA可能
- Chart.js / D3.js / Mermaid などのライブラリでリッチなデータ可視化

### 1.2 出力形式

**単一HTMLファイル**。CSS・JSを全てインライン化し、外部依存なしで動作する。

- プレゼン時: ブラウザの全画面表示（F11）で投影
- 共有時: HTMLファイルを送付するだけで再現可能
- PDF化: ブラウザの印刷機能、または Puppeteer で自動変換
- 印刷時: `@media print` で1スライド=1ページに自動分割

---

## 2. システムアーキテクチャ

### 2.1 フォルダ構成

```
skills/
  html-slide/
    SKILL.md              # スキル定義（トリガー条件、使い方）
    design-system.md      # デザインシステム詳細仕様
    components.md         # コンポーネントカタログ
    templates/
      base.html           # ベーステンプレート（ナビゲーション・印刷対応含む）
      corporate.html      # コーポレート資料テンプレート（メルカリ風）
      pitch.html          # ピッチデック用テンプレート
      report.html         # レポート・分析資料テンプレート
    examples/
      mercari-style.html  # メルカリ風サンプル完成品
      minimal.html        # 最小構成サンプル
```

### 2.2 生成フロー

```
ユーザーリクエスト
    │
    ▼
[1. コンテンツ設計]  ← ユーザーの要件からスライド構成を決定
    │                    （枚数、各スライドの役割、レイアウト選択）
    ▼
[2. テーマ選定]     ← カラーパレット・フォント・モチーフを決定
    │                    （業種・トーン・ブランドカラーから自動提案）
    ▼
[3. HTML生成]       ← base.html をベースに全スライドを一括生成
    │                    （CSS変数でテーマを注入、コンポーネントを組み合わせ）
    ▼
[4. QA]             ← ブラウザスクリーンショットで全スライドを視覚検証
    │                    （Puppeteer or soffice でPDF→画像変換）
    ▼
[5. 修正・納品]     ← 問題箇所を修正し、最終HTMLを出力
```

### 2.3 QAパイプライン

> **重要: LibreOffice（soffice）でのHTML→PDF変換はQAに使えない。**
> プロトタイプ検証で判明した制約: LibreOfficeのHTMLレンダラーはCSS Grid、Flexbox、
> CSS gradients、JavaScript等をサポートしないため、レイアウトが完全に崩れる。
> QAには必ず**Chromiumベースのツール**を使うこと。

**推奨: Puppeteer（Node.js）**
```bash
npm install puppeteer  # Chromiumも自動ダウンロード
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});
  await page.goto('file:///path/to/slides.html', {waitUntil: 'networkidle0'});

  // 各スライドをスクリーンショット
  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  for (let i = 0; i < slideCount; i++) {
    await page.screenshot({path: 'slide-' + (i+1) + '.jpg', type: 'jpeg', quality: 90});
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
  }

  // PDF出力（全スライド）
  await page.pdf({path: 'slides.pdf', width: '1920px', height: '1080px', printBackground: true});
  await browser.close();
})();
"
```

**代替: Playwright（Python）**
```bash
pip install playwright && playwright install chromium
python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.goto('file:///path/to/slides.html')
    page.wait_for_timeout(1000)
    # 各スライドのスクリーンショット
    import subprocess
    slides = page.query_selector_all('.slide')
    for i in range(len(slides)):
        page.screenshot(path=f'slide-{i+1}.jpg')
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(300)
    browser.close()
"
```

**⚠️ Cowork環境での制約と回避策:**
Cowork VM環境ではChromiumのダウンロードが制限される場合がある。
その場合は**Claude in Chromeブラウザツール**でHTMLを開き、目視QAを行う。
```
1. HTMLファイルを file:// で開く
2. 各スライドを矢印キーで送りながらスクリーンショット
3. サブエージェントに画像を渡して視覚検証
```

---

## 3. デザインシステム

### 3.1 メルカリ資料から抽出したデザインパターン

メルカリの決算説明資料3期分（60ページ超）を分析し、以下のパターンを抽出。

#### カラーシステム
| トークン | 色 | 用途 |
|---------|------|------|
| `--color-primary` | `#0652DD` | セクション番号バッジ、ヘッダーバー、強調テキスト |
| `--color-primary-light` | `#E8EEFF` | カード背景、テーブルヘッダー |
| `--color-primary-dark` | `#003BB5` | ホバー、アクティブ状態 |
| `--color-accent` | `#FF4757` | 警告、赤ハイライト（YoY改善など） |
| `--color-bg` | `#FFFFFF` | スライド背景 |
| `--color-bg-subtle` | `#F8F9FA` | カード背景（KPIサマリー等） |
| `--color-text` | `#1A1A1A` | 本文テキスト |
| `--color-text-muted` | `#6B7280` | 脚注、補足テキスト |
| `--color-border` | `#E5E7EB` | テーブル罫線、カード境界 |

#### タイポグラフィ
| 要素 | フォント | サイズ | ウェイト |
|------|---------|--------|---------|
| スライドタイトル | Noto Sans JP / system-ui | 32-40px | 800 (Extra Bold) |
| セクションヘッダー | 同上 | 24-28px | 700 (Bold) |
| KPI数値 | 同上 | 56-72px | 800 |
| KPI単位 | 同上 | 24-28px | 400 |
| 本文 | 同上 | 16-18px | 400 |
| 脚注 | 同上 | 11-12px | 400 |
| ページ番号 | 同上 | 14px | 400 |

#### レイアウトパターン（メルカリ資料から特定）

**パターン1: タイトルスライド**
- 白背景、左寄せの大きなタイトル（48-64px, Extra Bold）
- サブタイトル（24px, Regular）
- 右下にグラデーションアート要素（CSS gradientで再現可能）
- ロゴは左上

**パターン2: 目次（TOC）**
- タイトル「目次」左上
- 番号付きリスト: 青い正方形バッジ（24x24px）+ セクション名
- 縦方向に等間隔配置

**パターン3: セクション区切り**
- 中央左寄せのセクションタイトル（40px, Bold）
- 右下にグラデーションアート（タイトルスライドと同じモチーフ）
- ページ番号なし

**パターン4: KPIサマリーカード（3列）**
- 3つの`border-radius: 12px`カード横並び
- 各カード: 青ヘッダーバー → KPI名ラベル → 大数値 → YoY表記
- カード背景: `#F8F9FA`、影なし

**パターン5: 四半期バーチャート（2列）**
- 左右2つの棒グラフ（売上収益 / コア営業利益）
- 各バー: 薄い青→濃い青のグラデーション、最新四半期のみ太い青
- バー上に数値ラベル
- 右端にYoY表記（青太字）
- X軸: 四半期ラベル（1Q-4Q × 年度）

**パターン6: テキスト+ボックス構造**
- 「期初の事業方針」ラベル（角丸ピル型、白背景青ボーダー）
- 右側に方針テキスト（青背景白テキスト or 白背景＋左ボーダー）
- 下部に振り返りボックス（左青ボーダー4pxの白カード）

**パターン7: テーブル（業績予想）**
- ヘッダー行: 青背景白テキスト
- 強調セル: 赤太字
- 罫線: 薄いグレー
- セル内中央揃え

**パターン8: 2列比較レイアウト**
- 上部に青ピル型ラベル2つ（左右）
- 左右に独立したコンテンツエリア
- スクリーンショットや画像を含むことも

**パターン9: コスト構成比（100%積み上げバー）**
- 横に並んだ期間ごとの100%スタックバー
- 各セグメントに%ラベル
- 凡例は上部に横並び

**パターン10: フローチャート/戦略図**
- ボックス + 矢印の接続
- 青/赤/白の3色使い
- CSSで `→` をborder tricksまたはSVGで描画

### 3.2 CSS変数によるテーマシステム

```css
:root {
  /* ===== テーマカラー（プロジェクトごとに変更） ===== */
  --color-primary: #0652DD;
  --color-primary-light: #E8EEFF;
  --color-primary-dark: #003BB5;
  --color-accent: #FF4757;
  --color-accent-light: #FFE8EA;
  --color-bg: #FFFFFF;
  --color-bg-subtle: #F8F9FA;
  --color-text: #1A1A1A;
  --color-text-muted: #6B7280;
  --color-border: #E5E7EB;

  /* ===== チャートカラー（棒グラフ・円グラフ等） ===== */
  --chart-1: #B0C4FF;      /* 過去期間の薄い青 */
  --chart-2: #6B9AFF;      /* 中間期間 */
  --chart-3: #0652DD;      /* 最新期間の濃い青 */
  --chart-4: #003BB5;      /* 強調 */
  --chart-accent: #FF4757; /* 赤ハイライト */

  /* ===== タイポグラフィ ===== */
  --font-heading: "Noto Sans JP", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Noto Sans JP", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  /* ===== スライド寸法 ===== */
  --slide-width: 1920px;
  --slide-height: 1080px;
  --slide-aspect: 16 / 9;
  --slide-padding: 80px;
  --slide-padding-top: 100px;

  /* ===== スペーシング ===== */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 40px;
  --space-xl: 64px;

  /* ===== 角丸 ===== */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 999px;
}
```

### 3.3 プリセットテーマ

ユーザーの業種・トーンに応じて切り替え可能なテーマ群。

```css
/* Corporate Blue（メルカリ風） */
.theme-corporate-blue {
  --color-primary: #0652DD;
  --color-primary-light: #E8EEFF;
  --color-accent: #FF4757;
}

/* Forest Green（環境・ESG向け） */
.theme-forest-green {
  --color-primary: #2C5F2D;
  --color-primary-light: #E8F5E9;
  --color-accent: #FF6B35;
}

/* Warm Terracotta（ブランド・デザイン向け） */
.theme-warm-terracotta {
  --color-primary: #B85042;
  --color-primary-light: #FBE9E7;
  --color-accent: #A7BEAE;
}

/* Midnight Executive（経営・IR向け） */
.theme-midnight {
  --color-primary: #1E2761;
  --color-primary-light: #E8EAF6;
  --color-accent: #F9A825;
}

/* Teal Trust（テック・SaaS向け） */
.theme-teal-trust {
  --color-primary: #028090;
  --color-primary-light: #E0F7FA;
  --color-accent: #FF6B6B;
}
```

---

## 4. ベーステンプレート構造

### 4.1 HTML骨格

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PRESENTATION_TITLE}}</title>
  <style>
    /* === リセット・ベース === */
    /* === テーマ変数 === */
    /* === スライドコンテナ === */
    /* === コンポーネント === */
    /* === ナビゲーション === */
    /* === 印刷対応 === */
    /* === アニメーション === */
  </style>
</head>
<body>
  <!-- ナビゲーションUI -->
  <nav class="slide-nav">
    <span class="slide-counter"><span id="current">1</span> / <span id="total">N</span></span>
    <button onclick="prevSlide()" aria-label="前のスライド">‹</button>
    <button onclick="nextSlide()" aria-label="次のスライド">›</button>
    <button onclick="toggleFullscreen()" aria-label="全画面">⛶</button>
  </nav>

  <!-- スライド群 -->
  <div class="slides-container">

    <section class="slide" id="slide-1">
      <!-- スライド1の内容 -->
    </section>

    <section class="slide" id="slide-2">
      <!-- スライド2の内容 -->
    </section>

    <!-- ... -->

  </div>

  <script>
    // ナビゲーション制御
    // キーボードショートカット
    // タッチ操作
    // 進捗バー
  </script>
</body>
</html>
```

### 4.2 スライドコンテナCSS

```css
/* ===== リセット ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== スライドコンテナ ===== */
.slides-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.slide {
  width: var(--slide-width);
  height: var(--slide-height);
  padding: var(--slide-padding-top) var(--slide-padding) var(--slide-padding);
  position: absolute;
  top: 0;
  left: 0;
  background: var(--color-bg);
  opacity: 0;
  transition: opacity 0.3s ease;
  transform-origin: top left;
  overflow: hidden;

  /* ビューポートに合わせて自動スケーリング */
  /* JSでscale()を動的に計算 */
}

.slide.active {
  opacity: 1;
  z-index: 1;
}

/* レスポンシブスケーリング */
@media (max-width: 1920px) {
  .slide {
    transform: scale(var(--viewport-scale, 1));
  }
}
```

### 4.3 スケーリングロジック（JavaScript）

```javascript
function updateScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const slideW = 1920;
  const slideH = 1080;
  const scale = Math.min(vw / slideW, vh / slideH);
  document.documentElement.style.setProperty('--viewport-scale', scale);

  // スライドを画面中央に配置
  const offsetX = (vw - slideW * scale) / 2;
  const offsetY = (vh - slideH * scale) / 2;
  document.querySelectorAll('.slide').forEach(s => {
    s.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  });
}
window.addEventListener('resize', updateScale);
window.addEventListener('load', updateScale);
```

---

## 5. コンポーネントカタログ

### 5.1 スライドヘッダー（全スライド共通）

```html
<header class="slide-header">
  <div class="slide-header__left">
    <span class="section-badge">1</span>
    <h1 class="slide-title">連結 ハイライト</h1>
  </div>
  <div class="slide-header__right">
    <img src="data:image/svg+xml,..." class="logo" alt="Company Logo">
  </div>
</header>
```

```css
.slide-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-lg);
}
.slide-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  color: white;
  font-weight: 700;
  font-size: 18px;
  border-radius: var(--radius-sm);
}
.slide-title {
  font-family: var(--font-heading);
  font-size: 36px;
  font-weight: 800;
  color: var(--color-text);
}
```

### 5.2 KPIカード（3列）

```html
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-card__header">Marketplace</div>
    <div class="kpi-card__body">
      <span class="kpi-label">GMV</span>
      <div class="kpi-value">
        <span class="kpi-number">2,703</span>
        <span class="kpi-unit">億円</span>
      </div>
      <span class="kpi-change positive">(YoY +5%)</span>
    </div>
  </div>
  <!-- 繰り返し -->
</div>
```

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}
.kpi-card {
  background: var(--color-bg-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  text-align: center;
}
.kpi-card__header {
  background: var(--color-primary);
  color: white;
  font-size: 22px;
  font-weight: 700;
  padding: 16px;
}
.kpi-label {
  display: inline-block;
  background: var(--color-primary);
  color: white;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 20px;
  border-radius: var(--radius-pill);
  margin-top: var(--space-md);
}
.kpi-number {
  font-size: 64px;
  font-weight: 800;
  color: var(--color-text);
}
.kpi-unit {
  font-size: 24px;
  font-weight: 400;
  color: var(--color-text-muted);
}
.kpi-change.positive { color: var(--color-text-muted); }
.kpi-change.negative { color: var(--color-accent); }
```

### 5.3 棒グラフ（CSS純正 — Chart.js不要の場合）

```html
<div class="bar-chart">
  <h3 class="chart-title">売上収益</h3>
  <div class="chart-subtitle">単位：億円</div>
  <div class="bar-chart__bars">
    <div class="bar-group" style="--value: 442; --max: 500; --height: 88%">
      <div class="bar bar--past"><span class="bar-label">442</span></div>
      <div class="bar-axis-label">1Q<br>FY2024.6</div>
    </div>
    <!-- ... 他の四半期 ... -->
    <div class="bar-group" style="--value: 494; --max: 500; --height: 99%">
      <div class="bar bar--current"><span class="bar-label">494</span></div>
      <div class="bar-axis-label">1Q<br>FY2026.6</div>
    </div>
  </div>
  <div class="yoy-annotation">
    <span class="yoy-value">YoY</span>
    <span class="yoy-percent">+10%</span>
  </div>
</div>
```

```css
.bar-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 400px;
  padding-bottom: 60px;
  position: relative;
}
.bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bar {
  width: 100%;
  max-width: 48px;
  height: var(--height);
  border-radius: 4px 4px 0 0;
  position: relative;
}
.bar--past { background: var(--chart-1); }
.bar--current { background: var(--chart-3); }
.bar-label {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  font-weight: 600;
}
```

### 5.4 Chart.js統合（リッチチャート用）

```html
<canvas id="chart-revenue" width="800" height="400"></canvas>
<script>
// Chart.js CDNをインライン化、またはbundleに含める
new Chart(document.getElementById('chart-revenue'), {
  type: 'bar',
  data: {
    labels: ['1Q FY24', '2Q', '3Q', '4Q', '1Q FY25', '2Q', '3Q', '4Q', '1Q FY26'],
    datasets: [{
      data: [442, 481, 484, 465, 449, 492, 499, 485, 494],
      backgroundColor: ctx => ctx.dataIndex === 8 ? '#0652DD' : '#B0C4FF',
      borderRadius: 4,
      barPercentage: 0.7,
    }]
  },
  options: {
    responsive: false,
    plugins: {
      legend: { display: false },
      datalabels: { anchor: 'end', align: 'top', font: { weight: 'bold' } }
    },
    scales: {
      y: { display: false },
      x: { grid: { display: false } }
    }
  }
});
</script>
```

### 5.5 テーブル

```html
<table class="data-table">
  <thead>
    <tr>
      <th></th>
      <th>期初の業績予想</th>
      <th class="highlight">変更後の業績予想</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="row-label">売上収益</td>
      <td>2,000-2,100億円</td>
      <td class="highlight"><strong>2,100-2,200億円</strong></td>
    </tr>
  </tbody>
</table>
```

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 18px;
}
.data-table th {
  background: var(--color-primary);
  color: white;
  padding: 14px 20px;
  font-weight: 600;
  text-align: center;
}
.data-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  text-align: center;
}
.data-table .row-label {
  text-align: left;
  font-weight: 600;
  background: var(--color-bg-subtle);
}
.data-table .highlight {
  color: var(--color-accent);
  font-weight: 700;
}
```

### 5.6 振り返りボックス（左ボーダーカード）

```html
<div class="review-box">
  <div class="review-box__header">
    <span class="pill-label">期初の事業方針</span>
  </div>
  <div class="review-box__content">
    <p>・プロダクトのコア体験強化を最優先に進めつつ...</p>
  </div>
</div>

<div class="insight-card">
  <p>売上収益は142億円（YoY +22%）、コア営業利益は27億円...</p>
</div>
```

```css
.pill-label {
  display: inline-block;
  padding: 6px 20px;
  background: white;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-primary);
}
.insight-card {
  border-left: 4px solid var(--color-primary);
  background: var(--color-bg-subtle);
  padding: 20px 24px;
  margin-bottom: var(--space-sm);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: 17px;
  line-height: 1.7;
}
```

### 5.7 2列比較レイアウト

```html
<div class="comparison-grid">
  <div class="comparison-col">
    <div class="comparison-header">プロダクトのコア体験強化</div>
    <div class="comparison-body">
      <!-- 内容 -->
    </div>
  </div>
  <div class="comparison-col">
    <div class="comparison-header accent">マーケティング施策</div>
    <div class="comparison-body">
      <!-- 内容 -->
    </div>
  </div>
</div>
```

```css
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}
.comparison-header {
  background: var(--color-primary);
  color: white;
  text-align: center;
  padding: 12px;
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: 18px;
  margin-bottom: var(--space-md);
}
.comparison-header.accent {
  background: var(--color-accent);
}
```

### 5.8 ページフッター

```html
<footer class="slide-footer">
  <div class="slide-footer__notes">
    <p>1. IFRS営業利益からその他の収益/その他の費用等を控除した利益</p>
  </div>
  <div class="slide-footer__page">5</div>
</footer>
```

```css
.slide-footer {
  position: absolute;
  bottom: 30px;
  left: var(--slide-padding);
  right: var(--slide-padding);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.slide-footer__notes {
  font-size: 11px;
  color: var(--color-text-muted);
  max-width: 80%;
}
.slide-footer__page {
  font-size: 14px;
  color: var(--color-text-muted);
}
```

### 5.9 サイドラベル（縦書き）

```html
<div class="side-label">Financial Results Presentation Material</div>
```

```css
.side-label {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
  font-size: 11px;
  color: var(--color-primary);
  letter-spacing: 1px;
  white-space: nowrap;
}
```

---

## 6. ナビゲーション仕様

### 6.1 操作方法

| 操作 | アクション |
|------|----------|
| `→` / `↓` / `Space` / `PageDown` | 次のスライド |
| `←` / `↑` / `PageUp` | 前のスライド |
| `Home` | 最初のスライド |
| `End` | 最後のスライド |
| `1`-`9` | スライド番号に直接移動 |
| `F` / `F11` | 全画面トグル |
| `G` | スライド番号入力ダイアログ |
| `O` | オーバービュー（サムネイル一覧）表示 |
| `Esc` | オーバービュー/全画面を閉じる |
| スワイプ左右 | 次/前（タッチデバイス） |
| マウスホイール | 次/前 |

### 6.2 プログレスバー

```html
<div class="progress-bar">
  <div class="progress-bar__fill" id="progress"></div>
</div>
```

```css
.progress-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(0,0,0,0.1);
  z-index: 100;
}
.progress-bar__fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}
```

### 6.3 オーバービューモード

スライド一覧をグリッドで表示し、クリックで移動。

```css
.slides-container.overview .slide {
  transform: scale(0.2) !important;
  position: relative !important;
  opacity: 1 !important;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}
.slides-container.overview .slide:hover {
  border-color: var(--color-primary);
}
.slides-container.overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  padding: 40px;
  overflow-y: auto;
  height: 100vh;
}
```

### 6.4 ナビゲーションJS（完全版）

```javascript
(function() {
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  let current = 0;
  let isOverview = false;

  function goTo(index) {
    if (index < 0 || index >= total) return;
    slides[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    document.getElementById('current').textContent = current + 1;
    document.getElementById('progress').style.width =
      ((current + 1) / total * 100) + '%';
    // URLハッシュ更新（ブックマーク対応）
    history.replaceState(null, '', '#' + (current + 1));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  // キーボード
  document.addEventListener('keydown', e => {
    if (isOverview && e.key === 'Escape') { toggleOverview(); return; }
    switch(e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': goTo(0); break;
      case 'End': goTo(total - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'o': case 'O': toggleOverview(); break;
      case 'g': case 'G':
        const n = prompt('スライド番号を入力:');
        if (n) goTo(parseInt(n) - 1);
        break;
      default:
        if (e.key >= '1' && e.key <= '9') goTo(parseInt(e.key) - 1);
    }
  });

  // タッチ操作
  let touchStartX = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });
  document.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
  });

  // マウスホイール
  let wheelCooldown = false;
  document.addEventListener('wheel', e => {
    if (wheelCooldown) return;
    wheelCooldown = true;
    setTimeout(() => wheelCooldown = false, 500);
    e.deltaY > 0 ? next() : prev();
  });

  // 全画面
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // オーバービュー
  function toggleOverview() {
    isOverview = !isOverview;
    document.querySelector('.slides-container').classList.toggle('overview');
  }

  // 初期化
  window.addEventListener('load', () => {
    const hash = parseInt(location.hash.slice(1));
    goTo(isNaN(hash) ? 0 : hash - 1);
    updateScale();
  });

  // グローバル公開
  window.prevSlide = prev;
  window.nextSlide = next;
  window.toggleFullscreen = toggleFullscreen;
})();
```

---

## 7. 印刷・PDF対応

```css
@media print {
  .slide-nav,
  .progress-bar { display: none; }

  .slides-container {
    display: block;
    overflow: visible;
  }

  .slide {
    position: relative !important;
    opacity: 1 !important;
    transform: none !important;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
  }

  @page {
    size: 1920px 1080px;
    margin: 0;
  }
}
```

---

## 8. SKILL.md 設計

```markdown
---
name: html-slide
description: >
  HTMLウェブページとしてプレゼンテーションスライドを生成するスキル。
  16:9比率のセクションをブラウザで全画面表示し、PowerPointと同等以上の
  プレゼンテーション体験を実現する。PowerPoint形式より高品質な
  データ可視化・レイアウト・アニメーションが可能。

  以下のリクエストでこのスキルを使うこと:
  - 「HTMLスライドを作って」「ウェブスライド」
  - 「ブラウザで表示するプレゼン」
  - 「インタラクティブなスライド」
  - 「Chart.jsでグラフ付きスライド」
  - .pptx が不要で、ブラウザ表示前提の場合全般
---

# HTML Slide Skill

## Quick Reference

| Task | Guide |
|------|-------|
| 新規作成 | Read design-system.md + components.md |
| テーマ変更 | CSS変数(:root)を書き換え |
| チャート追加 | Chart.js をインライン統合 |
| PDF出力 | ブラウザ印刷 or Puppeteer |

## 生成ワークフロー

1. **コンテンツ構成を決定**: 枚数・各スライドの役割・レイアウトパターンを選択
2. **テーマ決定**: カラーパレットを:root変数に設定
3. **base.htmlをコピー**: ナビゲーション・印刷対応は既にベースに含まれる
4. **スライドを1枚ずつ構築**: コンポーネントを組み合わせ
5. **QA**: ブラウザでファイルを開き、スクリーンショットで確認

## デザインルール

- **全スライドに視覚要素を**: テキストのみのスライドは禁止
- **レイアウトを変化させる**: 同じパターンの連続は最大2枚まで
- **数値は大きく**: KPIは56px以上、単位は別サイズ
- **余白を恐れない**: padding 80px、要素間 24-40px
- **色は3色+1アクセント**: primary, bg, text + accent
- **脚注は必ず**: データの出典・定義をフッターに

## QA チェックリスト

- [ ] 全スライドがブラウザで正しく表示される
- [ ] キーボードナビゲーションが動作する
- [ ] テキストがはみ出していない
- [ ] グラフの数値が正しい
- [ ] フォントが読みやすい（14px以上）
- [ ] 印刷プレビューで1スライド=1ページ
```

---

## 9. 既存PPTXスキルとの棲み分け

| 観点 | PPTXスキル（既存） | HTMLスライドスキル（新規） |
|------|-------------------|-------------------------|
| 出力形式 | .pptx | .html（単一ファイル） |
| 表示方法 | PowerPoint/Keynote | ブラウザ |
| データ可視化 | PptxGenJS charts（限定的） | Chart.js / D3.js / CSS（高自由度） |
| レイアウト自由度 | 座標ベース（制約あり） | CSS Grid/Flexbox（高自由度） |
| アニメーション | 限定的 | CSS transitions + JS |
| QAコスト | 高い（変換パイプライン必要） | 低い（ブラウザで即確認） |
| 互換性 | MS Office / Google Slides | どのブラウザでも |
| 編集しやすさ | PowerPointで直接編集可能 | HTMLコード編集（一般ユーザーには不向き） |
| 推奨用途 | クライアント提出用、テンプレートベース | 社内プレゼン、データ分析報告、ピッチ |

**選択基準**: クライアントが「.pptxで欲しい」と言う場合はPPTXスキル、それ以外はHTMLスキル推奨。

---

## 10. グラデーションアート要素の再現

メルカリ資料の右下に配置されているグラデーションアート（青→赤のノイズテクスチャ）は、CSSで近似再現可能。

```css
.gradient-art {
  position: absolute;
  bottom: -100px;
  right: -200px;
  width: 900px;
  height: 600px;
  background:
    radial-gradient(ellipse at 30% 60%, rgba(255, 71, 87, 0.6) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 40%, rgba(6, 82, 221, 0.8) 0%, transparent 50%),
    linear-gradient(135deg, #0652DD 0%, #3B9AFF 50%, #FF4757 100%);
  filter: blur(30px) saturate(1.2);
  transform: rotate(-15deg);
  clip-path: polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%);
  opacity: 0.9;
}
```

より高品質な場合はSVGフィルター（`<feTurbulence>`）でノイズテクスチャを追加:

```html
<svg width="0" height="0">
  <filter id="noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
    <feDisplacementMap in="SourceGraphic" scale="15" />
  </filter>
</svg>
<div class="gradient-art" style="filter: url(#noise) blur(20px);"></div>
```

---

## 11. 生成プロンプトテンプレート

Claude Codeがスライドを生成する際の内部プロンプト構造。

```
## タスク
以下の内容に基づいてHTMLプレゼンテーションを生成してください。

## 入力情報
- タイトル: {{title}}
- 対象: {{audience}}（例: 経営会議、投資家向け、社内共有）
- スライド枚数: {{count}}枚程度
- テーマ: {{theme}}（例: corporate-blue, midnight, teal-trust）
- 内容: {{content_outline}}

## 必須構造
1. タイトルスライド
2. 目次（4枚以上の場合）
3. コンテンツスライド群（レイアウトパターンを変化させること）
4. まとめ/次のステップ

## 制約
- 単一HTMLファイル、外部依存なし（CDNも不使用）
- 全てのCSS・JSをインライン化
- スライド寸法: 1920x1080px
- フォント: system-uiフォールバック（Webフォント不使用）
- Chart.jsはCDNから読み込み可（オフライン不要の場合）
- テキストのみのスライド禁止
- 同じレイアウトの連続は最大2枚まで
```

---

## 12. 実装ロードマップ

### Phase 1: 基盤（MVP）
- [ ] ベーステンプレート（base.html）の実装
- [ ] ナビゲーションシステム（キーボード + タッチ + ホイール）
- [ ] スケーリングロジック
- [ ] 印刷対応CSS
- [ ] 基本コンポーネント5種（ヘッダー、KPIカード、テーブル、テキストボックス、フッター）

### Phase 2: コンポーネント拡充
- [ ] Chart.js統合（棒グラフ、折れ線、円、100%積み上げ）
- [ ] CSS純正グラフ（Chart.js不要の軽量版）
- [ ] フローチャート/戦略図コンポーネント
- [ ] 画像+テキストレイアウト
- [ ] タイムライン/ロードマップコンポーネント

### Phase 3: テーマ・テンプレート
- [ ] 5種のプリセットテーマ
- [ ] 業種別テンプレート（IR資料、営業提案、プロジェクト報告）
- [ ] メルカリ風完全再現サンプル

### Phase 4: 品質・拡張
- [ ] QA自動化（Puppeteer スクリーンショット → サブエージェント検証）
- [ ] アニメーション対応（フェード、スライドイン）
- [ ] スピーカーノート機能
- [ ] PDF自動生成パイプライン
- [ ] オーバービューモード完全実装

---

---

## 13. プロトタイプ検証結果

### 13.1 検証内容

メルカリ決算資料のデザインを模倣した7枚のHTMLスライドを生成し、以下を検証。

- タイトルスライド（CSSグラデーションアート）
- 目次スライド
- セクション区切りスライド
- 連結ハイライト（KPI + テキストボックス構造）
- KPIサマリーカード（3列グリッド）
- 四半期棒グラフ（CSS純正）
- テーブル（業績予想上方修正）

### 13.2 判明した課題と対策

| 課題 | 原因 | 対策 |
|------|------|------|
| LibreOfficeでのHTML→PDF変換が完全に破綻 | CSS Grid/Flexbox/gradient/JS非サポート | QAにはChromiumベースのツールのみ使用 |
| Cowork VM環境でPlaywright/Puppeteerのブラウザ取得が困難 | ネットワーク制限 | Claude in Chromeツールをフォールバックに |
| sofficeは`--outdir`指定なしだとカレントディレクトリに出力 | soffice.pyの仕様 | パス管理に注意 |

### 13.3 設計の妥当性確認

プロトタイプのHTML自体は設計仕様通りに構築されており、以下が確認できた:

1. **CSS変数によるテーマ管理**: `:root`変数の書き換えでカラーパレットの一括変更が可能
2. **コンポーネントの組み合わせ**: ヘッダー、KPIカード、テーブル、棒グラフ等を組み合わせてメルカリ風レイアウトを再現
3. **ナビゲーションJS**: キーボード、タッチ、ホイール対応のスライドナビゲーション
4. **印刷対応**: `@media print`で1スライド=1ページ
5. **スケーリング**: 任意のビューポートサイズに16:9スライドを自動フィット
6. **CSSグラデーションアート**: `radial-gradient` + `filter: blur()` + `clip-path` でメルカリのグラデーションモチーフを近似再現

### 13.4 プロトタイプファイル

- `prototype.html` — 7枚のメルカリ風HTMLスライド（ブラウザで直接開いて動作確認可能）

---

## 14. プロトタイプv1のブラウザ表示検証（ユーザーフィードバック）

### 14.1 確認された問題

ブラウザでの実表示により、以下の品質問題が確認された。

| # | 問題 | スライド | 根本原因 |
|---|------|---------|---------|
| 1 | サイドラベル「Financial Results...」がコンテンツに重なる | 全スライド | `position: absolute; left: 12px` がスライドのpadding内に侵入 |
| 2 | 棒グラフのX軸ラベルが下端で切れる | スライド6 | バーチャートの `height: 320px` + `padding-bottom: 60px` がスライドの有効高さを超過 |
| 3 | テーブルの行ラベル「コア営業利益」が折り返される | スライド7 | カラム幅 `140px` が日本語5文字の幅に不足 |
| 4 | 全体的に要素が窮屈で余白が不足 | 複数 | メルカリ資料は「1920x1080で余白120px+」だが、prototype は `padding: 80px` |
| 5 | テキストが密集し、読みにくい | スライド4,7 | `line-height: 1.7-1.8` だがフォントサイズに対して行間が詰まって見える |

### 14.2 根本的な課題: 「コンポーネント設計」ではなく「完成品テンプレート」が必要

今回のプロトタイプで判明した最も重要な教訓:

> **現在の設計は「パーツの仕様書」であり、「完成品の品質」を保証しない。**
>
> CSS変数やコンポーネント定義は正しいが、実際にAIが組み合わせると
> サイズ・余白・配置の微調整が不十分になり、メルカリ品質に到達しない。
> これは python-pptx 等の従来アプローチと同じ失敗パターン。

**解決策: テンプレートベースのアプローチに転換する。**

AIが「パーツを自由に組み合わせる」のではなく、
「検証済みの完成スライドテンプレートにデータを流し込む」方式にする。

### 14.3 スキル設計方針の転換

#### Before（v1: コンポーネント組み合わせ方式）
```
ユーザー要件 → AI がコンポーネントを選択 → 自由にHTML構築 → 品質にバラつき
```

#### After（v2: テンプレート選択＋データ注入方式）
```
ユーザー要件 → AI がテンプレートを選択 → データを差し替え → 品質が安定
```

#### 具体的に何が変わるか

| 観点 | v1（現在） | v2（改善後） |
|------|-----------|------------|
| スライド構築 | コンポーネントの自由組み合わせ | 検証済みテンプレートを選択 |
| CSS | コンポーネント単位で定義 | テンプレート全体で最終調整済み |
| テキスト量 | AIが自由に記述 | テンプレートが「最大○文字」を規定 |
| 余白・配置 | AIが判断（失敗しやすい） | テンプレートに固定値で組込済み |
| グラフ | CSSで自作（バー高さ等を手動計算） | Chart.jsにデータ配列を渡すだけ |
| QA | 全スライドを目視確認 | テンプレート自体がQA済みのため軽量 |
| 品質の下限 | 低い（組み合わせ次第） | 高い（テンプレートが品質を保証） |

### 14.4 構築すべきスキルの構造

```
skills/
  html-slide/
    SKILL.md                     # スキル定義・ワークフロー
    design-system.css            # CSS変数・共通スタイル（外部読込用）
    navigation.js                # ナビゲーションJS（外部読込用）

    templates/                   # ★核心: QA済みの完成スライドテンプレート
      _base.html                 # 共通骨格（head, nav, script）

      # --- 個別スライドテンプレート ---
      title-gradient.html        # タイトル: グラデーションアート付き
      title-image.html           # タイトル: 背景画像付き
      title-minimal.html         # タイトル: ミニマル

      toc.html                   # 目次
      section-divider.html       # セクション区切り

      kpi-3col.html              # KPIカード3列
      kpi-2col.html              # KPIカード2列
      kpi-highlight.html         # 数値ハイライト（1~2個の大きな数値）

      chart-bar-dual.html        # 棒グラフ2列（Chart.js）
      chart-bar-single.html      # 棒グラフ1列
      chart-stacked.html         # 100%積み上げバー
      chart-line.html            # 折れ線グラフ
      chart-pie.html             # 円グラフ

      table-comparison.html      # テーブル: 比較（Before/After）
      table-data.html            # テーブル: データ一覧

      text-review.html           # 振り返り（方針+実績ボックス）
      text-2col.html             # 2列比較テキスト
      text-bullet.html           # 箇条書き＋ビジュアル

      flow-diagram.html          # フローチャート
      timeline.html              # タイムライン

      closing.html               # まとめ/次のステップ

    themes/                      # カラーテーマ
      corporate-blue.css
      midnight.css
      forest-green.css

    examples/                    # 完成品サンプル
      mercari-style-full.html    # メルカリ風10枚セット
```

### 14.5 テンプレートの設計原則

各テンプレートが満たすべき条件:

1. **そのまま表示して崩れない**: 全テキストがダミーデータ入りで、ブラウザ表示が確認済み
2. **データ置換ポイントが明確**: `{{TITLE}}`, `{{VALUE_1}}` 等のプレースホルダー
3. **文字数制限が明記**: 各テキスト領域の最大文字数をコメントで記載
4. **余白が十分**: メルカリ資料の実測値（padding 100-120px、要素間40px+）を反映
5. **Chart.js統合**: グラフはChart.jsに配列を渡す方式（CSS自作グラフは廃止）
6. **サイドラベルなし**: 重なりリスクを排除（必要なら余白を十分に確保した版を別途用意）

### 14.6 SKILL.mdのワークフロー（改訂版）

```
1. ユーザーの要件を聞く（内容、枚数、トーン）
2. テーマを選択（corporate-blue 等）
3. 各スライドにテンプレートを割り当てる:
   - スライド1: title-gradient.html
   - スライド2: toc.html（4枚以上の場合）
   - スライド3: section-divider.html
   - スライド4: kpi-3col.html
   - スライド5: chart-bar-dual.html
   - ...
4. _base.html にテンプレートを順番に結合
5. プレースホルダーにデータを注入
6. ブラウザで表示確認（QA）
7. 微調整して納品
```

### 14.7 「メルカリ品質」に到達できるか？

**結論: HTMLアプローチ自体は正しい。問題はスキルの構造。**

今回のプロトタイプで、棒グラフ・KPIカード・テーブルがブラウザで
正しくレンダリングされることは確認できた。品質の差は:

- ✅ レンダリングエンジン → ブラウザは十分高品質
- ✅ カラー/タイポグラフィ → CSS変数で正確に制御可能
- ❌ レイアウトの微調整 → AIの自由組み合わせでは精度が出ない
- ❌ 余白・テキスト量の制御 → テンプレートで固定すべき

つまり **「テンプレートの品質 = 最終出力の品質」** となるよう、
スキルをテンプレートベースに再設計すれば、メルカリ品質に到達可能。

---

## 15. 自己改善機構（Autoresearch統合）

### 15.1 概要

Andrej Karpathyの「autoresearch」手法をスキルに組み込む。
スキル自身がテスト生成→品質スコアリング→プロンプト改善→再テストのループを
自律的に回し、人手なしでスライド品質を継続的に引き上げる。

```
┌─────────────────────────────────────────────────┐
│  Autoresearch ループ                              │
│                                                   │
│  [1. テスト入力]                                   │
│       │                                           │
│       ▼                                           │
│  [2. スキルでスライド生成]                           │
│       │                                           │
│       ▼                                           │
│  [3. チェックリストで自動スコアリング]                  │
│       │                                           │
│       ├── 95%以上 × 3回連続 → 終了（改善版を保存）   │
│       │                                           │
│       ▼                                           │
│  [4. 最も失敗率の高い項目を特定]                      │
│       │                                           │
│       ▼                                           │
│  [5. SKILL.md / テンプレートに1箇所だけ変更]          │
│       │                                           │
│       ▼                                           │
│  [6. 再生成＆再スコアリング]                         │
│       │                                           │
│       ├── スコア向上 → 変更を保持、[1]に戻る        │
│       └── スコア低下 → 変更を取り消し、[4]に戻る    │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 15.2 品質チェックリスト（スライド用）

autoresearchの核心は「何が良いかを明確なYes/No質問で定義する」こと。
HTMLスライドスキルでは以下のチェックリストを使用する。

#### A. 構造チェック（HTML/CSSの正しさ）

| # | チェック項目 | 検証方法 |
|---|-----------|---------|
| A1 | 全スライドが1920x1080px内に収まり、要素のはみ出しがないか | JSでboundingRectを取得し、スライド領域外の要素を検出 |
| A2 | テキストの重なりがないか | 全テキスト要素のboundingRectを総当たり比較し、overlap検出 |
| A3 | フォントサイズが14px以上か（脚注除く） | DOMの全テキストノードのcomputed font-sizeをチェック |
| A4 | ナビゲーション（キーボード矢印）が全スライドで動作するか | JSで自動操作し、activeクラスの遷移を確認 |

#### B. デザインチェック（メルカリ品質基準）

| # | チェック項目 | 検証方法 |
|---|-----------|---------|
| B1 | 各スライドの左右パディングが100px以上あるか | computed style取得 |
| B2 | タイトルと本文の間に40px以上のマージンがあるか | ヘッダー要素と次の兄弟要素の間隔を計算 |
| B3 | テキストのみ（視覚要素なし）のスライドがないか | 各スライド内にimg/svg/canvas/chart/kpi-card等の要素が最低1つ存在するか |
| B4 | 同じレイアウトパターンが3枚以上連続していないか | 各スライドのDOM構造のハッシュを比較 |
| B5 | カラーパレットが3色+1アクセント以内か | 使用色を抽出し、テーマカラー以外の色が混入していないか |

#### C. コンテンツチェック（情報の質）

| # | チェック項目 | 検証方法 |
|---|-----------|---------|
| C1 | KPI数値のフォントサイズが48px以上か | .kpi-number等のcomputed font-size |
| C2 | グラフにデータラベルが表示されているか | Chart.jsのdatalabelsプラグイン有効化チェック |
| C3 | 脚注/出典がデータスライドに付記されているか | .slide-footer__notes内のテキスト長 > 0 |
| C4 | 全スライドにページ番号があるか（タイトル・区切りスライド除く） | .slide-footer__page要素の存在 |

### 15.3 自動スコアリングの実装

チェックリストの検証をブラウザ内JSで自動実行するスクリプトを、
生成されるHTMLの末尾に埋め込む。

```javascript
// ==== Autoresearch QAスクリプト ====
// URLパラメータ ?qa=true で起動
if (new URLSearchParams(location.search).get('qa') === 'true') {
  const results = [];
  const slides = document.querySelectorAll('.slide');

  slides.forEach((slide, i) => {
    slide.classList.add('active');  // 表示状態にして計測

    // A1: はみ出し検出
    const slideRect = slide.getBoundingClientRect();
    const children = slide.querySelectorAll('*');
    let overflow = false;
    children.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > slideRect.right + 2 || r.bottom > slideRect.bottom + 2) {
        overflow = true;
      }
    });
    results.push({ slide: i+1, check: 'A1_no_overflow', pass: !overflow });

    // A2: テキスト重なり検出
    const textEls = slide.querySelectorAll('h1,h2,h3,p,span,td,th,div');
    let overlap = false;
    const rects = [];
    textEls.forEach(el => {
      if (el.textContent.trim().length > 0 && el.children.length === 0) {
        rects.push(el.getBoundingClientRect());
      }
    });
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        if (rectsOverlap(rects[a], rects[b])) { overlap = true; break; }
      }
      if (overlap) break;
    }
    results.push({ slide: i+1, check: 'A2_no_text_overlap', pass: !overlap });

    // B1: 左右パディング100px以上
    const cs = getComputedStyle(slide);
    const pl = parseFloat(cs.paddingLeft);
    const pr = parseFloat(cs.paddingRight);
    results.push({ slide: i+1, check: 'B1_padding_100px', pass: pl >= 100 && pr >= 100 });

    // B3: テキストのみスライドでないか
    const hasVisual = slide.querySelector(
      'img, svg, canvas, .kpi-card, .bar-chart, .chart-container, table, .gradient-art, .comparison-grid'
    );
    const isStructural = slide.id && (
      slide.id.includes('slide-1') || // タイトル
      slide.querySelector('.toc-list') || // 目次
      slide.style.display === 'flex' // セクション区切り
    );
    results.push({
      slide: i+1,
      check: 'B3_has_visual',
      pass: !!hasVisual || isStructural
    });

    slide.classList.remove('active');
  });

  // スコア算出
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const score = Math.round(passed / total * 100);

  // 結果をconsoleに出力（Puppeteer/Playwrightで取得可能）
  console.log(JSON.stringify({ score, total, passed, results }));

  // 画面にも表示
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#111;color:#fff;padding:20px;z-index:9999;font-family:monospace;';
  panel.innerHTML = '<h2>QA Score: ' + score + '% (' + passed + '/' + total + ')</h2>' +
    results.filter(r => !r.pass).map(r =>
      '<div style="color:#FF4757">✗ Slide ' + r.slide + ': ' + r.check + '</div>'
    ).join('');
  document.body.prepend(panel);

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
}
```

### 15.4 改善ループの実行方法

```
ユーザー: 「html-slideスキルのautoresearchを実行して」

エージェントの動作:
1. テスト入力を準備（3種: IR資料、営業提案、プロジェクト報告）
2. 現在のスキルでHTMLスライドを生成（3セット）
3. ?qa=true でブラウザ実行し、スコアを取得
4. ベースラインスコアを記録（例: 62%）
5. 最も失敗率の高いチェック項目を特定
   （例: B1_padding_100px が全スライドで失敗）
6. SKILL.mdまたはテンプレートに1箇所変更
   （例: padding: 80px → padding: 120px）
7. 再生成＆再スコアリング
8. スコア比較:
   - 62% → 71% → 変更を保持
   - 62% → 58% → 変更を取り消し
9. 次の失敗項目へ。ループ継続。
10. 95%以上 × 3回連続 で終了。改善版を保存。
```

### 15.5 改善対象とスコープ

autoresearchループが変更できる範囲を明確に定義する。

| 変更対象 | 例 | リスク |
|---------|---|-------|
| SKILL.mdのデザインルール | 「padding 80px」→「padding 120px」 | 低（テキスト指示の変更） |
| SKILL.mdの禁止事項追加 | 「テキストのみスライド禁止」ルール追加 | 低 |
| テンプレートのCSS値 | `.slide { padding: 120px }` | 中（他要素に波及する可能性） |
| テンプレートのHTML構造 | KPIカードのマークアップ変更 | 高（大幅な変更は禁止） |
| ナビゲーションJS | 変更禁止（機能は安定しているため） | — |
| チェックリスト自体 | 変更禁止（基準がブレるため） | — |

**ルール: 1回のループで変更は1箇所のみ。複数同時変更は禁止。**

### 15.6 変更ログの構造

各ループの結果を記録し、何が効果的で何が効果的でないかの知識を蓄積する。

```json
{
  "autoresearch_log": [
    {
      "round": 1,
      "baseline_score": 62,
      "target_check": "B1_padding_100px",
      "change": {
        "file": "SKILL.md",
        "section": "デザインルール",
        "before": "padding: 80px",
        "after": "padding: 120px"
      },
      "new_score": 71,
      "kept": true,
      "reasoning": "全スライドのB1チェックが失敗→パディング不足が原因"
    },
    {
      "round": 2,
      "baseline_score": 71,
      "target_check": "A2_no_text_overlap",
      "change": {
        "file": "templates/chart-bar-dual.html",
        "section": ".bar-chart height",
        "before": "height: 320px",
        "after": "height: 280px"
      },
      "new_score": 79,
      "kept": true,
      "reasoning": "スライド6でX軸ラベルがはみ出し→チャート高さを縮小"
    }
  ]
}
```

### 15.7 スキルフォルダ構成（autoresearch統合版）

```
skills/
  html-slide/
    SKILL.md                     # スキル定義（autoresearchで自動改善される）
    SKILL.md.backup              # autoresearch前のバックアップ

    design-system.css
    navigation.js

    templates/
      _base.html
      title-gradient.html
      kpi-3col.html
      chart-bar-dual.html
      table-comparison.html
      ... （他テンプレート）

    qa/
      checklist.json             # 品質チェックリスト定義
      qa-runner.js               # ブラウザ内自動スコアリングスクリプト
      autoresearch-log.json      # 改善ログ（知識蓄積）
      baseline-scores.json       # テスト入力ごとのベースラインスコア

    test-inputs/
      ir-presentation.json       # テスト入力: IR資料
      sales-proposal.json        # テスト入力: 営業提案
      project-report.json        # テスト入力: プロジェクト報告

    themes/
      corporate-blue.css
      midnight.css

    examples/
      mercari-style-full.html
```

### 15.8 テスト入力の定義

autoresearchの再現性を保つため、テスト入力を固定する。

```json
// test-inputs/ir-presentation.json
{
  "title": "FY2026.6 1Q 決算説明資料",
  "audience": "投資家・アナリスト",
  "slide_count": 8,
  "theme": "corporate-blue",
  "content": {
    "company": "サンプル株式会社",
    "metrics": {
      "revenue": { "value": "568億円", "yoy": "+15%" },
      "operating_profit": { "value": "109億円", "yoy": "+54%" },
      "segments": [
        { "name": "Marketplace", "gmv": "3,291億円", "profit": "106億円" },
        { "name": "Fintech", "balance": "3,007億円", "profit": "18億円" },
        { "name": "US", "gmv": "$196M", "profit": "6億円" }
      ]
    },
    "quarterly_data": {
      "revenue": [442, 481, 484, 465, 449, 492, 499, 485, 494, 568],
      "profit": [47, 39, 47, 54, 40, 70, 88, 75, 93, 109]
    },
    "guidance_revision": {
      "before": { "revenue": "2,000-2,100億円", "profit": "280-320億円" },
      "after": { "revenue": "2,100-2,200億円", "profit": "320-360億円" }
    }
  }
}
```

### 15.9 ダッシュボード

autoresearch実行中の進捗をリアルタイムで表示するHTMLダッシュボードを
自動生成する。Chart.jsでスコア推移を可視化。

```
┌──────────────────────────────────────────┐
│  Autoresearch Dashboard                   │
│  Skill: html-slide                        │
│  Status: Running (Round 4/∞)             │
│                                           │
│  Score: ████████████░░░ 79% (+17 from BL) │
│                                           │
│  ┌─ Score History ─────────────────────┐  │
│  │  100│                               │  │
│  │   80│          ●───●                │  │
│  │   60│  ●───●──●                     │  │
│  │   40│                               │  │
│  │   20│                               │  │
│  │    0└──────────────────────          │  │
│  │     R1  R2  R3  R4                  │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─ Check Pass Rates ─────────────────┐   │
│  │  A1_no_overflow        ████████ 100%│  │
│  │  A2_no_text_overlap    ██████░░  75%│  │
│  │  B1_padding_100px      ████████ 100%│  │
│  │  B3_has_visual         ██████░░  75%│  │
│  │  C1_kpi_font_48px      ████░░░░  50%│  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─ Change Log ───────────────────────┐   │
│  │  R1: padding 80→120px     ✓ kept   │  │
│  │  R2: chart height 320→280 ✓ kept   │  │
│  │  R3: table col-width 140→200 ✓ kept│  │
│  │  R4: add visual rule     → testing │  │
│  └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 15.10 autoresearchの終了条件とアウトプット

**終了条件:**
- 95%以上のスコアを3回連続で達成
- または、手動停止

**アウトプット:**
1. `SKILL.md` — 改善版（元はbackupに保存）
2. `templates/*.html` — 改善されたテンプレート群
3. `qa/autoresearch-log.json` — 全ラウンドの変更ログ
4. `qa/final-report.md` — サマリーレポート（スコア推移、有効だった変更、効果がなかった変更）

**知識の蓄積:**
変更ログは次回のautoresearchや、モデルアップグレード時に引き継がれる。
新しいモデルが登場した場合、ログを読み込ませて「前回の改善からの継続」が可能。

---

## 16. 統合アーキテクチャ（最終版）

### 16.1 全体像

```
html-slide スキル
  │
  ├── [通常モード] ユーザーリクエスト → テンプレート選択 → データ注入 → HTML出力
  │
  └── [改善モード] autoresearch起動 → テスト生成 → スコアリング → 改善ループ
       │
       ├── SKILL.mdの指示文を微調整
       ├── テンプレートのCSS値を調整
       └── 変更ログに記録 → 次回に知識を引き継ぎ
```

### 16.2 2つのモード

| モード | トリガー | 動作 |
|--------|---------|------|
| 生成モード | 「スライドを作って」「HTML資料を作成」 | テンプレート選択→データ注入→HTML出力 |
| 改善モード | 「スキルのautoresearchを実行」「スライドスキルを改善して」 | テスト生成→スコアリング→ループ改善 |

---

## 17. 次のアクション

1. **テンプレート群をブラウザQA済みで作成** — まずは5種（タイトル、KPI、棒グラフ、テーブル、テキスト）
2. **qa-runner.jsの実装** — チェックリストの自動スコアリングスクリプト
3. **checklist.jsonの確定** — 上記15.2のチェック項目をJSON化
4. **テスト入力3セットの作成** — IR、営業、プロジェクト報告
5. **SKILL.mdの正式版を記述** — 生成モード＋改善モードの両方に対応
6. **autoresearchを1回実行し、改善ループを検証**

---

*設計: 2026-03-19 / 改訂v2: 2026-03-19（autoresearch統合）/ 池田計画事務所*
