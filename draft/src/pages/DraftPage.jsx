// ドラフト指名画面
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import HorseCard from '../components/HorseCard';
import ConfirmModal from '../components/ConfirmModal';
import { useHorseSearch } from '../hooks/useHorseSearch';
import { useDraftState } from '../hooks/useDraftState';
import { useFavorites } from '../hooks/useFavorites';
import './DraftPage.css';

export default function DraftPage() {
  const navigate = useNavigate();
  const {
    results, loading: searchLoading, search,
    cacheReady, cacheCount, cacheLoading,
  } = useHorseSearch();
  const {
    draftSettings, myNomination, nominatedHorseIds,
    submitNomination, cancelNomination, loading: draftLoading,
    myFixedResults,
  } = useDraftState();
  const { favorites, isFavorite } = useFavorites();

  const [selectedHorse, setSelectedHorse] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'favorites'

  const isRunning = draftSettings?.isRunning;
  const currentRound = draftSettings?.currentRound || 1;
  const phase = draftSettings?.phase || 'waiting';
  // 指名可能: ドラフト中 & 自分の指名がない & (指名受付中 or 再指名中)
  const canNominate = isRunning && !myNomination &&
    (phase === 'nominating' || phase === 'renominating');

  // 馬の選択
  const handleSelect = (horse) => {
    if (!canNominate) return;
    const horseId = horse.登録番号 || horse.umaId || horse.id;
    if (nominatedHorseIds.has(horseId)) return; // 既に確定済み
    setSelectedHorse(horse);
  };

  // 指名確定
  const handleConfirm = async () => {
    if (!selectedHorse) return;
    setSubmitting(true);
    try {
      // お気に入りデータには異なるフィールド名があるため変換
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

  // 指名取り消し
  const handleCancel = async () => {
    try {
      await cancelNomination();
    } catch (error) {
      console.error('指名取消エラー:', error);
    }
  };

  if (draftLoading) {
    return (
      <>
        <Header />
        <main className="page-content">
          <div className="container">
            <div className="draft-loading">読み込み中...</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          {/* ステータスバー */}
          <div className="draft-status-bar">
            <div className="status-round">
              <span className="badge badge-round">R{currentRound}</span>
              <span className="status-progress">{currentRound} / {draftSettings?.maxRounds || 10}</span>
              <span className="status-phase">
                {phase === 'waiting' && '⏸ 待機中'}
                {phase === 'nominating' && '📝 指名受付中'}
                {phase === 'revealing' && '🎯 結果公開中'}
                {phase === 'renominating' && '🔄 再指名中'}
                {phase === 'lottery' && '🎰 抽選中'}
                {phase === 'completed' && '✅ ドラフト完了'}
              </span>
            </div>
            <div className="status-links">
              {myNomination && (
                <div className="my-nomination-status">
                  <span className="nomination-label">指名済:</span>
                  <span className="nomination-horse">{myNomination.horseName}</span>
                  {!myNomination.isRevealed && (
                    <button className="btn btn-sm btn-secondary" onClick={handleCancel}>
                      取消
                    </button>
                  )}
                </div>
              )}
              <button className="btn btn-sm btn-outline" onClick={() => navigate('/draft/result')}>
                🎯 結果発表
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => navigate('/results')}>
                📊 確定一覧
              </button>
            </div>
          </div>

          {/* ドラフト不参加時 */}
          {!isRunning && (
            <div className="draft-not-running">
              <div className="not-running-icon">🏇</div>
              <h2>ドラフトはまだ開始されていません</h2>
              <p>管理者がドラフトを開始するまでお待ちください</p>
            </div>
          )}

          {/* 指名フォーム */}
          {isRunning && canNominate && (
            <section className="draft-nominate-section">
              <h2 className="section-header">📋 ラウンド {currentRound} - 馬を指名する</h2>

              {/* タブ切替 */}
              <div className="draft-tabs">
                <button
                  className={`draft-tab ${activeTab === 'search' ? 'active' : ''}`}
                  onClick={() => setActiveTab('search')}
                >
                  🔍 検索して指名
                </button>
                <button
                  className={`draft-tab ${activeTab === 'favorites' ? 'active' : ''}`}
                  onClick={() => setActiveTab('favorites')}
                >
                  ⭐ お気に入りから指名
                </button>
              </div>

              {/* 検索タブ */}
              {activeTab === 'search' && (
                <div className="tab-content">
                  <SearchBar
                    onSearch={search}
                    cacheReady={cacheReady}
                    cacheCount={cacheCount}
                  />
                  {results.length > 0 && (
                    <div className="draft-results-list">
                      {results.map((horse) => {
                        const hid = horse.登録番号 || horse.id;
                        const isConfirmed = nominatedHorseIds.has(hid);
                        return (
                          <div key={horse.id} className={`draft-horse-item ${isConfirmed ? 'confirmed-out' : ''}`}>
                            <HorseCard
                              horse={horse}
                              compact
                              showActions={false}
                              selected={selectedHorse?.id === horse.id}
                              onSelect={isConfirmed ? undefined : handleSelect}
                            />
                            {isConfirmed && <span className="confirmed-badge">指名済</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* お気に入りタブ */}
              {activeTab === 'favorites' && (
                <div className="tab-content">
                  {favorites.length === 0 ? (
                    <p className="no-favorites">お気に入りが登録されていません</p>
                  ) : (
                    <div className="draft-results-list">
                      {favorites.map((fav) => {
                        const isConfirmed = nominatedHorseIds.has(fav.umaId || fav.id);
                        return (
                          <div key={fav.id} className={`draft-horse-item ${isConfirmed ? 'confirmed-out' : ''}`}>
                            <div
                              className={`favorite-pick-card ${selectedHorse?.id === fav.id || selectedHorse?.umaId === fav.umaId ? 'selected' : ''}`}
                              onClick={isConfirmed ? undefined : () => handleSelect(fav)}
                              role={isConfirmed ? undefined : 'button'}
                            >
                              <span className={`horse-gender ${fav.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
                                {fav.gender === '牝' ? '♀' : '♂'}
                              </span>
                              <div className="fav-pick-info">
                                <span className="fav-pick-name">{fav.horseName}</span>
                                <span className="fav-pick-pedigree">
                                  {fav.fatherName} × {fav.motherName}
                                </span>
                              </div>
                              {fav.memo && <span className="fav-pick-memo">📝 {fav.memo}</span>}
                            </div>
                            {isConfirmed && <span className="confirmed-badge">指名済</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 選択された馬の指名ボタン */}
              {selectedHorse && (
                <div className="nomination-action">
                  <div className="nomination-preview">
                    <span className="nomination-preview-label">指名候補:</span>
                    <strong>{selectedHorse.馬名 || selectedHorse.horseName}</strong>
                  </div>
                  <button
                    className="btn btn-gold btn-lg"
                    onClick={() => setShowConfirm(true)}
                  >
                    この馬を指名する
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 指名済み表示 */}
          {isRunning && myNomination && phase === 'nominating' && (
            <div className="nomination-complete">
              <div className="nomination-complete-icon">✅</div>
              <h3>指名完了</h3>
              <p>「{myNomination.horseName}」を指名しました</p>
              <p className="nomination-wait">他の参加者の指名をお待ちください...</p>
            </div>
          )}

          {/* マイ確定結果 */}
          {myFixedResults.length > 0 && (
            <section className="draft-my-results">
              <h2 className="section-header">🏆 マイ確定馬</h2>
              <div className="my-results-list">
                {myFixedResults.map((r) => (
                  <div key={r.id} className="my-result-card">
                    <div className="my-result-header">
                      <span className="badge badge-round">R{r.round}</span>
                      <span className={`horse-gender ${r.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
                        {r.gender === '牝' ? '♀' : '♂'}
                      </span>
                      <span className="my-result-name">{r.horseName}</span>
                    </div>
                    <div className="my-result-details">
                      <span className="detail-item">父: {r.fatherName || '-'}</span>
                      <span className="detail-item">母: {r.motherName || '-'}</span>
                      <span className="detail-item">母父: {r.motherFatherName || '-'}</span>
                    </div>
                    <div className="my-result-meta">
                      {r.trainer && (
                        <span className="meta-item">
                          {r.region === '栗東' ? '🟤' : r.region === '美浦' ? '🔵' : '🏠'}
                          {r.trainer}
                          {r.region && <span className="region-tag">{r.region}</span>}
                        </span>
                      )}
                      {r.breeder && <span className="meta-item">🌾 {r.breeder}</span>}
                      {r.owner && <span className="meta-item">👤 {r.owner}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* 確認モーダル */}
      <ConfirmModal
        isOpen={showConfirm}
        title="指名確認"
        message={`「${selectedHorse?.馬名 || selectedHorse?.horseName || ''}」をラウンド${currentRound}で指名しますか？`}
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
