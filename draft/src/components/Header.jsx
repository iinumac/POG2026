// ヘッダーコンポーネント - シーズン切替ドロップダウン含む
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import './Header.css';

export default function Header() {
  const { userProfile, signOut, isAdmin } = useAuth();
  const { currentSeasonId, availableSeasons, switchSeason, seasonDisplayName } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);
  const draftMenuRef = useRef(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // ドラフトサブメニューの外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (draftMenuRef.current && !draftMenuRef.current.contains(e.target)) {
        setDraftMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainNavItems = [
    { path: '/', label: 'ホーム', icon: '🏠' },
    { path: '/favorites', label: 'お気に入り', icon: '⭐' },
  ];

  const draftSubItems = [
    { path: '/draft', label: '指名', icon: '📋' },
    { path: '/draft/result', label: '結果発表', icon: '🎯' },
    { path: '/results', label: '確定一覧', icon: '📊' },
  ];

  const adminNavItem = isAdmin ? [{ path: '/admin', label: '管理', icon: '⚙️' }] : [];

  const isDraftActive = draftSubItems.some((item) => location.pathname === item.path);

  return (
    <header className="header">
      <div className="header-inner">
        {/* ロゴ・タイトルエリア */}
        <div className="header-brand" onClick={() => navigate('/')}>
          <span className="header-logo">🏇</span>
          <span className="header-title">鷹燕杯</span>
          <select
            className="season-select"
            value={currentSeasonId}
            onChange={(e) => switchSeason(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s}>S{parseInt(s) - 2021} ({s})</option>
            ))}
          </select>
        </div>

        {/* PC用ナビゲーション */}
        <nav className="header-nav desktop-only">
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}

          {/* ドラフトサブメニュー */}
          <div className="nav-dropdown" ref={draftMenuRef}>
            <button
              className={`nav-item ${isDraftActive ? 'active' : ''}`}
              onClick={() => setDraftMenuOpen(!draftMenuOpen)}
            >
              <span className="nav-icon">🏇</span>
              <span className="nav-label">ドラフト</span>
              <span className={`dropdown-arrow ${draftMenuOpen ? 'open' : ''}`}>▾</span>
            </button>
            {draftMenuOpen && (
              <div className="dropdown-menu">
                {draftSubItems.map((item) => (
                  <button
                    key={item.path}
                    className={`dropdown-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => { navigate(item.path); setDraftMenuOpen(false); }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {adminNavItem.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ユーザーエリア */}
        <div className="header-user">
          {userProfile && (
            <div className="user-info" onClick={() => navigate('/profile')} role="button" title="プロフィール設定">
              <span
                className="user-avatar"
                style={{ backgroundColor: userProfile.avatarColor || '#1a6b3c' }}
              >
                {userProfile.nickname?.charAt(0) || '?'}
              </span>
              <span className="user-name desktop-only">{userProfile.nickname}</span>
            </div>
          )}
          <button className="btn-signout desktop-only" onClick={handleSignOut}>
            ログアウト
          </button>

          {/* モバイル用ハンバーガー */}
          <button
            className="hamburger mobile-only"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <span className={`hamburger-line ${menuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {menuOpen && (
        <div className="mobile-menu">
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              className={`mobile-menu-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {/* モバイル: ドラフトサブメニュー */}
          <div className="mobile-submenu-title">🏇 ドラフト</div>
          {draftSubItems.map((item) => (
            <button
              key={item.path}
              className={`mobile-menu-item sub ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {adminNavItem.map((item) => (
            <button
              key={item.path}
              className={`mobile-menu-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <button className="mobile-menu-item signout" onClick={handleSignOut}>
            <span>🚪</span>
            <span>ログアウト</span>
          </button>
        </div>
      )}
    </header>
  );
}
