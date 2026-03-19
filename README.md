# HTML Slide System

メルカリ決算資料品質のHTMLプレゼンテーションスライドを生成するClaude Codeスキル＋自動品質改善基盤。

## Features

- **5種のQA済みテンプレート**: タイトル、KPI、棒グラフ、テーブル、振り返り
- **単一HTMLファイル出力**: CSS/JS全てインライン、外部依存なし
- **ブラウザプレゼン**: 全画面表示、キーボード/タッチ/ホイール操作
- **Chart.js統合**: データラベル付き棒グラフ
- **自動QA**: Puppeteerベース12項目チェック
- **autoresearch**: 自動品質改善ループ（Andrej Karpathy手法）

## Quick Start

### Claude Codeスキルとして使う

```
# このリポジトリをクローン
git clone https://github.com/ikedakeikaku/html-slide-system.git
cd html-slide-system

# Claude Codeで開く
claude

# 「HTMLスライドを作って」と言うだけでスキルが起動
```

Claude Codeが `.claude/skills/html-slide/SKILL.md` を自動検出し、HTMLスライド生成ワークフローをガイドします。

### ビルドスクリプトで生成

```bash
npm install   # Puppeteer (QA用)

# テスト入力からスライドを自動生成
node build-slides.js .claude/skills/html-slide/test-inputs/ir-presentation.json output/ir.html

# ブラウザで開く
open output/ir.html
```

## Templates

| テンプレート | 用途 | プレビュー |
|---|---|---|
| `title-gradient` | タイトル＋グラデーションアート | ロゴ、タイトル、サブタイトル、日付 |
| `kpi-3col` | KPIカード3列＋サマリーバー | セグメント別の主要指標 |
| `chart-bar-dual` | Chart.js棒グラフ2列 | 四半期推移（売上/利益） |
| `table-comparison` | Before/After比較テーブル | 業績予想修正、料金比較 |
| `text-review` | 方針＋実績振り返り | 事業方針＋4カード実績レビュー |

## QA System

### 自動チェック（12項目）

| カテゴリ | チェック |
|---|---|
| 構造 | A1:はみ出し, A2:テキスト重なり, A3:フォント14px+, A4:ナビ動作 |
| デザイン | B1:余白100px+, B2:タイトル間隔40px+, B3:視覚要素, B4:レイアウト多様性 |
| コンテンツ | C1:KPI 48px+, C3:脚注, C4:ページ番号, C5:エスケープ文字 |

### 実行方法

```bash
# ベースラインスコア取得
node autoresearch.js --baseline

# 全スライドのスクリーンショット＋詳細QA
node full-qa.js

# 個別テンプレートのスクリーンショット＋QA
node screenshot-all.js
```

## Autoresearch

[Andrej Karpathyのautoresearch](https://github.com/karpathy/autoresearch)手法をスキル改善に応用。テスト入力からスライドを自動生成→QAスコアリング→改善ループを回す。

### テスト入力（3セット）

| ファイル | 用途 | スライド数 |
|---|---|---|
| `ir-presentation.json` | IR決算説明資料 | 5枚 |
| `sales-proposal.json` | DX導入提案書 | 5枚 |
| `project-report.json` | 月次プロジェクト報告 | 5枚 |

### 改善ログ

`qa/autoresearch-log.json` に全ラウンドの変更と結果を記録。

**Round 1**: Chart.jsラベルの `\n` リテラル表示バグを発見・修正（visual inspection起因）

## Project Structure

```
html-slide-system/
  CLAUDE.md                          # Claude Code設定
  README.md                          # このファイル
  build-slides.js                    # JSON→HTML変換ビルドスクリプト
  autoresearch.js                    # QAスコアリング＋改善ループ
  full-qa.js                         # 全スライド詳細QA
  screenshot-all.js                  # テンプレート個別QA
  .claude/skills/html-slide/
    SKILL.md                         # スキル定義（Claude Code自動検出）
    design-system.css                # CSS変数・共通スタイル
    navigation.js                    # スライドナビゲーション
    templates/                       # QA済みHTMLテンプレート5種
    qa/                              # QAランナー・チェックリスト・改善ログ
    test-inputs/                     # autoresearch用テストデータ3セット
```

## Design Decisions

### v1からv2への転換（設計書 §14.2）
- **v1**: コンポーネント自由組み合わせ → 品質にバラつき
- **v2**: テンプレートベース＋データ注入 → 品質が安定（現在の方式）

### v1問題の解消
- **余白不足** → padding 80px→120px
- **テキスト重なり** → サイドラベル廃止、要素構造整理
- **X軸ラベル切れ** → CSS自作グラフ廃止→Chart.js

## License

MIT
