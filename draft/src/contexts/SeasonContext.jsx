// シーズン管理コンテキスト
// アクティブシーズンの切り替え、過去シーズン参照を制御
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { clearSeasonCache } from '../services/horseCache';

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const [currentSeasonId, setCurrentSeasonId] = useState('2026');
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [seasonInfo, setSeasonInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // アプリ起動時にapp_settingsからシーズン情報を取得
  useEffect(() => {
    const fetchSeasonSettings = async () => {
      try {
        const configRef = doc(db, 'app_settings', 'config');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const data = configSnap.data();
          setCurrentSeasonId(data.currentSeasonId || '2026');
          setAvailableSeasons(data.availableSeasons || ['2026']);
        } else {
          // デフォルト設定
          setCurrentSeasonId('2026');
          setAvailableSeasons(['2026']);
        }

        // 現在のシーズン情報を取得
        await fetchSeasonInfo(currentSeasonId);
      } catch (error) {
        console.error('シーズン設定取得エラー:', error);
        // デフォルト値を使用
        setCurrentSeasonId('2026');
        setAvailableSeasons(['2026']);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonSettings();
  }, []);

  // シーズン情報を取得
  const fetchSeasonInfo = async (seasonId) => {
    try {
      const infoRef = doc(db, 'seasons', seasonId, 'info', 'details');
      const infoSnap = await getDoc(infoRef);
      if (infoSnap.exists()) {
        setSeasonInfo(infoSnap.data());
      } else {
        setSeasonInfo({
          name: `鷹燕杯 Season 5`,
          year: 2026,
          status: 'active',
        });
      }
    } catch (error) {
      console.error('シーズン情報取得エラー:', error);
    }
  };

  // シーズン切り替え（旧シーズンのローカルキャッシュをクリア）
  const switchSeason = async (seasonId) => {
    const oldSeasonId = currentSeasonId;
    setCurrentSeasonId(seasonId);
    await fetchSeasonInfo(seasonId);
    // 旧シーズンの馬データキャッシュをクリア（年度内のみ有効）
    if (oldSeasonId && oldSeasonId !== seasonId) {
      await clearSeasonCache(oldSeasonId);
    }
  };

  // 現在のシーズンがアクティブかどうか
  const isActiveSeason = seasonInfo?.status === 'active';

  // Firestoreパスのヘルパー（シーズン配下のパスを生成）
  const seasonPath = (subPath) => `seasons/${currentSeasonId}/${subPath}`;

  const value = {
    currentSeasonId,
    availableSeasons,
    seasonInfo,
    loading,
    switchSeason,
    isActiveSeason,
    seasonPath,
    seasonDisplayName: seasonInfo?.name || `Season ${currentSeasonId}`,
  };

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
}
