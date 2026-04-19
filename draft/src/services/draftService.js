// ドラフト管理サービス（管理者用操作）
import {
  doc, setDoc, updateDoc, deleteDoc, getDocs, collection, writeBatch, getDoc,
} from 'firebase/firestore';

import { db } from '../firebase';

/**
 * ドラフト開始 / ラウンド進行
 */
export async function startRound(seasonId, round) {
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  await updateDoc(settingsRef, {
    currentRound: round,
    isRunning: true,
    phase: 'nominating',
  });
}

/**
 * 指名を公開（1件ずつ）
 */
export async function revealNomination(seasonId, statusDocId) {
  const statusRef = doc(db, `seasons/${seasonId}/draft_status`, statusDocId);
  await updateDoc(statusRef, {
    isRevealed: true,
  });
}

/**
 * 全指名を一括公開
 */
export async function revealAllNominations(seasonId) {
  const statusCol = collection(db, `seasons/${seasonId}/draft_status`);
  const snapshot = await getDocs(statusCol);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    if (!d.data().isRevealed) {
      batch.update(d.ref, { isRevealed: true });
    }
  });
  await batch.commit();
}

/**
 * フェーズ変更
 */
export async function setPhase(seasonId, phase) {
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  await updateDoc(settingsRef, { phase });
}

/**
 * 抽選を実行（競合馬の当選者をランダム決定）
 */
export async function runLottery(seasonId, umaId, nominations) {
  const winnerIndex = Math.floor(Math.random() * nominations.length);
  const winner = nominations[winnerIndex];
  const losers = nominations.filter((_, i) => i !== winnerIndex);

  const batch = writeBatch(db);

  // 当選者を confirmed に更新
  const winnerRef = doc(db, `seasons/${seasonId}/draft_status`, winner.id);
  batch.update(winnerRef, { status: 'confirmed' });

  // 落選者を削除
  losers.forEach((loser) => {
    const loserRef = doc(db, `seasons/${seasonId}/draft_status`, loser.id);
    batch.delete(loserRef);
  });

  // 競合相手の削除が完了したら、フェーズを落選再指名中へ
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  batch.update(settingsRef, { phase: 'renominating' });

  await batch.commit();

  return winner;
}

/**
 * 手動抽選（管理者が当選者を選択）
 */
export async function manualLottery(seasonId, umaId, nominations, winnerId) {
  const winner = nominations.find((n) => n.id === winnerId);
  const losers = nominations.filter((n) => n.id !== winnerId);

  if (!winner) throw new Error('当選者が見つかりません');

  const batch = writeBatch(db);

  // 当選者を confirmed に更新
  const winnerRef = doc(db, `seasons/${seasonId}/draft_status`, winner.id);
  batch.update(winnerRef, { status: 'confirmed' });

  // 落選者を削除
  losers.forEach((loser) => {
    const loserRef = doc(db, `seasons/${seasonId}/draft_status`, loser.id);
    batch.delete(loserRef);
  });

  // 落選者が再指名できるようにフェーズを更新
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  batch.update(settingsRef, { phase: 'renominating' });

  await batch.commit();

  return winner;
}

/**
 * ラウンド確定 → fixed_results に保存 → draft_status をクリア
 */
export async function confirmRound(seasonId, confirmedStatuses, draftUsers) {
  const batch = writeBatch(db);

  // fixed_results に保存
  confirmedStatuses.forEach((status) => {
    const resultId = `r${status.round}_${status.nominatedBy}`;
    const resultRef = doc(db, `seasons/${seasonId}/fixed_results`, resultId);
    // 参加者名を取得
    const draftUser = draftUsers.find((u) => u.id === status.nominatedBy);
    batch.set(resultRef, {
      userId: status.nominatedBy,
      nickname: draftUser?.nickname || '',
      umaId: status.umaId,
      horseName: status.horseName,
      fatherName: status.fatherName || '',
      motherName: status.motherName || '',
      motherFatherName: status.motherFatherName || '',
      gender: status.gender || '',
      trainer: status.trainer || '',
      region: status.region || '',
      breeder: status.breeder || '',
      owner: status.owner || '',
      round: status.round,
      confirmedAt: new Date(),
    });
  });

  // draft_status をクリア
  const statusCol = collection(db, `seasons/${seasonId}/draft_status`);
  const statusSnap = await getDocs(statusCol);
  statusSnap.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  await batch.commit();
}

/**
 * 次ラウンドに進行
 */
export async function advanceRound(seasonId, currentRound, maxRounds) {
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  if (currentRound >= maxRounds) {
    // 全ラウンド完了
    await updateDoc(settingsRef, {
      isRunning: false,
      phase: 'completed',
    });
  } else {
    await updateDoc(settingsRef, {
      currentRound: currentRound + 1,
      phase: 'nominating',
    });
  }
}

/**
 * 参加者をドラフトに追加
 */
export async function addDraftUser(seasonId, userProfile, order) {
  const userRef = doc(db, `seasons/${seasonId}/draft_users`, userProfile.uid);
  await setDoc(userRef, {
    nickname: userProfile.nickname,
    avatarColor: userProfile.avatarColor || '#1a6b3c',
    order,
    joinedAt: new Date(),
  });
}

/**
 * 参加者をドラフトから削除
 */
export async function removeDraftUser(seasonId, userId) {
  const userRef = doc(db, `seasons/${seasonId}/draft_users`, userId);
  await deleteDoc(userRef);
}

/**
 * 過去シーズンデータをTSV形式でインポート
 * TSV形式: ユーザー名\t馬名\t母名\t誕生年\tコメント
 * ユーザー名は空行で前の値を引き継ぐ
 */
export async function importHistoricalSeason(seasonId, seasonName, tsvText) {
  const lines = tsvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) throw new Error('データが空です');

  let currentUser = '';
  const userHorses = {}; // { nickname: [{ horseName, motherName, birthYear, comment }] }
  const userOrder = []; // ユーザーの順序を保持

  lines.slice(1).forEach((line) => {
    const cols = line.split('\t');
    const userName = cols[0]?.trim();
    const horseName = cols[1]?.trim();
    const motherName = cols[2]?.trim() || '';
    const birthYear = cols[3]?.trim() || '';
    const comment = cols[4]?.trim() || '';

    if (userName) {
      currentUser = userName;
      if (!userHorses[currentUser]) {
        userHorses[currentUser] = [];
        userOrder.push(currentUser);
      }
    }
    if (!currentUser || !horseName) return;
    userHorses[currentUser].push({ horseName, motherName, birthYear, comment });
  });

  if (userOrder.length === 0) throw new Error('有効なデータが見つかりませんでした');

  const batch = writeBatch(db);

  // シーズン情報を作成
  const seasonInfoRef = doc(db, `seasons/${seasonId}/info`, 'details');
  batch.set(seasonInfoRef, {
    name: seasonName,
    year: parseInt(seasonId),
    status: 'archived',
  });

  // 参加者と指名結果を作成
  userOrder.forEach((nickname, idx) => {
    const userId = nickname; // 過去データはニックネームをIDとして使用
    const userRef = doc(db, `seasons/${seasonId}/draft_users`, userId);
    batch.set(userRef, {
      nickname,
      avatarColor: '#1a6b3c',
      order: idx + 1,
      joinedAt: new Date(),
    });

    userHorses[nickname].forEach((horse, i) => {
      const round = i + 1;
      const resultId = `r${round}_${userId}`;
      const resultRef = doc(db, `seasons/${seasonId}/fixed_results`, resultId);
      batch.set(resultRef, {
        userId,
        nickname,
        umaId: '',
        horseName: horse.horseName,
        fatherName: '',
        motherName: horse.motherName,
        motherFatherName: '',
        gender: '',
        trainer: '',
        region: '',
        breeder: '',
        owner: '',
        round,
        birthYear: horse.birthYear,
        comment: horse.comment,
        confirmedAt: new Date(),
      });
    });
  });

  await batch.commit();

  // app_settings の availableSeasons を更新
  const appSettingsRef = doc(db, 'app_settings', 'config');
  const appSnap = await getDoc(appSettingsRef);
  const currentSeasons = appSnap.exists() ? (appSnap.data().availableSeasons || []) : [];
  if (!currentSeasons.includes(seasonId)) {
    currentSeasons.push(seasonId);
    currentSeasons.sort();
  }
  await setDoc(appSettingsRef, {
    currentSeasonId: appSnap.exists() ? appSnap.data().currentSeasonId : seasonId,
    availableSeasons: currentSeasons,
  }, { merge: true });

  return {
    userCount: userOrder.length,
    horseCount: Object.values(userHorses).reduce((sum, arr) => sum + arr.length, 0),
  };
}

/**
 * ドラフト状態を完全リセット
 */
export async function resetDraft(seasonId) {
  // draft_statusを全削除
  const statusCol = collection(db, `seasons/${seasonId}/draft_status`);
  const statusSnap = await getDocs(statusCol);
  const batch1 = writeBatch(db);
  statusSnap.docs.forEach((d) => batch1.delete(d.ref));
  await batch1.commit();

  // fixed_resultsを全削除
  const resultsCol = collection(db, `seasons/${seasonId}/fixed_results`);
  const resultsSnap = await getDocs(resultsCol);
  const batch2 = writeBatch(db);
  resultsSnap.docs.forEach((d) => batch2.delete(d.ref));
  await batch2.commit();

  // settingsをリセット
  const settingsRef = doc(db, `seasons/${seasonId}/draft_settings`, 'current');
  const settingsSnap = await getDoc(settingsRef);
  await updateDoc(settingsRef, {
    currentRound: 1,
    isRunning: false,
    phase: 'waiting',
    dataVersion: settingsSnap.exists() ? (settingsSnap.data().dataVersion || 1) : 1,
  });
}
