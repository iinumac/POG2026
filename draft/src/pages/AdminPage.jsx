// 管理パネル画面
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useDraftState } from '../hooks/useDraftState';
import { collection, doc, setDoc, getDoc, getDocs, Bytes } from 'firebase/firestore';
import { db } from '../firebase';
import { startRound, addDraftUser, removeDraftUser, resetDraft, setPhase, importHistoricalSeason, syncFavoritesWithMaster, uploadNikkanRanking } from '../services/draftService';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, userProfile } = useAuth();
  const { currentSeasonId } = useSeason();
  const { draftSettings, draftUsers, loading: draftLoading } = useDraftState();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [changeLog, setChangeLog] = useState(null);
  const fileRef = useRef(null);

  // 全登録ユーザー
  const [allUsers, setAllUsers] = useState([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 日刊ランキング
  const [nikkanFetching, setNikkanFetching] = useState(false);
  const [nikkanProgress, setNikkanProgress] = useState('');
  const [nikkanResult, setNikkanResult] = useState(null);
  const [nikkanPreview, setNikkanPreview] = useState(null);

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

  // 比較対象フィールド
  const COMPARE_FIELDS = ['馬名', '性別', '父', '母', '母父', '調教師', '東西', '生産者', '馬主'];

  // 既存スナップショットを解凍して返す
  const decompressSnapshot = async (seasonId) => {
    try {
      const snapshotRef = doc(db, `seasons/${seasonId}/snapshots`, 'horses');
      const snap = await getDoc(snapshotRef);
      if (!snap.exists()) return null;
      const compressed = snap.data().data.toUint8Array();
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const json = await new Response(stream).text();
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // 旧データと新データの差分を検出
  const buildDiffLog = (oldHorses, newHorses) => {
    const oldMap = {};
    if (oldHorses) oldHorses.forEach((h) => { if (h.登録番号) oldMap[h.登録番号] = h; });

    const added = [];
    const updated = [];
    let unchanged = 0;

    newHorses.forEach((h) => {
      const id = h.登録番号;
      if (!id) return;
      const old = oldMap[id];
      if (!old) {
        added.push({ regNum: id, horseName: h.馬名 });
        return;
      }
      const changes = [];
      COMPARE_FIELDS.forEach((key) => {
        const oldVal = old[key] || '';
        const newVal = h[key] || '';
        if (oldVal !== newVal) changes.push({ field: key, from: oldVal, to: newVal });
      });
      if (changes.length > 0) {
        updated.push({ regNum: id, horseName: h.馬名, changes });
      } else {
        unchanged++;
      }
      delete oldMap[id];
    });

    const removed = Object.values(oldMap).map((h) => ({ regNum: h.登録番号, horseName: h.馬名 }));
    return { added, updated, removed, unchanged };
  };

  // Firestoreにアップロード
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setChangeLog(null);

    try {
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const text = decoder.decode(buffer);
      const data = parseCSV(text);

      const currentYear = parseInt(currentSeasonId) || 2026;

      const horses = [];
      data.forEach((row) => {
        const regNum = row['登録番号'];
        if (!regNum) return;

        const defaultName = row['母'] ? `${row['母']}の${currentYear}` : '';
        const horseName = row['馬名'] || row['(母名+生年)'] || defaultName;
        const netkeibaUrl = regNum ? `https://db.netkeiba.com/horse/${regNum}/` : '';

        horses.push({
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
        });
      });

      // 差分検出：旧スナップショットと比較
      const oldHorses = await decompressSnapshot(currentSeasonId);
      const diff = buildDiffLog(oldHorses, horses);

      // JSON化 → gzip 圧縮 → Firestore Bytes として1ドキュメントに保存
      const json = JSON.stringify(horses);
      const compressedStream = new Blob([json])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const compressedBuffer = await new Response(compressedStream).arrayBuffer();
      const compressedBytes = new Uint8Array(compressedBuffer);

      // Firestoreドキュメント上限は 1,048,576 bytes。フィールド等のオーバーヘッドを考慮し1MBで弾く。
      const MAX_BYTES = 1_000_000;
      if (compressedBytes.byteLength > MAX_BYTES) {
        throw new Error(
          `圧縮後サイズ ${compressedBytes.byteLength} bytes が上限 (${MAX_BYTES}) を超えています。データ分割対応が必要です。`
        );
      }

      const snapshotRef = doc(db, `seasons/${currentSeasonId}/snapshots`, 'horses');
      await setDoc(snapshotRef, {
        data: Bytes.fromUint8Array(compressedBytes),
        count: horses.length,
        compressedSize: compressedBytes.byteLength,
        updatedAt: new Date(),
      });

      const uploaded = horses.length;

      // 初回シーズン作成時のためにdraft_settingsを保証
      const settingsRef = doc(db, `seasons/${currentSeasonId}/draft_settings`, 'current');
      const settingsSnap = await getDoc(settingsRef);
      await setDoc(settingsRef, {
        ...(settingsSnap.exists() ? settingsSnap.data() : {}),
        currentRound: settingsSnap.exists() ? settingsSnap.data().currentRound : 1,
        isRunning: settingsSnap.exists() ? settingsSnap.data().isRunning : false,
        maxRounds: 10,
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

      // お気に入りデータを最新の馬マスタと同期
      const syncResult = await syncFavoritesWithMaster(currentSeasonId, horses);

      // 変更ログを保存
      setChangeLog({ ...diff, favsSynced: syncResult.details });

      setUploadResult({
        type: 'success',
        message: `${uploaded}件アップロード（圧縮: ${(compressedBytes.byteLength / 1024).toFixed(1)} KB）`
          + ` — 新規${diff.added.length} / 更新${diff.updated.length} / 削除${diff.removed.length} / 変更なし${diff.unchanged}`
          + (syncResult.count > 0 ? ` / お気に入り同期${syncResult.count}件` : ''),
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

  // 日刊ランキング — CORSプロキシ経由で1ページ取得
  const NIKKAN_MAX_PAGES = 20;
  const NIKKAN_BASE = 'https://www.nikkankeiba.com/pog2026/index.php';

  // 複数プロキシをフォールバック付きで試行
  const PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];
  const proxyIndexRef = useRef(0); // 一度成功したプロキシを記憶

  const fetchNikkanPage = async (page) => {
    const target = `${NIKKAN_BASE}?func=ranking_horse&kwd_horse=&page=${page}`;

    // 前回成功したプロキシから試す
    const startIdx = proxyIndexRef.current;
    for (let attempt = 0; attempt < PROXIES.length; attempt++) {
      const idx = (startIdx + attempt) % PROXIES.length;
      const proxyUrl = PROXIES[idx](target);
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const html = new TextDecoder('euc-jp').decode(buf);
        if (html.includes('ranking_horse') || html.includes('netkeiba')) {
          proxyIndexRef.current = idx; // 成功したプロキシを記憶
          return html;
        }
      } catch { /* 次のプロキシへ */ }
    }
    throw new Error('全てのプロキシが利用できませんでした。CLI（node tools/fetch-nikkan-ranking.cjs）をお試しください。');
  };

  const parseNikkanHtml = (html) => {
    const rows = [];
    const trPattern = /<tr[^>]*>([\s\S]*?)(?=<tr|$)/gi;
    let trMatch;
    while ((trMatch = trPattern.exec(html)) !== null) {
      const row = trMatch[1];
      const linkMatch = row.match(/db\.netkeiba\.com\/horse\/(\d+)/);
      if (!linkMatch) continue;
      const regNum = linkMatch[1];

      const cells = {};
      const tdPattern = /<td\s+class="(\w+)"[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdPattern.exec(row)) !== null) {
        const cn = tdMatch[1];
        const txt = tdMatch[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
        if (!cells[cn]) cells[cn] = txt;
      }

      const nameMatch = row.match(/<td\s+class="bamei"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
      const horseName = nameMatch ? nameMatch[1].trim() : cells.bamei || '';
      const genderMatch = row.match(/<td\s+class="rank"[^>]*>[^<]*<\/td>[\s\S]*?<td\s+class="rank"[^>]*>([^<]*)<\/td>/i);

      const rank = parseInt(cells.rank) || 0;
      const nominees = parseInt(cells.shimei) || 0;
      if (rank > 0 && regNum) {
        rows.push({
          rank, regNum, horseName,
          gender: genderMatch ? genderMatch[1].trim() : '',
          trainer: cells.kyusha || '',
          nominees,
        });
      }
    }
    return rows;
  };

  // ボタン押下 → 取得 → パース → Firestore 投入
  const handleNikkanFetch = async () => {
    setNikkanFetching(true);
    setNikkanResult(null);
    setNikkanPreview(null);

    try {
      const allResults = [];
      for (let page = 1; page <= NIKKAN_MAX_PAGES; page++) {
        setNikkanProgress(`ページ ${page}/${NIKKAN_MAX_PAGES} を取得中...`);
        const html = await fetchNikkanPage(page);
        const rows = parseNikkanHtml(html);
        if (rows.length === 0) break;
        allResults.push(...rows);
      }

      if (allResults.length === 0) throw new Error('データが取得できませんでした');

      setNikkanProgress('Firestore に保存中...');
      const result = await uploadNikkanRanking(currentSeasonId, allResults);

      setNikkanPreview({ count: allResults.length, top5: allResults.slice(0, 5) });
      setNikkanResult({
        type: 'success',
        message: `${result.count}頭のランキングデータを取得・更新しました（${allResults[0].rank}位〜${allResults[allResults.length - 1].rank}位 / Season: ${currentSeasonId}）`,
      });
    } catch (error) {
      console.error('日刊ランキング取得エラー:', error);
      setNikkanResult({ type: 'error', message: `取得失敗: ${error.message}` });
    } finally {
      setNikkanFetching(false);
      setNikkanProgress('');
    }
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
                    <span className="status-label">巡目</span>
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
                      ドラフト開始（{draftSettings?.currentRound || 1}巡目）
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={handleStopDraft}>
                      ドラフト停止
                    </button>
                  )}
                  <button className="btn btn-gold" onClick={() => navigate('/draft/result')}>
                    📋 指名結果発表ページ
                  </button>
                  <button className="btn btn-gold" onClick={() => navigate('/draft')}>
                    🏇 指名画面
                  </button>
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

          {/* 日刊ランキング更新セクション */}
          <section className="admin-section">
            <h2 className="section-header">📰 日刊競馬POG ランキング更新</h2>
            <div className="card">
              <div className="card-body">
                <p className="admin-desc">
                  日刊競馬POGの指名馬ランキング（{NIKKAN_MAX_PAGES}ページ分）を取得し、Firestore に反映します。
                </p>

                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleNikkanFetch}
                  disabled={nikkanFetching}
                >
                  {nikkanFetching ? nikkanProgress || '取得中...' : 'ランキングを取得 & 更新'}
                </button>

                {nikkanPreview && (
                  <div className="preview-area" style={{ marginTop: 'var(--space-md)' }}>
                    <p className="preview-info">全{nikkanPreview.count}頭（上位5件）</p>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>順位</th>
                            <th>馬名</th>
                            <th>性別</th>
                            <th>厩舎</th>
                            <th>指名者数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nikkanPreview.top5.map((r) => (
                            <tr key={r.regNum}>
                              <td>{r.rank}</td>
                              <td>{r.horseName}</td>
                              <td>{r.gender}</td>
                              <td>{r.trainer}</td>
                              <td>{r.nominees}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {nikkanResult && (
                  <div className={`upload-result ${nikkanResult.type}`}>
                    {nikkanResult.type === 'success' ? '✅' : '❌'} {nikkanResult.message}
                  </div>
                )}
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

                {/* 変更ログ */}
                {changeLog && (uploadResult?.type === 'success') && (
                  <ChangeLogView log={changeLog} />
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

// ════════════════════════════════════════════════
// 変更ログ表示コンポーネント
// ════════════════════════════════════════════════
function ChangeLogView({ log }) {
  const [expanded, setExpanded] = useState(null); // 'added' | 'updated' | 'removed' | 'favs'
  const toggle = (key) => setExpanded(expanded === key ? null : key);

  const hasUpdates = log.updated.length > 0;
  const hasAdded = log.added.length > 0;
  const hasRemoved = log.removed.length > 0;
  const hasFavs = log.favsSynced?.length > 0;

  if (!hasUpdates && !hasAdded && !hasRemoved && !hasFavs) {
    return <div className="changelog"><p className="changelog-empty">変更はありませんでした</p></div>;
  }

  return (
    <div className="changelog">
      <h4 className="changelog-title">変更ログ</h4>

      {hasAdded && (
        <div className="changelog-section">
          <button className="changelog-toggle" onClick={() => toggle('added')}>
            <span className="changelog-badge added">{log.added.length}</span>
            新規追加
            <span className="changelog-arrow">{expanded === 'added' ? '▼' : '▶'}</span>
          </button>
          {expanded === 'added' && (
            <ul className="changelog-list">
              {log.added.map((h) => (
                <li key={h.regNum}><code>{h.regNum}</code> {h.horseName}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasUpdates && (
        <div className="changelog-section">
          <button className="changelog-toggle" onClick={() => toggle('updated')}>
            <span className="changelog-badge updated">{log.updated.length}</span>
            更新
            <span className="changelog-arrow">{expanded === 'updated' ? '▼' : '▶'}</span>
          </button>
          {expanded === 'updated' && (
            <table className="changelog-table">
              <thead>
                <tr><th>馬名</th><th>項目</th><th>変更前</th><th>変更後</th></tr>
              </thead>
              <tbody>
                {log.updated.map((h) =>
                  h.changes.map((c, i) => (
                    <tr key={`${h.regNum}_${c.field}`}>
                      {i === 0 && <td rowSpan={h.changes.length} className="changelog-horse">{h.horseName || h.regNum}</td>}
                      <td className="changelog-field">{c.field}</td>
                      <td className="changelog-from">{c.from || '（空）'}</td>
                      <td className="changelog-to">{c.to || '（空）'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {hasRemoved && (
        <div className="changelog-section">
          <button className="changelog-toggle" onClick={() => toggle('removed')}>
            <span className="changelog-badge removed">{log.removed.length}</span>
            削除（旧データのみ）
            <span className="changelog-arrow">{expanded === 'removed' ? '▼' : '▶'}</span>
          </button>
          {expanded === 'removed' && (
            <ul className="changelog-list">
              {log.removed.map((h) => (
                <li key={h.regNum}><code>{h.regNum}</code> {h.horseName}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasFavs && (
        <div className="changelog-section">
          <button className="changelog-toggle" onClick={() => toggle('favs')}>
            <span className="changelog-badge favs">{log.favsSynced.length}</span>
            お気に入り同期
            <span className="changelog-arrow">{expanded === 'favs' ? '▼' : '▶'}</span>
          </button>
          {expanded === 'favs' && (
            <table className="changelog-table">
              <thead>
                <tr><th>馬名</th><th>項目</th><th>変更前</th><th>変更後</th></tr>
              </thead>
              <tbody>
                {log.favsSynced.map((f) =>
                  f.changes.map((c, i) => (
                    <tr key={`${f.horseName}_${c.field}`}>
                      {i === 0 && <td rowSpan={f.changes.length} className="changelog-horse">{f.horseName}</td>}
                      <td className="changelog-field">{c.field}</td>
                      <td className="changelog-from">{c.from || '（空）'}</td>
                      <td className="changelog-to">{c.to || '（空）'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

