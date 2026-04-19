// お気に入り馬管理画面
import { useState } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import HorseCard from '../components/HorseCard';
import { useHorseSearch } from '../hooks/useHorseSearch';
import { useFavorites } from '../hooks/useFavorites';
import './FavoritesPage.css';

export default function FavoritesPage() {
  const { results, loading: searchLoading, search, cacheReady, cacheCount, cacheLoading } = useHorseSearch();
  const { favorites, loading: favLoading, toggleFavorite, isFavorite, updateMemo, removeFavorite } = useFavorites();
  const [editingMemo, setEditingMemo] = useState(null); // 編集中のお気に入りID
  const [memoText, setMemoText] = useState('');

  const handleMemoEdit = (fav) => {
    setEditingMemo(fav.id);
    setMemoText(fav.memo || '');
  };

  const handleMemoSave = async (favId) => {
    await updateMemo(favId, memoText);
    setEditingMemo(null);
    setMemoText('');
  };

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          <h1 className="page-title">⭐ お気に入り馬管理</h1>

          {/* 検索セクション */}
          <section className="favorites-section">
            <h2 className="section-header">🔍 馬を検索</h2>

            {cacheLoading && (
              <div className="cache-loading-banner">
                <span className="loading-spinner"></span>
                馬データを読み込み中...
              </div>
            )}

            <SearchBar
              onSearch={search}
              cacheReady={cacheReady}
              cacheCount={cacheCount}
            />

            {/* 検索結果 */}
            {results.length > 0 && (
              <div className="search-results">
                <p className="results-count">{results.length}件の検索結果</p>
                <div className="results-list">
                  {results.map((horse) => (
                    <HorseCard
                      key={horse.id}
                      horse={horse}
                      isFavorite={isFavorite(horse.登録番号 || horse.id)}
                      onFavorite={() => toggleFavorite(horse)}
                      compact={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {searchLoading && (
              <div className="search-loading">検索中...</div>
            )}
          </section>

          {/* お気に入りリスト */}
          <section className="favorites-section">
            <h2 className="section-header">
              ❤️ お気に入りリスト
              {favorites.length > 0 && (
                <span className="fav-count-badge">{favorites.length}頭</span>
              )}
            </h2>

            {favLoading ? (
              <div className="search-loading">読み込み中...</div>
            ) : favorites.length === 0 ? (
              <div className="empty-favorites">
                <p>お気に入りの馬はまだ登録されていません</p>
                <p className="empty-hint">上の検索から馬を見つけて ☆ ボタンで登録しましょう</p>
              </div>
            ) : (
              <div className="favorites-list">
                {favorites.map((fav, index) => (
                  <div key={fav.id} className="favorite-item animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="favorite-rank">
                      <span className="rank-number">{index + 1}</span>
                    </div>
                    <div className="favorite-info">
                      <div className="favorite-header">
                        <span className={`horse-gender ${fav.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
                          {fav.gender === '牝' ? '♀' : '♂'}
                        </span>
                        <span className="favorite-name">{fav.horseName}</span>
                      </div>
                      <div className="favorite-pedigree">
                        <span>父: {fav.fatherName || '不明'}</span>
                        <span>母: {fav.motherName || '不明'}</span>
                        <span>母父: {fav.motherFatherName || '不明'}</span>
                      </div>
                      {/* 厩舎・生産者・馬主 */}
                      <div className="favorite-meta">
                        {fav.trainer && (
                          <span className="fav-meta-item">
                            {fav.region === '栗東' ? '🟤' : fav.region === '美浦' ? '🔵' : '🏠'}
                            {fav.trainer}
                            {fav.region && <span className="fav-region-tag">{fav.region}</span>}
                          </span>
                        )}
                        {fav.breeder && <span className="fav-meta-item">🌾 {fav.breeder}</span>}
                        {fav.owner && <span className="fav-meta-item">👤 {fav.owner}</span>}
                      </div>

                      {/* メモ */}
                      {editingMemo === fav.id ? (
                        <div className="memo-edit">
                          <input
                            type="text"
                            className="form-input memo-input"
                            value={memoText}
                            onChange={(e) => setMemoText(e.target.value)}
                            placeholder="メモを入力..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleMemoSave(fav.id);
                              if (e.key === 'Escape') setEditingMemo(null);
                            }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => handleMemoSave(fav.id)}>保存</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingMemo(null)}>取消</button>
                        </div>
                      ) : (
                        <div className="memo-display" onClick={() => handleMemoEdit(fav)}>
                          {fav.memo ? (
                            <span className="memo-text">📝 {fav.memo}</span>
                          ) : (
                            <span className="memo-placeholder">📝 メモを追加...</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="favorite-actions">
                      <button
                        className="btn-remove"
                        onClick={() => removeFavorite(fav.id)}
                        aria-label="削除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
