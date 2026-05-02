// 指名結果発表画面 — v2 フルスクリーン + 管理者フッター
import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import ParticipantCard from '../components/ParticipantCard';
import ConfirmModal from '../components/ConfirmModal';
import RevealSpotlight from '../components/RevealSpotlight';
import { speak } from '../utils/announceReveal';
import { useDraftState } from '../hooks/useDraftState';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import {
  revealNomination, revealAllNominations, setPhase,
  runLottery, manualLottery, confirmRound, advanceRound,
} from '../services/draftService';
import './DraftResultPage.css';

export default function DraftResultPage() {
  const { isAdmin } = useAuth();
  const { currentSeasonId } = useSeason();
  const {
    draftSettings, currentRoundStatuses, draftUsers,
    getConflicts, loading, fixedResults, allNominated,
  } = useDraftState();

  const [lotteryResult, setLotteryResult] = useState(null);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [activeLottery, setActiveLottery] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [roundTransition, setRoundTransition] = useState(null);

  // スポットライト演出（「次を公開」での1件発表時のみ）
  const [pendingReveals, setPendingReveals] = useState([]);
  const [activeReveal, setActiveReveal] = useState(null);
  const prevRevealedIdsRef = useRef(null); // null = 初回スキップ用
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('revealMuted') === '1'; } catch { return false; }
  });
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem('revealMuted', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  const currentRound = draftSettings?.currentRound || 1;
  const phase = draftSettings?.phase || 'waiting';
  const conflicts = getConflicts();
  const maxRounds = draftSettings?.maxRounds || 10;
  const participantCount = draftUsers.length;

  // トランジション自動消去
  useEffect(() => {
    if (!roundTransition) return;
    const nextTimer = setTimeout(() => {
      setRoundTransition((prev) => prev ? { ...prev, phase: 'next' } : null);
    }, 1000);
    const clearTimer = setTimeout(() => {
      setRoundTransition(null);
    }, 3000);
    return () => { clearTimeout(nextTimer); clearTimeout(clearTimer); };
  }, [roundTransition?.fromRound]);

  // 単発の reveal を検知 → スポットライトキューに積む（一括公開は除外）
  useEffect(() => {
    const currentIds = new Set(currentRoundStatuses.filter((s) => s.isRevealed).map((s) => s.id));
    if (prevRevealedIdsRef.current === null) {
      // 初回ロード（既存の reveal は演出しない）
      prevRevealedIdsRef.current = currentIds;
      return;
    }
    const newlyRevealedIds = [...currentIds].filter((id) => !prevRevealedIdsRef.current.has(id));
    if (newlyRevealedIds.length === 1) {
      const newStatus = currentRoundStatuses.find((s) => s.id === newlyRevealedIds[0]);
      if (newStatus) {
        setPendingReveals((prev) => [...prev, newStatus]);
      }
    }
    // 一括公開（newlyRevealedIds.length >= 2）の場合はスキップ
    prevRevealedIdsRef.current = currentIds;
  }, [currentRoundStatuses]);

  // キューから順番にスポットライト表示
  useEffect(() => {
    if (!activeReveal && pendingReveals.length > 0) {
      setActiveReveal(pendingReveals[0]);
      setPendingReveals((prev) => prev.slice(1));
    }
  }, [activeReveal, pendingReveals]);

  const handleSpotlightDone = () => setActiveReveal(null);

  // 巡目確定 / 全員指名完了の読み上げ
  const prevRoundRef = useRef(null);
  const prevPhaseRef = useRef(null);
  const prevAllNominatedRef = useRef(null);
  const roundSpeechCancelRef = useRef(null);
  useEffect(() => {
    if (prevRoundRef.current === null) {
      // 初回ロード: 既存の状態は読み上げない
      prevRoundRef.current = currentRound;
      prevPhaseRef.current = phase;
      return;
    }
    const prevRound = prevRoundRef.current;
    const prevPhase = prevPhaseRef.current;

    let text = null;
    if (currentRound > prevRound) {
      // 通常の巡目進行
      text = `${prevRound}巡目を確定しました。次は${currentRound}巡目の指名です。`;
    } else if (phase === 'completed' && prevPhase !== 'completed') {
      // 最終巡確定（全巡完了）
      text = `${currentRound}巡目を確定しました。全巡完了です。`;
    }
    // 音声は管理者画面でのみ再生（一堂に介して実施するため、参加者端末では再生しない）
    if (text && !muted && isAdmin) {
      if (roundSpeechCancelRef.current) roundSpeechCancelRef.current();
      roundSpeechCancelRef.current = speak(text);
    }
    prevRoundRef.current = currentRound;
    prevPhaseRef.current = phase;
  }, [currentRound, phase, muted, isAdmin]);
  useEffect(() => {
    return () => {
      if (roundSpeechCancelRef.current) roundSpeechCancelRef.current();
    };
  }, []);

  // 全員の指名が完了したタイミングの読み上げ
  useEffect(() => {
    if (prevAllNominatedRef.current === null) {
      // 初回ロード: 既存状態は読み上げない
      prevAllNominatedRef.current = allNominated;
      return;
    }
    // false → true への遷移を検知
    if (allNominated && !prevAllNominatedRef.current) {
      if (!muted && isAdmin) {
        if (roundSpeechCancelRef.current) roundSpeechCancelRef.current();
        roundSpeechCancelRef.current = speak('参加者全員の指名が完了しました。');
      }
    }
    prevAllNominatedRef.current = allNominated;
  }, [allNominated, muted, isAdmin]);
  const activeRevealUser = activeReveal
    ? draftUsers.find((u) => u.id === activeReveal.nominatedBy)
    : null;

  const getParticipantNomination = (userId) => {
    return currentRoundStatuses.find((s) => s.nominatedBy === userId);
  };

  const handleRevealNext = async () => {
    const unrevealed = currentRoundStatuses.find((s) => !s.isRevealed);
    if (unrevealed) await revealNomination(currentSeasonId, unrevealed.id);
  };

  const handleRevealAll = async () => {
    await revealAllNominations(currentSeasonId);
    await setPhase(currentSeasonId, 'revealing');
  };

  const handleStartLottery = (conflict) => {
    setActiveLottery(conflict);
    setShowLotteryModal(true);
    setLotteryResult(null);
  };

  const handleRunLottery = async () => {
    if (!activeLottery) return;
    setProcessing(true);
    try {
      const winner = await runLottery(currentSeasonId, activeLottery.umaId, activeLottery.nominations);
      const winnerUser = draftUsers.find((u) => u.id === winner.nominatedBy);
      setLotteryResult({ winnerName: winnerUser?.nickname || '???', horseName: activeLottery.horseName });
    } catch (error) { console.error('抽選エラー:', error); }
    finally { setProcessing(false); }
  };

  const handleConfirmRound = async () => {
    setProcessing(true);
    try {
      const confirmedStatuses = currentRoundStatuses.filter((s) => s.isRevealed && s.status !== 'rejected');
      const isLastRound = currentRound >= maxRounds;
      setRoundTransition({ fromRound: currentRound, toRound: isLastRound ? null : currentRound + 1, isComplete: isLastRound, phase: 'confirmed' });
      await confirmRound(currentSeasonId, confirmedStatuses, draftUsers);
      await advanceRound(currentSeasonId, currentRound, maxRounds);
    } catch (error) { console.error('確定エラー:', error); setRoundTransition(null); }
    finally { setProcessing(false); }
  };

  const allRevealed = currentRoundStatuses.length > 0 && currentRoundStatuses.every((s) => s.isRevealed);
  const allConflictsResolved = conflicts.length === 0;

  // 参加人数に応じたサイズクラス
  const sizeClass = participantCount <= 4 ? 'size-xl' : participantCount <= 6 ? 'size-lg' : participantCount <= 8 ? 'size-md' : 'size-sm';

  if (loading) {
    return (<><Header /><main className="dr-page"><div className="v2-empty">読み込み中...</div></main></>);
  }

  return (
    <>
      <Header />
      <main className="dr-page">
        {/* ラウンドヘッダー */}
        <div className="dr-round-header">
          <span className="dr-round-badge">{currentRound}巡目</span>
          <span className="dr-round-label">指名結果発表</span>
          <span className="dr-phase-label">
            {phase === 'nominating' && '指名受付中'}
            {phase === 'revealing' && '公開中'}
            {phase === 'renominating' && '再指名中'}
            {phase === 'lottery' && '抽選中'}
            {phase === 'waiting' && '待機中'}
            {phase === 'completed' && 'ドラフト完了'}
          </span>
          {isAdmin && (
            <button
              type="button"
              className="dr-mute-toggle"
              onClick={toggleMuted}
              title={muted ? '発表時の音声を有効化' : '発表時の音声をミュート'}
            >
              {muted ? '🔇 ミュート中' : '🔊 音声ON'}
            </button>
          )}
        </div>

        {/* 参加者グリッド — 画面いっぱい */}
        <div className={`dr-grid ${sizeClass}`}>
          {draftUsers.map((dUser) => {
            const nomination = getParticipantNomination(dUser.id);
            const isConflict = nomination && conflicts.some((c) => c.nominations.some((n) => n.id === nomination.id));
            return (
              <ParticipantCard
                key={dUser.id}
                user={dUser}
                nomination={nomination}
                isRevealed={nomination?.isRevealed || false}
                isConflict={isConflict}
                allRevealed={allRevealed}
              />
            );
          })}
          {draftUsers.length === 0 && (
            <div className="v2-empty" style={{ gridColumn: '1 / -1' }}>参加者がまだ登録されていません</div>
          )}
        </div>
      </main>

      {/* 管理者フッター */}
      {isAdmin && (
        <footer className="dr-admin-footer">
          <div className="dr-footer-inner">
            {/* 指名状況 */}
            <div className="dr-footer-status">
              <span className="dr-footer-round">{currentRound}巡目</span>
              <span className="dr-footer-progress">
                {currentRoundStatuses.length}/{draftUsers.length}人指名
              </span>
              {allNominated
                ? <span className="dr-footer-badge done">全員完了</span>
                : <span className="dr-footer-badge waiting">待機中...</span>}
            </div>

            {/* アクションボタン群 */}
            <div className="dr-footer-actions">
              {/* 公開 */}
              {!allRevealed && currentRoundStatuses.length > 0 && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={handleRevealNext} disabled={!allNominated}>次を公開</button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRevealAll} disabled={!allNominated}>全公開</button>
                </>
              )}

              {/* 競合 */}
              {allRevealed && conflicts.length > 0 && conflicts.map((conflict) => {
                const names = conflict.nominations.map((n) => {
                  const u = draftUsers.find((du) => du.id === n.nominatedBy);
                  return { id: n.id, name: u?.nickname || '???' };
                });
                return (
                  <div key={conflict.umaId} className="dr-footer-conflict">
                    <span className="dr-footer-conflict-label">⚡ {conflict.horseName}:</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleStartLottery(conflict)}>抽選</button>
                    {names.map((c) => (
                      <button key={c.id} className="btn btn-secondary btn-sm" onClick={async () => {
                        setProcessing(true);
                        try {
                          const winner = await manualLottery(currentSeasonId, conflict.umaId, conflict.nominations, c.id);
                          const wu = draftUsers.find((u) => u.id === winner.nominatedBy);
                          setLotteryResult({ winnerName: wu?.nickname || '???', horseName: conflict.horseName });
                          setActiveLottery(conflict); setShowLotteryModal(true);
                        } catch (e) { console.error(e); } finally { setProcessing(false); }
                      }} disabled={processing}>{c.name}</button>
                    ))}
                  </div>
                );
              })}

              {/* 確定 */}
              {allRevealed && allConflictsResolved && currentRoundStatuses.length > 0 && currentRoundStatuses.length >= draftUsers.length && (
                <button className="btn btn-gold btn-lg" onClick={handleConfirmRound} disabled={processing}>
                  {processing ? '処理中...' : `${currentRound}巡目を確定`}
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* 抽選モーダル */}
      <ConfirmModal
        isOpen={showLotteryModal}
        title="抽選"
        onConfirm={lotteryResult ? () => { setShowLotteryModal(false); setLotteryResult(null); } : handleRunLottery}
        onCancel={() => { setShowLotteryModal(false); setLotteryResult(null); }}
        confirmLabel={lotteryResult ? '閉じる' : (processing ? '抽選中...' : '抽選を実行')}
        cancelLabel={lotteryResult ? '' : 'キャンセル'}
      >
        {activeLottery && !lotteryResult && (
          <div className="lottery-info">
            <p className="lottery-horse-name">{activeLottery.horseName}</p>
            <p className="lottery-contestants">
              {activeLottery.nominations.map((n) => draftUsers.find((du) => du.id === n.nominatedBy)?.nickname || '???').join(' vs ')}
            </p>
          </div>
        )}
        {lotteryResult && (
          <div className="lottery-result">
            <div className="lottery-result-icon">🎉</div>
            <p className="lottery-result-text">
              <strong>{lotteryResult.winnerName}</strong> が <strong>{lotteryResult.horseName}</strong> を獲得！
            </p>
          </div>
        )}
      </ConfirmModal>

      {/* 発表スポットライト（音声は管理者画面のみ） */}
      {activeReveal && (
        <RevealSpotlight
          nomination={activeReveal}
          user={activeRevealUser}
          muted={muted || !isAdmin}
          onDone={handleSpotlightDone}
        />
      )}

      {/* トランジション */}
      {roundTransition && (
        <div className={`round-transition-overlay ${roundTransition.phase}`}>
          <div className="round-transition-content">
            {roundTransition.phase === 'confirmed' && (
              <><div className="transition-check">✅</div><div className="transition-message">{roundTransition.fromRound}巡目 確定！</div></>
            )}
            {roundTransition.phase === 'next' && !roundTransition.isComplete && (
              <><div className="transition-round-number">{roundTransition.toRound}巡目</div><div className="transition-message">{roundTransition.toRound}巡目 へ</div></>
            )}
            {roundTransition.phase === 'next' && roundTransition.isComplete && (
              <><div className="transition-trophy">🏆</div><div className="transition-message transition-complete">全巡完了！</div></>
            )}
          </div>
        </div>
      )}
    </>
  );
}
