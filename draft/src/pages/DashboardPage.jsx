// ダッシュボード画面 - v2 Lucide アイコン
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useFavorites } from '../hooks/useFavorites';
import { Home, Star, List, Trophy } from '../components/Icons';
import './DashboardPage.css';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const { seasonDisplayName } = useSeason();
  const { favorites, loading: favLoading } = useFavorites();
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <main className="v2-page" style={{ paddingBottom: 80 }}>
        <div className="container">
          {/* ウェルカムバナー */}
          <div className="dashboard-banner">
            <div className="banner-content">
              <h1 className="banner-title">{seasonDisplayName}</h1>
              <p className="banner-greeting">
                ようこそ、{userProfile?.nickname || 'ゲスト'}さん
              </p>
            </div>
          </div>

          {/* クイックアクション */}
          <section className="dashboard-section">
            <div className="quick-actions">
              <button className="action-card" onClick={() => navigate('/favorites')}>
                <Star size={24} style={{ color: 'var(--color-accent-gold)' }} />
                <span className="action-label">お気に入り管理</span>
                <span className="action-desc">馬を検索・優先順位付け</span>
              </button>
              <button className="action-card" onClick={() => navigate('/draft')}>
                <List size={24} style={{ color: 'var(--color-primary)' }} />
                <span className="action-label">ドラフト指名</span>
                <span className="action-desc">指名・結果発表</span>
              </button>
              <button className="action-card" onClick={() => navigate('/results')}>
                <Trophy size={24} style={{ color: 'var(--color-primary-dark)' }} />
                <span className="action-label">確定一覧</span>
                <span className="action-desc">全参加者の指名結果</span>
              </button>
            </div>
          </section>

          {/* お気に入りプレビュー */}
          <section className="dashboard-section">
            <h2 className="section-subheader">
              お気に入り馬
              {favorites.length > 0 && (
                <span className="section-badge">{favorites.length}頭</span>
              )}
            </h2>
            {favLoading ? (
              <p className="summary-placeholder">読み込み中...</p>
            ) : favorites.length === 0 ? (
              <div className="dashboard-empty">
                <p>お気に入りがまだ登録されていません</p>
                <button className="v2-btn v2-btn-primary" onClick={() => navigate('/favorites')}>
                  馬を探す
                </button>
              </div>
            ) : (
              <div className="favorites-preview">
                {favorites.slice(0, 5).map((fav, i) => (
                  <div key={fav.id} className="fav-preview-item">
                    <span className="fav-preview-rank">{i + 1}</span>
                    <span className={`horse-gender ${fav.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
                      {fav.gender === '牝' ? '♀' : '♂'}
                    </span>
                    <div className="fav-preview-info">
                      <span className="fav-preview-name">{fav.horseName}</span>
                      <span className="fav-preview-pedigree">{fav.fatherName} × {fav.motherName}</span>
                    </div>
                  </div>
                ))}
                {favorites.length > 5 && (
                  <button className="v2-btn v2-btn-ghost v2-btn-sm" onClick={() => navigate('/favorites')}>
                    他 {favorites.length - 5}頭を見る
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
