// 管理パネル画面
import { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useDraftState } from '../hooks/useDraftState';
import { collection, writeBatch, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { startRound, addDraftUser, removeDraftUser, resetDraft, setPhase, importHistoricalSeason } from '../services/draftService';
import './AdminPage.css';

export default function AdminPage() {
  const { isAdmin, userProfile } = useAuth();
  const { currentSeasonId } = useSeason();
  const { draftSettings, draftUsers, loading: draftLoading } = useDraftState();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const fileRef = useRef(null);

  // 全登録ユーザー
  const [allUsers, setAllUsers] = useState([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 過去シーズンインポート
  const [histSeasonId, setHistSeasonId] = useState('2022');
  const [histSeasonName, setHistSeasonName] = useState('鷹燕杯 Season 1');
  const [histTsvText, setHistTsvText] = useState('');
  const [histPreview, setHistPreview] = useState([]);
  const [histImporting, setHistImporting] = useState(false);
  const [histImportResult, setHistImportResult] = useState(null);

  // 登録ユーザー取得
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        setAllUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('ユーザー取得エラー:', error);
      }
    };
    fetchUsers();
  }, []);

  // CSVファイルをパース（Shift-JIS対応）
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.trim() || '';
      });
      return row;
    });
  };

  // ファイル選択時のプレビュー
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setUploadResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const text = decoder.decode(buffer);
      const data = parseCSV(text);

      setTotalRows(data.length);
      setPreviewData(data.slice(0, 5));
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      setUploadResult({ type: 'error', message: 'ファイルの読み込みに失敗しました' });
    }
  };

  // Firestoreにアップロード
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const text = decoder.decode(buffer);
      const data = parseCSV(text);

      const currentYear = parseInt(currentSeasonId) || 2026;
      const horsesPath = `seasons/${currentSeasonId}/horses`;
      const BATCH_SIZE = 500;
      let uploaded = 0;

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + BATCH_SIZE);

        chunk.forEach((row) => {
          const regNum = row['登録番号'];
          if (!regNum) return;

          const defaultName = row['母'] ? `${row['母']}の${currentYear}` : '';
          const horseName = row['馬名'] || row['(母名+生年)'] || defaultName;
          const netkeibaUrl = regNum ? `https://db.netkeiba.com/horse/${regNum}/` : '';

          const horseData = {
            登録番号: regNum,
            馬名: horseName,
            '(母名+生年)': row['(母名+生年)'] || '',
            性別: row['性別'] || '',
            毛色: row['毛色'] || '',
            父: row['父'] || '',
            母: row['母'] || '',
            母父: row['母父'] || '',
            調教師: row['調教師'] || '',
            東西: row['東西'] || '',
            生産者: row['生産者'] || '',
            馬主: row['馬主'] || '',
            リンク: row['url'] || netkeibaUrl,
            updatedAt: new Date(),
          };

          const docRef = doc(db, horsesPath, regNum);
          batch.set(docRef, horseData);
          uploaded++;
        });

        await batch.commit();
      }

      // dataVersionを更新
      const settingsRef = doc(db, `seasons/${currentSeasonId}/draft_settings`, 'current');
      const settingsSnap = await getDoc(settingsRef);
      const currentVersion = settingsSnap.exists() ? (settingsSnap.data().dataVersion || 0) : 0;
      await setDoc(settingsRef, {
        ...(settingsSnap.exists() ? settingsSnap.data() : {}),
        currentRound: settingsSnap.exists() ? settingsSnap.data().currentRound : 1,
        isRunning: settingsSnap.exists() ? settingsSnap.data().isRunning : false,
        maxRounds: 10,
        dataVersion: currentVersion + 1,
      }, { merge: true });

      // シーズン情報を作成/更新
      const seasonInfoRef = doc(db, `seasons/${currentSeasonId}/info`, 'details');
      await setDoc(seasonInfoRef, {
        name: `鷹燕杯 Season ${parseInt(currentSeasonId) - 2021}`,
        year: parseInt(currentSeasonId),
        status: 'active',
      }, { merge: true });

      // app_settingsを作成/更新
      const appSettingsRef = doc(db, 'app_settings', 'config');
      const appSnap = await getDoc(appSettingsRef);
      const currentSeasons = appSnap.exists() ? (appSnap.data().availableSeasons || []) : [];
      if (!currentSeasons.includes(currentSeasonId)) {
        currentSeasons.push(currentSeasonId);
      }
      await setDoc(appSettingsRef, {
        currentSeasonId,
        availableSeasons: currentSeasons,
      }, { merge: true });

      setUploadResult({
        type: 'success',
        message: `${uploaded}件の馬データをアップロードしました（Season: ${currentSeasonId}）`,
      });
    } catch (error) {
      console.error('アップロードエラー:', error);
      setUploadResult({ type: 'error', message: `アップロード失敗: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  // 管理者ロール設定
  const handleSetAdmin = async () => {
    if (!userProfile) return;
    try {
      await setDoc(doc(db, 'users', userProfile.uid), { role: 'admin' }, { merge: true });
      alert('管理者ロールを設定しました。ページをリロードしてください。');
    } catch (error) {
      console.error('ロール設定エラー:', error);
    }
  };

  // 参加者追加
  const handleAddUser = async (user) => {
    const currentOrder = draftUsers.length + 1;
    await addDraftUser(currentSeasonId, user, currentOrder);
  };

  // 参加者削除
  const handleRemoveUser = async (userId) => {
    await removeDraftUser(currentSeasonId, userId);
  };

  // ドラフト開始
  const handleStartDraft = async () => {
    const round = draftSettings?.currentRound || 1;
    await startRound(currentSeasonId, round);
  };

  // ドラフト停止
  const handleStopDraft = async () => {
    await setPhase(currentSeasonId, 'waiting');
    const settingsRef = doc(db, `seasons/${currentSeasonId}/draft_settings`, 'current');
    await setDoc(settingsRef, { isRunning: false }, { merge: true });
  };

  // リセット
  const handleReset = async () => {
    await resetDraft(currentSeasonId);
    setShowResetConfirm(false);
  };

  // TSVテキスト変更時のプレビュー生成
  const handleHistTsvChange = (text) => {
    setHistTsvText(text);
    setHistImportResult(null);
    if (!text.trim()) { setHistPreview([]); return; }

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length <= 1) { setHistPreview([]); return; }

    let currentUser = '';
    const rows = [];
    lines.slice(1).forEach((line) => {
      const cols = line.split('\t');
      const userName = cols[0]?.trim();
      const horseName = cols[1]?.trim();
      const motherName = cols[2]?.trim() || '';
      if (userName) currentUser = userName;
      if (!currentUser || !horseName) return;
      rows.push({ userName: currentUser, horseName, motherName });
    });
    setHistPreview(rows);
  };

  // 過去シーズンインポート実行
  const handleHistImport = async () => {
    if (!histTsvText.trim() || !histSeasonId) return;
    setHistImporting(true);
    setHistImportResult(null);
    try {
      const result = await importHistoricalSeason(histSeasonId, histSeasonName, histTsvText);
      setHistImportResult({
        type: 'success',
        message: `インポート完了: ${result.userCount}名 / ${result.horseCount}頭（Season: ${histSeasonId}）`,
      });
      setHistTsvText('');
      setHistPreview([]);
    } catch (error) {
      setHistImportResult({ type: 'error', message: `インポート失敗: ${error.message}` });
    } finally {
      setHistImporting(false);
    }
  };

  // ドラフトに追加済みかどうか
  const isDraftUser = (userId) => draftUsers.some((u) => u.id === userId);

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          <h1 className="page-title">⚙️ 管理パネル</h1>

          {/* 管理者でない場合の表示 */}
          {!isAdmin && (
            <div className="admin-warning">
              <p>管理者権限が必要です。</p>
              <button className="btn btn-primary" onClick={handleSetAdmin}>
                自分を管理者に設定する
              </button>
            </div>
          )}

          {/* ドラフト進行セクション */}
          <section className="admin-section">
            <h2 className="section-header">🏇 ドラフト進行管理</h2>
            <div className="card">
              <div className="card-body">
                <div className="draft-status-info">
                  <div className="status-item">
                    <span className="status-label">ステータス</span>
                    <span className={`status-value ${draftSettings?.isRunning ? 'running' : ''}`}>
                      {draftSettings?.isRunning ? '🟢 進行中' : '⏸ 停止中'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">ラウンド</span>
                    <span className="status-value">{draftSettings?.currentRound || 1} / {draftSettings?.maxRounds || 10}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">フェーズ</span>
                    <span className="status-value">{draftSettings?.phase || 'waiting'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">参加者数</span>
                    <span className="status-value">{draftUsers.length}名</span>
                  </div>
                </div>

                <div className="draft-controls">
                  {!draftSettings?.isRunning ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleStartDraft}
                      disabled={draftUsers.length === 0}
                    >
                      ドラフト開始（R{draftSettings?.currentRound || 1}）
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={handleStopDraft}>
                      ドラフト停止
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    全データリセット
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 参加者管理セクション */}
          <section className="admin-section">
            <h2 className="section-header">👥 参加者管理</h2>
            <div className="card">
              <div className="card-body">
                {/* 現在の参加者 */}
                <h3 className="subsection-title">ドラフト参加者（{draftUsers.length}名）</h3>
                {draftUsers.length === 0 ? (
                  <p className="admin-desc">参加者がいません。下のリストから追加してください。</p>
                ) : (
                  <div className="participant-list">
                    {draftUsers.map((u) => (
                      <div key={u.id} className="participant-row">
                        <span className="participant-order">#{u.order}</span>
                        <span
                          className="participant-avatar-sm"
                          style={{ backgroundColor: u.avatarColor || '#1a6b3c' }}
                        >
                          {u.nickname?.charAt(0)}
                        </span>
                        <span className="participant-name-admin">{u.nickname}</span>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveUser(u.id)}
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 追加可能なユーザー */}
                <h3 className="subsection-title" style={{ marginTop: '16px' }}>登録ユーザー</h3>
                <div className="participant-list">
                  {allUsers
                    .filter((u) => !isDraftUser(u.id))
                    .map((u) => (
                      <div key={u.id} className="participant-row available">
                        <span
                          className="participant-avatar-sm"
                          style={{ backgroundColor: u.avatarColor || '#1a6b3c' }}
                        >
                          {u.nickname?.charAt(0) || '?'}
                        </span>
                        <span className="participant-name-admin">{u.nickname || u.email}</span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddUser(u)}
                        >
                          追加
                        </button>
                      </div>
                    ))}
                  {allUsers.filter((u) => !isDraftUser(u.id)).length === 0 && (
                    <p className="admin-desc">追加可能なユーザーがいません</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* CSVアップロードセクション */}
          <section className="admin-section">
            <h2 className="section-header">📂 馬データCSVアップロード</h2>
            <div className="card">
              <div className="card-body">
                <p className="admin-desc">
                  Season {currentSeasonId} の馬マスタデータをCSVファイルからアップロードします。
                  ファイルはShift-JIS形式に対応しています。
                </p>

                <div className="upload-area">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="file-input"
                    id="csv-upload-input"
                  />
                  <label htmlFor="csv-upload-input" className="file-label">
                    {file ? file.name : 'CSVファイルを選択'}
                  </label>
                </div>

                {/* プレビュー */}
                {previewData.length > 0 && (
                  <div className="preview-area">
                    <p className="preview-info">全{totalRows}件（先頭5件プレビュー）</p>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>登録番号</th>
                            <th>馬名</th>
                            <th>性別</th>
                            <th>父</th>
                            <th>母</th>
                            <th>母父</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, i) => (
                            <tr key={i} className={row['性別'] === '牝' ? 'female-row' : ''}>
                              <td>{row['登録番号']}</td>
                              <td>{row['馬名'] || row['(母名+生年)'] || '-'}</td>
                              <td>{row['性別']}</td>
                              <td>{row['父']}</td>
                              <td>{row['母']}</td>
                              <td>{row['母父']}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      className="btn btn-primary btn-lg upload-btn"
                      onClick={handleUpload}
                      disabled={uploading}
                    >
                      {uploading ? 'アップロード中...' : `${totalRows}件をFirestoreにアップロード`}
                    </button>
                  </div>
                )}

                {uploadResult && (
                  <div className={`upload-result ${uploadResult.type}`}>
                    {uploadResult.type === 'success' ? '✅' : '❌'} {uploadResult.message}
                  </div>
                )}
              </div>
            </div>
          </section>
          {/* 過去シーズンインポートセクション */}
          <section className="admin-section">
            <h2 className="section-header">📜 過去シーズンデータインポート</h2>
            <div className="card">
              <div className="card-body">
                <p className="admin-desc">
                  過去シーズンの指名履歴をタブ区切り（TSV）形式でインポートします。<br />
                  形式: <code>ユーザー名[TAB]馬名[TAB]母名[TAB]誕生年[TAB]コメント</code>（1行目はヘッダー、ユーザー名は空欄で前の値を引き継ぎ）
                </p>

                <div className="hist-import-fields">
                  <div className="hist-field-row">
                    <label className="hist-label">シーズンID</label>
                    <input
                      type="text"
                      className="hist-input"
                      value={histSeasonId}
                      onChange={(e) => setHistSeasonId(e.target.value)}
                      placeholder="例: 2022"
                    />
                  </div>
                  <div className="hist-field-row">
                    <label className="hist-label">シーズン名</label>
                    <input
                      type="text"
                      className="hist-input"
                      value={histSeasonName}
                      onChange={(e) => setHistSeasonName(e.target.value)}
                      placeholder="例: 鷹燕杯 Season 1"
                    />
                  </div>
                </div>

                <textarea
                  className="hist-textarea"
                  rows={8}
                  placeholder={'ユーザー名\t馬名\t母名\t誕生年\tコメント\nきのこ心中\tレヴォルタード\tバウンスシャッセ\t2020\t'}
                  value={histTsvText}
                  onChange={(e) => handleHistTsvChange(e.target.value)}
                />

                {histPreview.length > 0 && (
                  <div className="preview-area">
                    <p className="preview-info">
                      全{histPreview.length}頭プレビュー
                      （{[...new Set(histPreview.map((r) => r.userName))].length}名）
                    </p>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>ユーザー名</th>
                            <th>馬名</th>
                            <th>母名</th>
                          </tr>
                        </thead>
                        <tbody>
                          {histPreview.slice(0, 10).map((row, i) => (
                            <tr key={i}>
                              <td>{row.userName}</td>
                              <td>{row.horseName}</td>
                              <td>{row.motherName}</td>
                            </tr>
                          ))}
                          {histPreview.length > 10 && (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', color: '#666' }}>
                                他 {histPreview.length - 10} 頭...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <button
                      className="btn btn-primary btn-lg upload-btn"
                      onClick={handleHistImport}
                      disabled={histImporting}
                    >
                      {histImporting ? 'インポート中...' : `Season ${histSeasonId} としてインポート`}
                    </button>
                  </div>
                )}

                {histImportResult && (
                  <div className={`upload-result ${histImportResult.type}`}>
                    {histImportResult.type === 'success' ? '✅' : '❌'} {histImportResult.message}
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* リセット確認モーダル */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="⚠️ ドラフトデータリセット"
        message="ドラフトの全データ（指名・確定結果）を削除します。この操作は取り消せません。"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
        confirmLabel="リセットを実行"
        danger
      />
    </>
  );
}

