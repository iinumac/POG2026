// 馬検索カスタムフック
// IndexedDBキャッシュを利用したクライアントサイド検索
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db as firestore } from '../firebase';
import { useSeason } from '../contexts/SeasonContext';
import {
  searchHorses,
  cacheHorses,
  getCachedVersion,
  setCachedVersion,
  getCachedHorseCount,
} from '../services/horseCache';

export function useHorseSearch() {
  const { currentSeasonId } = useSeason();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [cacheLoading, setCacheLoading] = useState(true);
  const debounceRef = useRef(null);

  // キャッシュの初期化・更新チェック
  useEffect(() => {
    const initCache = async () => {
      setCacheLoading(true);
      try {
        // ローカルのキャッシュバージョンを取得
        const localVersion = await getCachedVersion(currentSeasonId);
        const count = await getCachedHorseCount(currentSeasonId);

        // Firestoreからデータバージョンを取得
        let remoteVersion = 0;
        try {
          const settingsRef = doc(
            firestore,
            'seasons', currentSeasonId, 'draft_settings', 'current'
          );
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
            remoteVersion = settingsSnap.data().dataVersion || 0;
          }
        } catch (e) {
          console.warn('Firestore設定取得失敗（オフラインの可能性）:', e.message);
        }

        // キャッシュが空、またはバージョンが異なる場合はFirestoreから全件取得
        if (count === 0 || localVersion !== remoteVersion) {
          console.log(`馬データキャッシュを更新します (local:${localVersion} → remote:${remoteVersion})`);
          await refreshCache();
        } else {
          console.log(`馬データキャッシュ有効 (${count}件, version:${localVersion})`);
          setCacheCount(count);
          setCacheReady(true);
        }
      } catch (error) {
        console.error('キャッシュ初期化エラー:', error);
        // エラーでもキャッシュがあれば使用可能にする
        const count = await getCachedHorseCount(currentSeasonId);
        if (count > 0) {
          setCacheCount(count);
          setCacheReady(true);
        }
      } finally {
        setCacheLoading(false);
      }
    };

    initCache();
  }, [currentSeasonId]);

  // Firestoreから全件取得してキャッシュを更新
  const refreshCache = useCallback(async () => {
    setCacheLoading(true);
    try {
      const horsesRef = collection(
        firestore,
        'seasons', currentSeasonId, 'horses'
      );
      const snapshot = await getDocs(horsesRef);
      const horsesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      await cacheHorses(horsesData, currentSeasonId);

      // バージョンを保存
      try {
        const settingsRef = doc(
          firestore,
          'seasons', currentSeasonId, 'draft_settings', 'current'
        );
        const settingsSnap = await getDoc(settingsRef);
        const version = settingsSnap.exists() ? (settingsSnap.data().dataVersion || 1) : 1;
        await setCachedVersion(currentSeasonId, version);
      } catch {
        await setCachedVersion(currentSeasonId, 1);
      }

      const count = horsesData.length;
      setCacheCount(count);
      setCacheReady(true);
      console.log(`キャッシュ更新完了: ${count}件`);
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
