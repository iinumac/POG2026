// プロフィール編集画面
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import './ProfilePage.css';

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

export default function ProfilePage() {
  const { userProfile, user, updateProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(userProfile?.nickname || '');
  const [selectedColor, setSelectedColor] = useState(userProfile?.avatarColor || '#1a6b3c');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasChanges =
    nickname !== (userProfile?.nickname || '') ||
    selectedColor !== (userProfile?.avatarColor || '#1a6b3c');

  const handleSave = async () => {
    if (!nickname.trim()) {
      setError('ニックネームを入力してください');
      return;
    }
    if (nickname.trim().length > 10) {
      setError('ニックネームは10文字以内で入力してください');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateProfile(nickname.trim(), selectedColor);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('プロフィール更新エラー:', err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      console.error('アカウント削除エラー:', err);
      setError('削除に失敗しました');
    }
  };

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          <h1 className="page-title">👤 プロフィール設定</h1>

          <div className="profile-card">
            {/* プレビュー */}
            <div className="profile-preview">
              <div className="profile-avatar-lg" style={{ backgroundColor: selectedColor }}>
                {nickname.charAt(0) || '?'}
              </div>
              <div className="profile-preview-info">
                <span className="profile-preview-name">{nickname || '未設定'}</span>
                <span className="profile-preview-email">{user?.email}</span>
              </div>
            </div>

            {/* ニックネーム編集 */}
            <div className="profile-section">
              <label className="profile-label" htmlFor="profile-nickname">ニックネーム</label>
              <input
                id="profile-nickname"
                type="text"
                className="form-input"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError(''); setSaved(false); }}
                placeholder="10文字以内で入力"
                maxLength={10}
              />
            </div>

            {/* カラー選択 */}
            <div className="profile-section">
              <label className="profile-label">アバターカラー</label>
              <div className="profile-color-grid">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`profile-color-option ${selectedColor === c.color ? 'selected' : ''}`}
                    style={{ backgroundColor: c.color }}
                    onClick={() => { setSelectedColor(c.color); setSaved(false); }}
                    aria-label={c.label}
                    title={c.label}
                  >
                    {selectedColor === c.color && <span className="color-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="profile-error">{error}</p>}
            {saved && <p className="profile-saved">✅ 保存しました</p>}

            {/* 保存ボタン */}
            <button
              className="btn btn-primary btn-lg profile-save-btn"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </div>

          {/* アカウント削除 */}
          <div className="profile-danger-zone">
            <h2 className="danger-title">⚠️ アカウント削除</h2>
            <p className="danger-desc">
              アカウントを削除すると、プロフィール情報が消去されます。
              お気に入りやドラフト結果はシーズンデータとして残ります。
            </p>
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              アカウントを削除する
            </button>
          </div>
        </div>
      </main>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="⚠️ アカウント削除"
        message="本当にアカウントを削除しますか？この操作は取り消せません。"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel="削除する"
        danger
      />
    </>
  );
}
