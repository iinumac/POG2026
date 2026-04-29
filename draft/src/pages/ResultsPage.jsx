// 確定一覧画面 - 全ラウンド確定結果のマトリクス表示
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useDraftState } from '../hooks/useDraftState';
import { useSeason } from '../contexts/SeasonContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './ResultsPage.css';

export default function ResultsPage() {
  const { fixedResults, draftUsers, draftSettings } = useDraftState();
  const { currentSeasonId, availableSeasons, switchSeason } = useSeason();
  const [viewSeasonId, setViewSeasonId] = useState(currentSeasonId);
  const [seasonResults, setSeasonResults] = useState([]);
  const [seasonUsers, setSeasonUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 表示中のシーズンが現在のシーズンと同じかどうか
  const isCurrentSeason = viewSeasonId === currentSeasonId;
  const maxRounds = draftSettings?.maxRounds || 10;

  // シーズン変更時にデータを取得
  useEffect(() => {
    if (isCurrentSeason) {
      // 現在のシーズンはリアルタイムデータを使用
      setSeasonResults(fixedResults);
      setSeasonUsers(draftUsers);
    } else {
      // 過去シーズンはFirestoreから一括取得
      fetchSeasonData(viewSeasonId);
    }
  }, [viewSeasonId, isCurrentSeason, fixedResults, draftUsers]);

  const fetchSeasonData = async (seasonId) => {
    setLoading(true);
    try {
      // 確定結果を取得
      const resultsRef = collection(db, `seasons/${seasonId}/fixed_results`);
      const resultsSnap = await getDocs(resultsRef);
      const results = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 参加者を取得
      const usersRef = collection(db, `seasons/${seasonId}/draft_users`);
      const usersSnap = await getDocs(usersRef);
      const users = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      setSeasonResults(results);
      setSeasonUsers(users);
    } catch (error) {
      console.error('過去シーズン取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // ユーザーごとのラウンド別結果をマトリクスに変換
  const buildMatrix = () => {
    const users = isCurrentSeason ? draftUsers : seasonUsers;
    const results = isCurrentSeason ? fixedResults : seasonResults;

    return users.map((user) => {
      const userResults = {};
      results
        .filter((r) => r.userId === user.id)
        .forEach((r) => {
          userResults[r.round] = r;
        });
      return { user, results: userResults };
    });
  };

  const matrix = buildMatrix();
  const displayUsers = isCurrentSeason ? draftUsers : seasonUsers;

  return (
    <>
      <Header />
      <main className="page-content">
        <div className="container">
          <div className="results-header">
            <h1 className="page-title">📊 確定一覧</h1>

            {/* シーズン選択 */}
            {availableSeasons.length > 1 && (
              <div className="season-selector">
                <label className="season-label">シーズン:</label>
                <select
                  className="season-dropdown"
                  value={viewSeasonId}
                  onChange={(e) => setViewSeasonId(e.target.value)}
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s}>
                      S{parseInt(s) - 2021} ({s})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!isCurrentSeason && (
            <div className="past-season-notice">
              📜 過去シーズン（{viewSeasonId}）の結果を表示中 — 閲覧専用
            </div>
          )}

          {loading ? (
            <div className="results-loading">読み込み中...</div>
          ) : displayUsers.length === 0 ? (
            <div className="results-empty">
              <p>参加者がいません</p>
            </div>
          ) : (
            <div className="results-matrix-wrapper">
              <table className="results-matrix">
                <thead>
                  <tr>
                    <th className="matrix-header-user">参加者</th>
                    {[...Array(maxRounds)].map((_, i) => (
                      <th key={i} className="matrix-header-round">
                        <span className="round-num">{i + 1}巡</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(({ user, results }) => (
                    <tr key={user.id} className="matrix-row">
                      <td className="matrix-user-cell">
                        <div className="matrix-user">
                          <span
                            className="matrix-avatar"
                            style={{ backgroundColor: user.avatarColor || '#1a6b3c' }}
                          >
                            {user.nickname?.charAt(0) || '?'}
                          </span>
                          <span className="matrix-nickname">{user.nickname}</span>
                        </div>
                      </td>
                      {[...Array(maxRounds)].map((_, i) => {
                        const round = i + 1;
                        const result = results[round];
                        return (
                          <td key={round} className={`matrix-cell ${result ? 'has-result' : ''}`}>
                            {result ? (
                              <div className="matrix-horse">
                                <span className={`matrix-gender ${result.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
                                  {result.gender === '牝' ? '♀' : '♂'}
                                </span>
                                <span className="matrix-horse-name">{result.horseName}</span>
                              </div>
                            ) : (
                              <span className="matrix-empty">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
