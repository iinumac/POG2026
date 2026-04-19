// 指名結果発表画面
import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import ParticipantCard from '../components/ParticipantCard';
import ConfirmModal from '../components/ConfirmModal';
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

  const currentRound = draftSettings?.currentRound || 1;
  const phase = draftSettings?.phase || 'waiting';
  const conflicts = getConflicts();

  const prevRoundRef = useRef(currentRound);

  // ラウンドが変わったらトランジション終了
  useEffect(() => {
    if (prevRoundRef.current !== currentRound && roundTransition) {
      const timer = setTimeout(() => {
        setRoundTransition((prev) => prev ? { ...prev, phase: 'next' } : null);
      }, 500);
      const clearTimer = setTimeout(() => {
        setRoundTransition(null);
      }, 2500);
      prevRoundRef.current = currentRound;
      return () => { clearTimeout(timer); clearTimeout(clearTimer); };
    }
    prevRoundRef.current = currentRound;
  }, [currentRound, roundTransition]);

  // 各参加者の指名データを取得
  const getParticipantNomination = (userId) => {
    return currentRoundStatuses.find((s) => s.nominatedBy === userId);
  };

  // 管理者: 次の指名を公開
  const handleRevealNext = async () => {
    const unrevealed = currentRoundStatuses.find((s) => !s.isRevealed);
    if (unrevealed) {
      await revealNomination(currentSeasonId, unrevealed.id);
    }
  };

  // 管理者: 全指名を一括公開
  const handleRevealAll = async () => {
    await revealAllNominations(currentSeasonId);
    await setPhase(currentSeasonId, 'revealing');
  };

  // 管理者: 抽選開始
  const handleStartLottery = (conflict) => {
    setActiveLottery(conflict);
    setShowLotteryModal(true);
    setLotteryResult(null);
  };

  // 管理者: 抽選実行
  const handleRunLottery = async () => {
    if (!activeLottery) return;
    setProcessing(true);
    try {
      const winner = await runLottery(
        currentSeasonId,
        activeLottery.umaId,
        activeLottery.nominations
      );
      const winnerUser = draftUsers.find((u) => u.id === winner.nominatedBy);
      setLotteryResult({
        winnerName: winnerUser?.nickname || '???',
        horseName: activeLottery.horseName,
      });
    } catch (error) {
      console.error('抽選エラー:', error);
    } finally {
      setProcessing(false);
    }
  };

  // 管理者: ラウンド確定
  const maxRounds = draftSettings?.maxRounds || 10;
  const handleConfirmRound = async () => {
    setProcessing(true);
    try {
      const confirmedStatuses = currentRoundStatuses.filter(
        (s) => s.isRevealed && s.status !== 'rejected'
      );

      // トランジションアニメーション開始
      const isLastRound = currentRound >= maxRounds;
      setRoundTransition({
        fromRound: currentRound,
        toRound: isLastRound ? null : currentRound + 1,
        isComplete: isLastRound,
        phase: 'confirmed',
      });

      // データ確定処理
      await confirmRound(currentSeasonId, confirmedStatuses, draftUsers);
      await advanceRound(currentSeasonId, currentRound, maxRounds);
    } catch (error) {
      console.error('ラウンド確定エラー:', error);
      setRoundTransition(null);
    } finally {
      setProcessing(false);
    }
  };

  // 全て公開済みか
  const allRevealed = currentRoundStatuses.length > 0 &&
    currentRoundStatuses.every((s) => s.isRevealed);

  // 競合が解決済みか
  const allConflictsResolved = conflicts.length === 0;

  if (loading) {
    return (
      <>
        <Header />
        <main className="page-content">
          <div className="container"><p style={{ textAlign: 'center' }}>読み込み中...</p></div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          {/* ラウンドヘッダー */}
          <div className="result-header">
            <h1 className="result-title">
              <span className="badge badge-round result-round-badge">R{currentRound}</span>
              指名結果発表
            </h1>
            <span className="result-phase-label">
              {phase === 'nominating' && '📝 指名受付中'}
              {phase === 'revealing' && '🎯 公開中'}
              {phase === 'renominating' && '🔄 再指名中'}
              {phase === 'lottery' && '🎰 抽選中'}
              {phase === 'waiting' && '⏸ 待機中'}
              {phase === 'completed' && '🏁 ドラフト完了'}
            </span>
          </div>

          {/* 参加者グリッド */}
          <div className="grid-participants result-grid">
            {draftUsers.map((dUser) => {
              const nomination = getParticipantNomination(dUser.id);
              const isConflict = nomination && conflicts.some(
                (c) => c.nominations.some((n) => n.id === nomination.id)
              );
              return (
                <ParticipantCard
                  key={dUser.id}
                  user={dUser}
                  nomination={nomination}
                  isRevealed={nomination?.isRevealed || false}
                  isConflict={isConflict}
                  compact
                />
              );
            })}
          </div>

          {/* 管理者コントロール */}
          {isAdmin && (
            <div className="admin-controls">
              <h3 className="controls-title">🎛️ 管理者コントロール</h3>

              {/* 指名状況表示 */}
              <div className="nomination-progress">
                <span className="progress-label">指名状況:</span>
                <span className="progress-count">
                  {currentRoundStatuses.length} / {draftUsers.length}人
                </span>
                {allNominated ? (
                  <span className="progress-complete">✅ 全員完了</span>
                ) : (
                  <span className="progress-waiting">⏳ 待機中...</span>
                )}
              </div>

              <div className="controls-actions">
                {/* 公開コントロール */}
                {!allRevealed && currentRoundStatuses.length > 0 && (
                  <div className="control-group">
                    <button
                      className="btn btn-primary"
                      onClick={handleRevealNext}
                      disabled={!allNominated}
                    >
                      次の指名を公開
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleRevealAll}
                      disabled={!allNominated}
                    >
                      全て一括公開
                    </button>
                    {!allNominated && (
                      <p className="control-hint">※ 全参加者の指名が完了するまで公開できません</p>
                    )}
                  </div>
                )}

                {/* 競合処理 */}
                {allRevealed && conflicts.length > 0 && (
                  <div className="control-group">
                    <h4 className="conflict-title">⚡ 競合馬（{conflicts.length}件）</h4>
                    {conflicts.map((conflict) => {
                      const contestantNames = conflict.nominations.map((n) => {
                        const u = draftUsers.find((du) => du.id === n.nominatedBy);
                        return { id: n.id, name: u?.nickname || '???' };
                      });
                      return (
                        <div key={conflict.umaId} className="conflict-item">
                          <div className="conflict-info">
                            <span className="conflict-horse">{conflict.horseName}</span>
                            <span className="conflict-users">
                              ({contestantNames.map((c) => c.name).join(' vs ')})
                            </span>
                          </div>
                          <div className="conflict-actions">
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleStartLottery(conflict)}
                            >
                              🎲 システム抽選
                            </button>
                            {/* 手動抽選: 各参加者をボタンで選択 */}
                            <div className="manual-lottery">
                              <span className="manual-label">手動選択:</span>
                              {contestantNames.map((c) => (
                                <button
                                  key={c.id}
                                  className="btn btn-secondary btn-sm"
                                  onClick={async () => {
                                    setProcessing(true);
                                    try {
                                      const winner = await manualLottery(
                                        currentSeasonId, conflict.umaId, conflict.nominations, c.id
                                      );
                                      const winnerUser = draftUsers.find((u) => u.id === winner.nominatedBy);
                                      setLotteryResult({
                                        winnerName: winnerUser?.nickname || '???',
                                        horseName: conflict.horseName,
                                      });
                                      setActiveLottery(conflict);
                                      setShowLotteryModal(true);
                                    } catch (e) { console.error(e); }
                                    finally { setProcessing(false); }
                                  }}
                                  disabled={processing}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ラウンド確定 */}
                {allRevealed && allConflictsResolved && currentRoundStatuses.length > 0 &&
                 currentRoundStatuses.length >= draftUsers.length && (
                  <div className="control-group">
                    <button
                      className="btn btn-gold btn-lg"
                      onClick={handleConfirmRound}
                      disabled={processing}
                    >
                      {processing ? '処理中...' : `ラウンド${currentRound}を確定する`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ドラフト未開始時 */}
          {draftUsers.length === 0 && (
            <div className="result-empty">
              <p>参加者がまだ登録されていません</p>
              <p className="empty-hint">管理パネルから参加者を追加してください</p>
            </div>
          )}
        </div>
      </main>

      {/* 抽選モーダル */}
      <ConfirmModal
        isOpen={showLotteryModal}
        title="🎰 抽選"
        onConfirm={lotteryResult ? () => { setShowLotteryModal(false); setLotteryResult(null); } : handleRunLottery}
        onCancel={() => { setShowLotteryModal(false); setLotteryResult(null); }}
        confirmLabel={lotteryResult ? '閉じる' : (processing ? '抽選中...' : '抽選を実行する')}
        cancelLabel={lotteryResult ? '' : 'キャンセル'}
      >
        {activeLottery && !lotteryResult && (
          <div className="lottery-info">
            <p className="lottery-horse-name">{activeLottery.horseName}</p>
            <p className="lottery-contestants">
              対象: {activeLottery.nominations.map((n) => {
                const u = draftUsers.find((du) => du.id === n.nominatedBy);
                return u?.nickname || '???';
              }).join(' vs ')}
            </p>
          </div>
        )}
        {lotteryResult && (
          <div className="lottery-result">
            <div className="lottery-result-icon">🎉</div>
            <p className="lottery-result-text">
              <strong>{lotteryResult.winnerName}</strong> が
              <strong> {lotteryResult.horseName}</strong> を獲得！
            </p>
          </div>
        )}
      </ConfirmModal>

      {/* ラウンド移行トランジション */}
      {roundTransition && (
        <div className={`round-transition-overlay ${roundTransition.phase}`}>
          <div className="round-transition-content">
            {roundTransition.phase === 'confirmed' && (
              <>
                <div className="transition-check">✅</div>
                <div className="transition-message">
                  ラウンド {roundTransition.fromRound} 確定！
                </div>
              </>
            )}
            {roundTransition.phase === 'next' && !roundTransition.isComplete && (
              <>
                <div className="transition-round-number">R{roundTransition.toRound}</div>
                <div className="transition-message">
                  ラウンド {roundTransition.toRound} へ
                </div>
              </>
            )}
            {roundTransition.phase === 'next' && roundTransition.isComplete && (
              <>
                <div className="transition-trophy">🏆</div>
                <div className="transition-message transition-complete">
                  全ラウンド完了！
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
