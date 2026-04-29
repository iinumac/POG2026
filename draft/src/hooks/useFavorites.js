// お気に入り管理カスタムフック
import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';

export function useFavorites() {
  const { user } = useAuth();
  const { currentSeasonId } = useSeason();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // お気に入りのFirestoreコレクションパス
  const getFavoritesPath = useCallback(() => {
    return `seasons/${currentSeasonId}/favorites/${user?.uid}/horses`;
  }, [currentSeasonId, user?.uid]);

  // お気に入り一覧を取得
  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const favRef = collection(db, getFavoritesPath());
      const snapshot = await getDocs(favRef);
      const favs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999));
      setFavorites(favs);
    } catch (error) {
      console.error('お気に入り取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getFavoritesPath]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // お気に入り登録
  const addFavorite = useCallback(async (horse) => {
    if (!user) return;
    const horseId = horse.登録番号 || horse.id;
    try {
      const favRef = doc(db, getFavoritesPath(), horseId);
      await setDoc(favRef, {
        umaId: horseId,
        horseName: horse.馬名 || horse.母名生年 || '',
        fatherName: horse.父 || '',
        motherName: horse.母 || '',
        motherFatherName: horse.母父 || '',
        gender: horse.性別 || '',
        trainer: horse.調教師 || '',
        region: horse.東西 || '',
        breeder: horse.生産者 || '',
        owner: horse.馬主 || '',
        memo: '',
        pedigreeGrade: null,
        buildGrade: null,
        growthGrade: null,
        score: null,
        priority: favorites.length + 1,
        addedAt: new Date(),
      });
      await fetchFavorites();
    } catch (error) {
      console.error('お気に入り追加エラー:', error);
    }
  }, [user, getFavoritesPath, favorites.length, fetchFavorites]);

  // お気に入り解除
  const removeFavorite = useCallback(async (horseId) => {
    if (!user) return;
    try {
      const favRef = doc(db, getFavoritesPath(), horseId);
      await deleteDoc(favRef);
      await fetchFavorites();
    } catch (error) {
      console.error('お気に入り削除エラー:', error);
    }
  }, [user, getFavoritesPath, fetchFavorites]);

  // お気に入りのトグル
  const toggleFavorite = useCallback(async (horse) => {
    const horseId = horse.登録番号 || horse.id;
    const isFav = favorites.some((f) => f.umaId === horseId || f.id === horseId);
    if (isFav) {
      await removeFavorite(horseId);
    } else {
      await addFavorite(horse);
    }
  }, [favorites, addFavorite, removeFavorite]);

  // メモ更新
  const updateMemo = useCallback(async (horseId, memo) => {
    if (!user) return;
    try {
      const favRef = doc(db, getFavoritesPath(), horseId);
      await updateDoc(favRef, { memo });
      setFavorites((prev) =>
        prev.map((f) => (f.id === horseId ? { ...f, memo } : f))
      );
    } catch (error) {
      console.error('メモ更新エラー:', error);
    }
  }, [user, getFavoritesPath]);

  // 評価データ更新（グレード・点数・メモ一括）
  const updateEvaluation = useCallback(async (horseId, evalData) => {
    if (!user) return;
    try {
      const favRef = doc(db, getFavoritesPath(), horseId);
      await updateDoc(favRef, evalData);
      setFavorites((prev) =>
        prev.map((f) => (f.id === horseId ? { ...f, ...evalData } : f))
      );
    } catch (error) {
      console.error('評価更新エラー:', error);
    }
  }, [user, getFavoritesPath]);

  // 優先順位更新
  const updatePriority = useCallback(async (reorderedFavorites) => {
    if (!user) return;
    try {
      const updates = reorderedFavorites.map((fav, index) => {
        const favRef = doc(db, getFavoritesPath(), fav.id);
        return updateDoc(favRef, { priority: index + 1 });
      });
      await Promise.all(updates);
      setFavorites(reorderedFavorites.map((f, i) => ({ ...f, priority: i + 1 })));
    } catch (error) {
      console.error('優先順位更新エラー:', error);
    }
  }, [user, getFavoritesPath]);

  // 特定の馬がお気に入りかどうか判定
  const isFavorite = useCallback((horseId) => {
    return favorites.some((f) => f.umaId === horseId || f.id === horseId);
  }, [favorites]);

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    updateMemo,
    updateEvaluation,
    updatePriority,
    isFavorite,
    refreshFavorites: fetchFavorites,
  };
}
