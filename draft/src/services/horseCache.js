// 馬データのIndexedDBキャッシュサービス
// Dexie.jsを使用してFirestoreの馬データをローカルにキャッシュし、
// 検索をクライアントサイドで完結させる
import Dexie from 'dexie';

/**
 * ひらがな→カタカナ変換（検索用）
 */
function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/**
 * ひらがな・カタカナを区別しない部分一致判定
 */
function kanaIncludes(text, term) {
  return toKatakana(text).includes(toKatakana(term));
}

// IndexedDBデータベース定義
const db = new Dexie('POGDraftDB');
db.version(1).stores({
  // 馬データテーブル: 登録番号をPK、馬名・母名でインデックス
  horses: 'id, 馬名, 母, 父, 性別',
  // メタデータ（バージョン管理など）
  meta: 'key',
});

/**
 * キャッシュされている馬データのバージョンを取得
 */
export async function getCachedVersion(seasonId) {
  try {
    const meta = await db.meta.get(`version_${seasonId}`);
    return meta?.value || 0;
  } catch {
    return 0;
  }
}

/**
 * キャッシュバージョンを保存
 */
export async function setCachedVersion(seasonId, version) {
  await db.meta.put({ key: `version_${seasonId}`, value: version });
}

/**
 * Firestoreから取得した馬データをIndexedDBに一括保存
 * @param {Array} horsesData - Firestoreから取得した馬データ配列
 * @param {string} seasonId - シーズンID
 */
export async function cacheHorses(horsesData, seasonId) {
  // 既存のキャッシュをクリア（シーズン単位で管理）
  await db.horses.where('id').startsWith(`${seasonId}_`).delete();

  // バッチでINSERT
  const records = horsesData.map((horse) => ({
    id: `${seasonId}_${horse.id}`,
    seasonId,
    登録番号: horse.登録番号 || horse.id,
    馬名: horse.馬名 || '',
    性別: horse.性別 || '',
    父: horse.父 || '',
    母: horse.母 || '',
    母父: horse.母父 || '',
    リンク: horse.リンク || '',
    毛色: horse.毛色 || '',
    調教師: horse.調教師 || '',
    東西: horse.東西 || '',
    生産者: horse.生産者 || '',
    馬主: horse.馬主 || '',
    母名生年: horse['(母名+生年)'] || horse.母名生年 || '',
  }));

  // 500件ずつバッチ処理
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    await db.horses.bulkPut(records.slice(i, i + BATCH_SIZE));
  }

  console.log(`IndexedDBに${records.length}件の馬データをキャッシュしました (Season: ${seasonId})`);
}

/**
 * IndexedDBから馬データを検索（クライアントサイド）
 * @param {string} query - 検索クエリ
 * @param {string} searchType - 'name'（馬名）or 'mother'（母名）
 * @param {string} seasonId - シーズンID
 * @param {number} limit - 最大件数
 * @returns {Array} 検索結果
 */
export async function searchHorses(query, searchType = 'name', seasonId = '2026', limit = 50) {
  if (!query || query.trim().length === 0) return [];

  const searchTerm = query.trim();

  try {
    // シーズンに絞ってフィルタ
    const allHorses = await db.horses
      .where('id')
      .startsWith(`${seasonId}_`)
      .toArray();

    // クライアントサイドで部分一致フィルタ（ひらがな⇔カタカナ区別なし）
    const filtered = allHorses.filter((horse) => {
      if (searchType === 'mother') {
        return horse.母 && kanaIncludes(horse.母, searchTerm);
      }
      // 馬名 + 母名生年 + 父 + 母 + 母父で部分一致
      return (
        (horse.馬名 && kanaIncludes(horse.馬名, searchTerm)) ||
        (horse.母名生年 && kanaIncludes(horse.母名生年, searchTerm)) ||
        (horse.父 && kanaIncludes(horse.父, searchTerm)) ||
        (horse.母 && kanaIncludes(horse.母, searchTerm)) ||
        (horse.母父 && kanaIncludes(horse.母父, searchTerm))
      );
    });

    return filtered.slice(0, limit);
  } catch (error) {
    console.error('IndexedDB検索エラー:', error);
    return [];
  }
}

/**
 * IndexedDBから特定の馬データを取得
 */
export async function getHorseById(horseId, seasonId = '2026') {
  try {
    return await db.horses.get(`${seasonId}_${horseId}`);
  } catch {
    return null;
  }
}

/**
 * キャッシュされている馬データの件数を取得
 */
export async function getCachedHorseCount(seasonId) {
  try {
    return await db.horses
      .where('id')
      .startsWith(`${seasonId}_`)
      .count();
  } catch {
    return 0;
  }
}

/**
 * 特定シーズンのキャッシュをクリア
 */
export async function clearSeasonCache(seasonId) {
  try {
    await db.horses.where('id').startsWith(`${seasonId}_`).delete();
    await db.meta.delete(`version_${seasonId}`);
    console.log(`Season ${seasonId} のキャッシュをクリアしました`);
  } catch (error) {
    console.error('シーズンキャッシュクリアエラー:', error);
  }
}

/**
 * 全キャッシュをクリア
 */
export async function clearCache() {
  await db.horses.clear();
  await db.meta.clear();
}

export default db;
