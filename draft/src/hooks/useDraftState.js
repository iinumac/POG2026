// ドラフト状態管理カスタムフック
// Firestoreのリアルタイムリスナーでドラフト進行状態を同期
import { useState, useEffect, useCallback } from 'react';
import {
  doc, collection, onSnapshot, getDocs, setDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';

export function useDraftState() {
  const { user } = useAuth();
  const { currentSeasonId } = useSeason();
  const [draftSettings, setDraftSettings] = useState(null);
  const [draftStatuses, setDraftStatuses] = useState([]);
  const [fixedResults, setFixedResults] = useState([]);
  const [draftUsers, setDraftUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // パス生成ヘルパー
  const seasonBase = `seasons/${currentSeasonId}`;

  // ドラフト設定のリアルタイム監視
  useEffect(() => {
    const settingsRef = doc(db, `${seasonBase}/draft_settings`, 'current');
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setDraftSettings(snap.data());
      } else {
        setDraftSettings({
          currentRound: 1,
          isRunning: false,
          maxRounds: 10,
          phase: 'waiting',
          pickingOrder: [],
          dataVersion: 1,
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('ドラフト設定リスナーエラー:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [seasonBase]);

  // 現ラウンドの指名状態のリアルタイム監視
  useEffect(() => {
    const statusRef = collection(db, `${seasonBase}/draft_status`);
    const unsubscribe = onSnapshot(statusRef, (snapshot) => {
      const statuses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDraftStatuses(statuses);
    }, (error) => {
      console.error('指名状態リスナーエラー:', error);
    });

    return () => unsubscribe();
  }, [seasonBase]);

  // 確定結果のリアルタイム監視
  useEffect(() => {
    const resultsRef = collection(db, `${seasonBase}/fixed_results`);
    const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
      const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFixedResults(results);
    }, (error) => {
      console.error('確定結果リスナーエラー:', error);
    });

    return () => unsubscribe();
  }, [seasonBase]);

  // ドラフト参加者の監視
  useEffect(() => {
    const usersRef = collection(db, `${seasonBase}/draft_users`);
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const users = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setDraftUsers(users);
    }, (error) => {
      console.error('参加者リスナーエラー:', error);
    });

    return () => unsubscribe();
  }, [seasonBase]);

  // 指名を送信
  const submitNomination = useCallback(async (horse) => {
    if (!user || !draftSettings) return;
    const horseId = horse.登録番号 || horse.id;
    const docId = `${horseId}-${user.uid}`;
    const statusRef = doc(db, `${seasonBase}/draft_status`, docId);
    await setDoc(statusRef, {
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
      nominatedBy: user.uid,
      round: draftSettings.currentRound,
      status: 'nominated',
      isRevealed: false,
      timestamp: new Date(),
    });
  }, [user, draftSettings, seasonBase]);

  // 指名を取り消し（公開前のみ）
  const cancelNomination = useCallback(async () => {
    if (!user || !draftSettings) return;
    // 自分の指名を検索
    const myStatus = draftStatuses.find(
      (s) => s.nominatedBy === user.uid && s.round === draftSettings.currentRound
    );
    if (myStatus && !myStatus.isRevealed) {
      await deleteDoc(doc(db, `${seasonBase}/draft_status`, myStatus.id));
    }
  }, [user, draftSettings, draftStatuses, seasonBase]);

  // 現ラウンドの自分の指名状態を取得
  const myNomination = draftStatuses.find(
    (s) => s.nominatedBy === user?.uid && s.round === draftSettings?.currentRound
  );

  // 現ラウンドの全指名状態
  const currentRoundStatuses = draftStatuses.filter(
    (s) => s.round === draftSettings?.currentRound
  );

  // 全員が指名完了したか
  const allNominated = draftUsers.length > 0 &&
    currentRoundStatuses.length >= draftUsers.length;

  // 指名済みの馬ID一覧（全ラウンド通じて）
  const nominatedHorseIds = new Set(
    fixedResults.map((r) => r.umaId)
  );

  // 競合馬を検出
  const getConflicts = useCallback(() => {
    const horseNominations = {};
    currentRoundStatuses.forEach((s) => {
      if (!horseNominations[s.umaId]) {
        horseNominations[s.umaId] = [];
      }
      horseNominations[s.umaId].push(s);
    });

    return Object.entries(horseNominations)
      .filter(([_, noms]) => noms.length > 1)
      .map(([umaId, noms]) => ({ umaId, horseName: noms[0].horseName, nominations: noms }));
  }, [currentRoundStatuses]);

  // 自分の確定結果を取得
  const myFixedResults = fixedResults
    .filter((r) => r.userId === user?.uid)
    .sort((a, b) => a.round - b.round);

  return {
    draftSettings,
    draftStatuses,
    fixedResults,
    draftUsers,
    loading,
    submitNomination,
    cancelNomination,
    myNomination,
    currentRoundStatuses,
    allNominated,
    nominatedHorseIds,
    getConflicts,
    myFixedResults,
    seasonBase,
  };
}
