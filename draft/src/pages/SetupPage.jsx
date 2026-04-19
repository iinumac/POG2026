// ニックネーム設定画面 - 初回ログイン時に表示
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './SetupPage.css';

// アバターカラー選択肢（16色）
const AVATAR_COLORS = [
  { id: 'green',      color: '#1a6b3c', label: '緑' },
  { id: 'blue',       color: '#2980b9', label: '青' },
  { id: 'red',        color: '#c0392b', label: '赤' },
  { id: 'gold',       color: '#c9a84c', label: '金' },
  { id: 'orange',     color: '#e67e22', label: '橙' },
  { id: 'pink',       color: '#e91e8c', label: '桃' },
  { id: 'teal',       color: '#16a085', label: '碧' },
  { id: 'purple',     color: '#8e44ad', label: '紫' },
  { id: 'navy',       color: '#1a3a5c', label: '紺' },
  { id: 'crimson',    color: '#9b2335', label: '臙脂' },
  { id: 'lime',       color: '#6b8e23', label: '黄緑' },
  { id: 'skyblue',    color: '#3498db', label: '空' },
  { id: 'brown',      color: '#795548', label: '茶' },
  { id: 'slate',      color: '#546e7a', label: '灰青' },
  { id: 'coral',      color: '#e74c3c', label: '朱' },
  { id: 'indigo',     color: '#4a148c', label: '藍' },
];

export default function SetupPage() {
  const { saveProfile, user } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('ニックネームを入力してください');
      return;
    }
    if (nickname.trim().length > 10) {
      setError('ニックネームは10文字以内で入力してください');
      return;
    }

    setSaving(true);
    try {
      await saveProfile(nickname.trim(), selectedColor);
      navigate('/');
    } catch (err) {
      console.error('プロフィール保存エラー:', err);
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-header">
          <span className="setup-icon">🏇</span>
          <h1 className="setup-title">プロフィール設定</h1>
          <p className="setup-desc">ドラフトで使用するニックネームとカラーを選択してください</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* ニックネーム */}
          <div className="form-group">
            <label className="form-label" htmlFor="nickname-input">ニックネーム</label>
            <input
              id="nickname-input"
              type="text"
              className="form-input"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setError(''); }}
              placeholder="10文字以内で入力"
              maxLength={10}
              autoFocus
            />
          </div>

          {/* アバターカラー */}
          <div className="form-group">
            <label className="form-label">アバターカラー</label>
            <div className="color-grid">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`color-option ${selectedColor === c.color ? 'selected' : ''}`}
                  style={{ backgroundColor: c.color }}
                  onClick={() => setSelectedColor(c.color)}
                  aria-label={c.label}
                >
                  {selectedColor === c.color && <span className="color-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="setup-preview">
            <div className="preview-avatar" style={{ backgroundColor: selectedColor }}>
              {nickname.charAt(0) || '?'}
            </div>
            <span className="preview-name">{nickname || 'ニックネーム未設定'}</span>
          </div>

          {error && <p className="setup-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-lg setup-submit"
            disabled={saving || !nickname.trim()}
          >
            {saving ? '保存中...' : '設定を保存して開始'}
          </button>
        </form>
      </div>
    </div>
  );
}
