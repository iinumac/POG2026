// ヘッダーコンポーネント - v2 Lucide アイコン + モバイルボトムナビ
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { Home, Star, List, Settings, LogOut, Trophy, BarChart } from './Icons';
import './Header.css';

export default function Header() {
  const { userProfile, signOut, isAdmin } = useAuth();
  const { currentSeasonId, availableSeasons, switchSeason } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', label: 'ホーム', Icon: Home },
    { path: '/favorites', label: 'お気に入り', Icon: Star },
    { path: '/draft', label: '指名', Icon: List },
    { path: '/results', label: '確定一覧', Icon: Trophy },
    ...(isAdmin ? [{ path: '/admin', label: '管理', Icon: Settings }] : []),
  ];

  return (
    <>
      <header className="v2-header">
        <div className="v2-header-inner">
          <div className="v2-brand" onClick={() => navigate('/')} role="button">
            <div className="v2-brand-mark">鷹</div>
            <span className="v2-brand-name">鷹燕杯</span>
            <span className="v2-brand-season">
              <select
                value={currentSeasonId}
                onChange={(e) => switchSeason(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {availableSeasons.map((s) => (
                  <option key={s} value={s}>S{parseInt(s) - 2021} · {s}</option>
                ))}
              </select>
            </span>
          </div>

          <nav className="v2-nav">
            {navItems.map(({ path, label, Icon }) => (
              <button
                key={path}
                className={`v2-nav-item ${isActive(path) ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon size={14} />{label}
              </button>
            ))}
          </nav>

          <div className="v2-header-user">
            {userProfile && (
              <>
                <div
                  className="v2-user-avatar"
                  style={{ background: userProfile.avatarColor || '#1a6b3c' }}
                  onClick={() => navigate('/profile')}
                  role="button"
                  title="プロフィール設定"
                >
                  {userProfile.nickname?.charAt(0) || '?'}
                </div>
                <span className="v2-user-name">{userProfile.nickname}</span>
              </>
            )}
            <button className="v2-btn-icon" title="ログアウト" style={{ color: 'rgba(255,255,255,.7)' }} onClick={handleSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* モバイルボトムナビ */}
      <nav className="v2-mobile-nav">
        <div className="v2-mobile-nav-inner">
          {navItems.slice(0, 4).map(({ path, label, Icon }) => (
            <button
              key={path}
              className={`v2-mobile-nav-item ${isActive(path) ? 'active' : ''}`}
              onClick={() => navigate(path)}
            >
              <Icon />{label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
