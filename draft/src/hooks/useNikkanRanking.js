// 日刊競馬POG ランキングデータ取得フック（管理者のみ）
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';

export function useNikkanRanking() {
  const { isAdmin } = useAuth();
  const { currentSeasonId } = useSeason();
  const [rankingMap, setRankingMap] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      setRankingMap({});
      return;
    }
    const fetchRanking = async () => {
      try {
        const ref = doc(db, `seasons/${currentSeasonId}/external_data`, 'nikkan_ranking');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRankingMap(snap.data().rankings || {});
          setUpdatedAt(snap.data().updatedAt?.toDate?.() || null);
        } else {
          setRankingMap({});
          setUpdatedAt(null);
        }
      } catch (error) {
        console.error('日刊ランキング取得エラー:', error);
      }
    };
    fetchRanking();
  }, [isAdmin, currentSeasonId]);

  // 登録番号からランキング情報を取得
  const getRanking = useCallback((regNum) => {
    if (!regNum || !isAdmin) return null;
    return rankingMap[regNum] || null;
  }, [rankingMap, isAdmin]);

  return { getRanking, updatedAt, hasData: Object.keys(rankingMap).length > 0 };
}
