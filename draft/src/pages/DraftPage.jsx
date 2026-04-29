// ドラフト指名画面 — v2 3-column layout
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import RoundStrip from '../components/RoundStrip';
import ConfirmModal from '../components/ConfirmModal';
import { useHorseSearch } from '../hooks/useHorseSearch';
import { useDraftState } from '../hooks/useDraftState';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../contexts/AuthContext';
import { Star, Search, Lock, Edit, Trophy, Horse, FileText, ExternalLink, Settings } from '../components/Icons';
import './DraftPage.css';

export default function DraftPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const {
    results, loading: searchLoading, search,
    cacheReady, cacheCount, cacheLoading,
  } = useHorseSearch();
  const {
    draftSettings, myNomination, nominatedHorseIds,
    submitNomination, cancelNomination, loading: draftLoading,
    myFixedResults, fixedResults,
  } = useDraftState();
  const { favorites, isFavorite } = useFavorites();

  // 自分の確定馬IDセット
  const myFixedHorseIds = useMemo(
    () => new Set(myFixedResults.map((r) => r.umaId)),
    [myFixedResults]
  );

  const [selectedHorse, setSelectedHorse] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [source, setSource] = useState('favorites');
  const [query, setQuery] = useState('');

  const isRunning = draftSettings?.isRunning;
  const currentRound = draftSettings?.currentRound || 1;
  const maxRounds = draftSettings?.maxRounds || 10;
  const phase = draftSettings?.phase || 'waiting';
  const canNominate = isRunning && !myNomination &&
    (phase === 'nominating' || phase === 'renominating');

  const phaseLabel = {
    waiting: '待機中',
    nominating: '指名受付中',
    revealing: '結果公開中',
    renominating: '再指名中',
    lottery: '抽選中',
    completed: 'ドラフト完了',
  }[phase] || phase;

  const handleSelect = (horse) => {
    if (!canNominate) return;
    const horseId = horse.登録番号 || horse.umaId || horse.id;
    if (nominatedHorseIds.has(horseId)) return;
    setSelectedHorse(horse);
  };

  const handleConfirm = async () => {
    if (!selectedHorse) return;
    setSubmitting(true);
    try {
      const horseData = {
        登録番号: selectedHorse.登録番号 || selectedHorse.umaId || selectedHorse.id,
        馬名: selectedHorse.馬名 || selectedHorse.horseName || '',
        父: selectedHorse.父 || selectedHorse.fatherName || '',
        母: selectedHorse.母 || selectedHorse.motherName || '',
        母父: selectedHorse.母父 || selectedHorse.motherFatherName || '',
        性別: selectedHorse.性別 || selectedHorse.gender || '',
        調教師: selectedHorse.調教師 || selectedHorse.trainer || '',
        東西: selectedHorse.東西 || selectedHorse.region || '',
        生産者: selectedHorse.生産者 || selectedHorse.breeder || '',
        馬主: selectedHorse.馬主 || selectedHorse.owner || '',
        母名生年: selectedHorse.母名生年 || '',
      };
      await submitNomination(horseData);
      setSelectedHorse(null);
      setShowConfirm(false);
    } catch (error) {
      console.error('指名エラー:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try { await cancelNomination(); } catch (e) { console.error(e); }
  };

  const handleSearch = (q) => {
    setQuery(q);
    search(q);
  };

  const horseName = (h) => h?.馬名 || h?.horseName || h?.name || '不明';
  const genderChar = (h) => {
    const g = h?.性別 || h?.gender;
    return (g === '牝' || g === 'f') ? 'f' : 'm';
  };

  if (draftLoading) {
    return (
      <>
        <Header />
        <main className="v2-page"><div className="v2-empty">読み込み中...</div></main>
      </>
    );
  }

  return (
    <>
      <Header />

      {/* ラウンドステータス */}
      <RoundStrip
        round={currentRound}
        phase={phase}
        phaseLabel={phaseLabel}
        submittedCount={0}
        totalCount={0}
      />

      <main className="v2-page" style={{ paddingBottom: 80 }}>
        {/* ドラフト未開始 */}
        {!isRunning && (
          <div className="v2-empty">
            <Horse size={48} />
            ドラフトはまだ開始されていません
            <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
              管理者がドラフトを開始するまでお待ちください
            </span>
          </div>
        )}

        {/* 指名済み表示（指名受付中 or 再指名提出済み → 公開待ち） */}
        {isRunning && myNomination && !canNominate &&
          (phase === 'nominating' || phase === 'renominating') && (
          <div className="v2-submitted-card">
            <div className="v2-submitted-badge"><Lock size={13} />あなたの指名</div>
            <div className="v2-submitted-horse">
              <span className={`gender ${genderChar(myNomination)}`}>
                {genderChar(myNomination) === 'f' ? '♀' : '♂'}
              </span>
              {myNomination.horseName}
            </div>
            <div className="v2-submitted-ped">
              {myNomination.fatherName || '-'} × {myNomination.motherName || '-'}
            </div>
            {phase === 'nominating' && (
              <div className="v2-submitted-actions">
                <button className="v2-btn v2-btn-ghost" onClick={handleCancel}>
                  <Edit size={14} />指名を変更
                </button>
              </div>
            )}
            <div className="v2-submitted-notice">
              他の参加者の指名が完了するまでお待ちください
            </div>
          </div>
        )}

        {/* 獲得決定表示（公開中・抽選中で、自分の指名がrejectedでない） */}
        {isRunning && myNomination && !canNominate &&
          myNomination.status !== 'rejected' &&
          (phase === 'revealing' || phase === 'lottery') && (
          <WaitingView
            nomination={myNomination}
            myFixedResults={myFixedResults}
            favorites={favorites}
            genderChar={genderChar}
            horseName={horseName}
          />
        )}

        {/* 指名フォーム — 3カラムレイアウト */}
        {isRunning && canNominate && (
          <div className="v2-draft-layout">
            {/* LEFT — ショートリスト */}
            <div className="v2-shortlist v2-panel">
              <div className="v2-shortlist-tabs">
                <button
                  className={`v2-shortlist-tab ${source === 'favorites' ? 'active' : ''}`}
                  onClick={() => setSource('favorites')}
                >
                  <Star size={11} style={{ marginRight: 4 }} />お気に入り
                </button>
                <button
                  className={`v2-shortlist-tab ${source === 'search' ? 'active' : ''}`}
                  onClick={() => setSource('search')}
                >
                  <Search size={11} style={{ marginRight: 4 }} />検索
                </button>
              </div>

              {source === 'search' && (
                <div className="v2-shortlist-search">
                  <Search size={14} />
                  <input
                    placeholder="馬名・父・母で検索..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="v2-shortlist-items">
                {source === 'favorites' ? (
                  favorites.length === 0 ? (
                    <div className="v2-empty" style={{ padding: 24 }}><Star />お気に入り未登録</div>
                  ) : [...favorites].sort((a, b) => (a.priority || 999) - (b.priority || 999)).map((fav) => {
                    const hid = fav.umaId || fav.id;
                    const taken = nominatedHorseIds.has(hid);
                    const takenByMe = myFixedHorseIds.has(hid);
                    const isSelected = selectedHorse?.id === fav.id || selectedHorse?.umaId === fav.umaId;
                    const rank = fav.priority;
                    return (
                      <div
                        key={fav.id}
                        className={`v2-shortlist-item ${isSelected ? 'active' : ''} ${taken ? (takenByMe ? 'taken-mine' : 'taken-other') : ''}`}
                        onClick={() => !taken && handleSelect(fav)}
                      >
                        <div className="v2-shortlist-rank">{rank || '-'}</div>
                        <span className={`v2-fav-gender-badge ${genderChar(fav)}`} style={{ width: 16, height: 16, fontSize: 10 }}>
                          {genderChar(fav) === 'f' ? '♀' : '♂'}
                        </span>
                        <div className="v2-shortlist-body">
                          <div className="v2-shortlist-name">{horseName(fav)}</div>
                          <div className="v2-shortlist-ped">{fav.fatherName || '-'} × {fav.motherName || '-'}</div>
                          <div className="v2-shortlist-eval">
                            <span className="v2-shortlist-grades">
                              {['pedigreeGrade', 'buildGrade', 'growthGrade'].map((k) => {
                                const v = fav[k];
                                return v ? <span key={k} className={`v2-sl-grade grade-${v}`}>{v}</span>
                                  : <span key={k} className="v2-sl-grade v2-sl-grade-empty">-</span>;
                              })}
                            </span>
                            {fav.score != null && <span className="v2-shortlist-score">{fav.score}点</span>}
                          </div>
                        </div>
                        <div className="v2-shortlist-right">
                          {takenByMe ? <span className="v2-shortlist-status taken-mine">獲得済</span> :
                            taken ? <span className="v2-shortlist-status taken-other">指名済</span> :
                            fav.memo ? <span className="v2-shortlist-status" title={fav.memo}><FileText size={10} /></span> : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  results.length === 0 ? (
                    <div className="v2-empty" style={{ padding: 24 }}><Search />検索結果なし</div>
                  ) : results.map((h) => {
                    const hid = h.登録番号 || h.id;
                    const taken = nominatedHorseIds.has(hid);
                    const takenByMe = myFixedHorseIds.has(hid);
                    const isSelected = selectedHorse?.id === h.id;
                    return (
                      <div
                        key={h.id}
                        className={`v2-shortlist-item ${isSelected ? 'active' : ''} ${taken ? (takenByMe ? 'taken-mine' : 'taken-other') : ''}`}
                        onClick={() => !taken && handleSelect(h)}
                      >
                        <div className="v2-shortlist-rank"></div>
                        <span className={`v2-fav-gender-badge ${genderChar(h)}`} style={{ width: 16, height: 16, fontSize: 10 }}>
                          {genderChar(h) === 'f' ? '♀' : '♂'}
                        </span>
                        <div className="v2-shortlist-body">
                          <div className="v2-shortlist-name">{horseName(h)}</div>
                          <div className="v2-shortlist-ped">{h.父 || h.fatherName || '-'} × {h.母 || h.motherName || '-'}</div>
                        </div>
                        {takenByMe ? <span className="v2-shortlist-status taken-mine">獲得済</span> :
                          taken ? <span className="v2-shortlist-status taken-other">指名済</span> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CENTER — 詳細 */}
            <div className="v2-detail">
              {!selectedHorse ? (
                <div className="v2-detail-empty">
                  <Horse size={48} />
                  左のリストから馬を選択してください
                </div>
              ) : (() => {
                const hid = selectedHorse.登録番号 || selectedHorse.umaId || selectedHorse.id;
                const favEntry = favorites.find((f) => f.umaId === hid || f.id === hid);
                return (
                <>
                  <div className="v2-detail-head">
                    <div className="v2-detail-title-area">
                      <div className="v2-detail-pretitle">
                        <span>POG 2026 · 指名候補</span>
                        {favEntry && <span style={{ color: 'var(--color-accent-gold)' }}>★ お気に入り #{favEntry.priority || '-'}</span>}
                      </div>
                      <div className="v2-detail-name">
                        <span className={`gender ${genderChar(selectedHorse)}`}>
                          {genderChar(selectedHorse) === 'f' ? '♀' : '♂'}
                        </span>
                        {horseName(selectedHorse)}
                      </div>
                    </div>
                  </div>
                  <div className="v2-detail-grid">
                    <div className="v2-detail-block">
                      <div className="v2-detail-block-title">血統</div>
                      <div className="v2-pedigree-tree">
                        <div className="v2-ped-row"><span className="v2-ped-label">父</span><span className="v2-ped-value">{selectedHorse.父 || selectedHorse.fatherName || '-'}</span></div>
                        <div className="v2-ped-row"><span className="v2-ped-label mother">母</span><span className="v2-ped-value">{selectedHorse.母 || selectedHorse.motherName || '-'}</span></div>
                        <div className="v2-ped-row"><span className="v2-ped-label motherfather">母父</span><span className="v2-ped-value">{selectedHorse.母父 || selectedHorse.motherFatherName || '-'}</span></div>
                      </div>
                    </div>
                    <div className="v2-detail-block">
                      <div className="v2-detail-block-title">関係者</div>
                      <dl className="v2-detail-kv">
                        <dt>厩舎</dt><dd>{selectedHorse.調教師 || selectedHorse.trainer || '-'}<span className="sub">{selectedHorse.東西 || selectedHorse.region || ''}</span></dd>
                        <dt>生産</dt><dd>{selectedHorse.生産者 || selectedHorse.breeder || '-'}</dd>
                        <dt>馬主</dt><dd>{selectedHorse.馬主 || selectedHorse.owner || '-'}</dd>
                      </dl>
                    </div>
                  </div>
                  {/* お気に入り評価 */}
                  {favEntry && (favEntry.pedigreeGrade || favEntry.buildGrade || favEntry.growthGrade || favEntry.score != null) && (
                    <div className="v2-detail-stats">
                      <div className="v2-stat">
                        <div className="v2-stat-label">血統</div>
                        <div className={`v2-stat-value ${favEntry.pedigreeGrade ? `grade-${favEntry.pedigreeGrade}` : ''}`}>{favEntry.pedigreeGrade || '—'}</div>
                      </div>
                      <div className="v2-stat">
                        <div className="v2-stat-label">体格</div>
                        <div className={`v2-stat-value ${favEntry.buildGrade ? `grade-${favEntry.buildGrade}` : ''}`}>{favEntry.buildGrade || '—'}</div>
                      </div>
                      <div className="v2-stat">
                        <div className="v2-stat-label">成長</div>
                        <div className={`v2-stat-value ${favEntry.growthGrade ? `grade-${favEntry.growthGrade}` : ''}`}>{favEntry.growthGrade || '—'}</div>
                      </div>
                      <div className="v2-stat">
                        <div className="v2-stat-label">点数</div>
                        <div className="v2-stat-value">{favEntry.score ?? '—'}</div>
                      </div>
                    </div>
                  )}
                  {/* メモ */}
                  {favEntry?.memo && (
                    <div className="v2-detail-memo">
                      <div className="v2-detail-memo-label"><FileText size={12} /> 自分のメモ</div>
                      <div className="v2-detail-memo-text">{favEntry.memo}</div>
                    </div>
                  )}
                  <div className="v2-detail-actions">
                    <button
                      className="v2-btn v2-btn-gold v2-btn-lg"
                      style={{ flex: 1 }}
                      onClick={() => setShowConfirm(true)}
                    >
                      <Lock size={16} /> この馬で指名を提出
                    </button>
                  </div>
                </>
                );
              })()}
            </div>

            {/* RIGHT — 確定馬リスト */}
            {myFixedResults.length > 0 && (
              <div className="v2-draft-room">
                <div className="v2-panel">
                  <div className="v2-panel-head">
                    <span><Trophy size={12} style={{ marginRight: 4 }} />マイ確定馬</span>
                  </div>
                  <div className="v2-panel-body p-0">
                    <div className="v2-room-list">
                      {myFixedResults.map((r) => (
                        <div key={r.id} className="v2-room-row">
                          <div className="v2-room-avatar" style={{ background: 'var(--color-accent-gold)', color: '#000', fontSize: 9, fontWeight: 700 }}>
                            {r.round}巡
                          </div>
                          <div className="v2-room-name">
                            <span style={{ color: genderChar(r) === 'f' ? 'var(--color-accent-red)' : 'var(--color-accent-blue)', fontWeight: 700, marginRight: 4 }}>
                              {genderChar(r) === 'f' ? '♀' : '♂'}
                            </span>
                            {r.horseName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 確認モーダル */}
      <ConfirmModal
        isOpen={showConfirm}
        title="指名確認"
        message={`「${horseName(selectedHorse)}」を${currentRound}巡目で指名しますか？`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        confirmLabel={submitting ? '送信中...' : '指名を確定する'}
      >
        {selectedHorse && (
          <div className="confirm-horse-detail">
            <p>父: {selectedHorse.父 || selectedHorse.fatherName || '不明'}</p>
            <p>母: {selectedHorse.母 || selectedHorse.motherName || '不明'}</p>
            <p>母父: {selectedHorse.母父 || selectedHorse.motherFatherName || '不明'}</p>
          </div>
        )}
      </ConfirmModal>
    </>
  );
}

// ════════════════════════════════════════════════
// 待機中ビュー（再指名中に自分の馬を確認できる画面）
// ════════════════════════════════════════════════
function WaitingView({ nomination, myFixedResults, favorites, genderChar, horseName }) {
  const g = genderChar(nomination);
  const favEntry = favorites.find((f) => f.umaId === nomination.umaId || f.id === nomination.umaId);

  return (
    <div className="v2-waiting-layout">
      {/* 今回の指名 — 獲得決定 */}
      <div className="v2-waiting-main">
        <div className="v2-waiting-confirmed-card">
          <div className="v2-waiting-status">獲得決定</div>
          <div className="v2-waiting-horse">
            <span className={`gender ${g}`}>{g === 'f' ? '♀' : '♂'}</span>
            {nomination.horseName}
          </div>
          <div className="v2-waiting-ped">
            {nomination.fatherName || '-'} × {nomination.motherName || '-'}
          </div>
          {nomination.motherFatherName && (
            <div className="v2-waiting-mf">母父: {nomination.motherFatherName}</div>
          )}
          <div className="v2-waiting-meta">
            {nomination.trainer && <span>{nomination.region} {nomination.trainer}</span>}
            {nomination.breeder && <span>生産: {nomination.breeder}</span>}
            {nomination.owner && <span>馬主: {nomination.owner}</span>}
          </div>

          {/* お気に入り評価があれば表示 */}
          {favEntry && (favEntry.pedigreeGrade || favEntry.buildGrade || favEntry.growthGrade || favEntry.score != null) && (
            <div className="v2-waiting-eval">
              {['pedigreeGrade', 'buildGrade', 'growthGrade'].map((k) => {
                const label = { pedigreeGrade: '血統', buildGrade: '体格', growthGrade: '成長' }[k];
                const val = favEntry[k];
                return (
                  <div key={k} className="v2-waiting-eval-item">
                    <span className="v2-waiting-eval-label">{label}</span>
                    <span className={`v2-waiting-eval-value ${val ? `grade-${val}` : ''}`}>{val || '—'}</span>
                  </div>
                );
              })}
              <div className="v2-waiting-eval-item">
                <span className="v2-waiting-eval-label">点数</span>
                <span className="v2-waiting-eval-value">{favEntry.score ?? '—'}</span>
              </div>
            </div>
          )}

          {favEntry?.memo && (
            <div className="v2-waiting-memo">
              <span className="v2-waiting-memo-label">メモ</span>
              {favEntry.memo}
            </div>
          )}

          <div className="v2-waiting-notice">
            他の参加者の再指名・抽選が完了するまでお待ちください
          </div>

        </div>
      </div>

      {/* 右: これまでの獲得馬一覧 */}
      {myFixedResults.length > 0 && (
        <div className="v2-waiting-history">
          <div className="v2-panel">
            <div className="v2-panel-head"><span>獲得馬一覧</span></div>
            <div className="v2-panel-body p-0">
              <div className="v2-room-list">
                {myFixedResults.map((r) => (
                  <div key={r.id} className="v2-room-row">
                    <div className="v2-room-avatar" style={{ background: 'var(--color-accent-gold)', color: '#000', fontSize: 9, fontWeight: 700 }}>
                      {r.round}巡
                    </div>
                    <div className="v2-room-name">
                      <span style={{ color: genderChar(r) === 'f' ? 'var(--color-accent-red)' : 'var(--color-accent-blue)', fontWeight: 700, marginRight: 4 }}>
                        {genderChar(r) === 'f' ? '♀' : '♂'}
                      </span>
                      {r.horseName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
