// 馬検索カスタムフック
// IndexedDBキャッシュを利用したクライアントサイド検索
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db as firestore } from '../firebase';
import { useSeason } from '../contexts/SeasonContext';
import {
  searchHorses,
  cacheHorses,
} from '../services/horseCache';

export function useHorseSearch() {
  const { currentSeasonId } = useSeason();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [cacheLoading, setCacheLoading] = useState(true);
  const debounceRef = useRef(null);

  // シーズン切替時に検索結果をリセット
  useEffect(() => {
    setResults([]);
    setCacheReady(false);
    setCacheCount(0);
  }, [currentSeasonId]);

  // 起動時に毎回snapshotを取得してキャッシュを上書き
  useEffect(() => {
    refreshCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeasonId]);

  // Firestoreの圧縮スナップショットからキャッシュを更新
  const refreshCache = useCallback(async () => {
    setCacheLoading(true);
    try {
      const snapshotRef = doc(
        firestore,
        'seasons', currentSeasonId, 'snapshots', 'horses'
      );
      const snapshotDoc = await getDoc(snapshotRef);

      if (!snapshotDoc.exists()) {
        console.warn(`スナップショット未登録 (Season: ${currentSeasonId})`);
        setCacheCount(0);
        setCacheReady(true);
        return;
      }

      const compressed = snapshotDoc.data().data.toUint8Array();
      const decompressedStream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
      const json = await new Response(decompressedStream).text();
      const horses = JSON.parse(json);

      // IndexedDBはidをキーにするので登録番号をidとして付与
      const horsesData = horses.map((h) => ({ id: h.登録番号, ...h }));
      await cacheHorses(horsesData, currentSeasonId);

      const count = horsesData.length;
      setCacheCount(count);
      setCacheReady(true);
      console.log(`キャッシュ更新完了: ${count}件 (圧縮 ${compressed.byteLength} bytes)`);
    } catch (error) {
      console.error('キャッシュ更新エラー:', error);
    } finally {
      setCacheLoading(false);
    }
  }, [currentSeasonId]);

  // 検索実行（debounce付き）
  const search = useCallback(
    (query, searchType = 'name') => {
      // 既存のdebounceをキャンセル
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!query || query.trim().length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // 200msのdebounce
      debounceRef.current = setTimeout(async () => {
        try {
          const found = await searchHorses(query, searchType, currentSeasonId, 50);
          setResults(found);
        } catch (error) {
          console.error('検索エラー:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 200);
    },
    [currentSeasonId]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    results,
    loading,
    search,
    cacheReady,
    cacheCount,
    cacheLoading,
    refreshCache,
  };
}
