#!/usr/bin/env node
// ============================================================
// 日刊競馬POG 指名馬ランキング取得スクリプト
//
// Usage:
//   node tools/fetch-nikkan-ranking.js              # 全20ページ取得
//   node tools/fetch-nikkan-ranking.js --pages 5    # 5ページまで取得
//   node tools/fetch-nikkan-ranking.js --out json    # JSON出力
//   node tools/fetch-nikkan-ranking.js --out tsv     # TSV出力（デフォルト）
//
// 出力ファイル: tools/nikkan-ranking.json / tools/nikkan-ranking.tsv
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'https://www.nikkankeiba.com/pog2026/index.php';
const DEFAULT_MAX_PAGES = 20;
const DELAY_MS = 500; // ページ間の待機時間（ms）

// --- 引数パース ---
const args = process.argv.slice(2);
let maxPages = DEFAULT_MAX_PAGES;
let outputFormat = 'tsv';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pages' && args[i + 1]) maxPages = parseInt(args[i + 1]) || DEFAULT_MAX_PAGES;
  if (args[i] === '--out' && args[i + 1]) outputFormat = args[i + 1];
}

// --- ページ取得（curl + iconv でEUC-JP→UTF-8） ---
function fetchPage(page) {
  const url = `${BASE_URL}?func=ranking_horse&kwd_horse=&page=${page}`;
  try {
    const html = execSync(
      `curl -s '${url}' | iconv -f EUC-JP -t UTF-8 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    );
    return html;
  } catch (e) {
    console.error(`  ページ ${page} の取得に失敗: ${e.message}`);
    return '';
  }
}

// --- HTML パース ---
function parsePage(html) {
  const results = [];

  // <tr> 単位で分割
  const trPattern = /<tr[^>]*>([\s\S]*?)(?=<tr|$)/gi;
  let trMatch;

  while ((trMatch = trPattern.exec(html)) !== null) {
    const row = trMatch[1];

    // netkeiba リンクがある行のみ対象
    const linkMatch = row.match(/db\.netkeiba\.com\/horse\/(\d+)/);
    if (!linkMatch) continue;
    const regNum = linkMatch[1];

    // 各セルを抽出
    const cells = {};
    const tdPattern = /<td\s+class="(\w+)"[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdPattern.exec(row)) !== null) {
      const className = tdMatch[1];
      const content = tdMatch[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
      // shimei が2回出現するため最初の値（指名者数）だけ取る
      if (!cells[className]) cells[className] = content;
    }

    // bamei セル内のリンクテキストから馬名を取得
    const nameMatch = row.match(/<td\s+class="bamei"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const horseName = nameMatch ? nameMatch[1].trim() : cells.bamei || '';

    const rank = parseInt(cells.rank) || 0;
    const nominees = parseInt(cells.shimei) || 0;
    const gender = cells.rank2 || ''; // 性別も rank クラスで2番目

    // 性別は rank クラスの <td> が2つあるので、別途取得
    const genderMatch = row.match(/<td\s+class="rank"[^>]*>[^<]*<\/td>[\s\S]*?<td\s+class="rank"[^>]*>([^<]*)<\/td>/i);
    const genderVal = genderMatch ? genderMatch[1].trim() : '';

    const trainer = cells.kyusha || '';

    if (rank > 0 && regNum) {
      results.push({
        rank,
        regNum,
        horseName,
        gender: genderVal,
        trainer,
        nominees,
      });
    }
  }

  return results;
}

// --- メイン処理 ---
async function main() {
  console.log(`日刊競馬POG 指名馬ランキング取得`);
  console.log(`  最大ページ数: ${maxPages}`);
  console.log(`  出力形式: ${outputFormat}`);
  console.log('');

  const allResults = [];

  for (let page = 1; page <= maxPages; page++) {
    process.stdout.write(`  ページ ${page}/${maxPages} を取得中...`);
    const html = fetchPage(page);

    if (!html) {
      console.log(' スキップ');
      continue;
    }

    const results = parsePage(html);
    if (results.length === 0) {
      console.log(' データなし（終了）');
      break;
    }

    allResults.push(...results);
    console.log(` ${results.length}件 (累計 ${allResults.length}件)`);

    // 最終ページでなければ待機
    if (page < maxPages) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (allResults.length === 0) {
    console.log('\nデータが取得できませんでした。');
    process.exit(1);
  }

  // --- 出力 ---
  const outDir = path.dirname(__filename || __dirname);
  const toolsDir = path.resolve(__dirname);

  // JSON
  const jsonPath = path.join(toolsDir, 'nikkan-ranking.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n  JSON → ${jsonPath}`);

  // TSV
  const tsvHeader = '順位\t登録番号\t馬名\t性別\t厩舎\t指名者数';
  const tsvRows = allResults.map((r) =>
    `${r.rank}\t${r.regNum}\t${r.horseName}\t${r.gender}\t${r.trainer}\t${r.nominees}`
  );
  const tsvContent = [tsvHeader, ...tsvRows].join('\n');
  const tsvPath = path.join(toolsDir, 'nikkan-ranking.tsv');
  fs.writeFileSync(tsvPath, tsvContent, 'utf-8');
  console.log(`  TSV  → ${tsvPath}`);

  // サマリー
  console.log(`\n  合計: ${allResults.length}頭`);
  console.log(`  順位: ${allResults[0].rank}位 〜 ${allResults[allResults.length - 1].rank}位`);
  console.log(`  指名者数: ${allResults[0].nominees} 〜 ${allResults[allResults.length - 1].nominees}`);
  console.log(`\n  上位5頭:`);
  allResults.slice(0, 5).forEach((r) => {
    console.log(`    ${r.rank}位  ${r.horseName}（${r.gender}）  指名${r.nominees}人  ${r.trainer}`);
  });
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
