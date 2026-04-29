// お気に入り馬管理画面 — v2 Dense Layout + Grades + Score + Inline Edit
import { useState, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import { useHorseSearch } from '../hooks/useHorseSearch';
import { useFavorites } from '../hooks/useFavorites';
import { useDraftState } from '../hooks/useDraftState';
import { useAuth } from '../contexts/AuthContext';
import { Star, Search, X, Plus, Edit, Trash, Check, Info, ExternalLink } from '../components/Icons';
import './FavoritesPage.css';

const EVAL_GRADES = ['A', 'B', 'C'];
const EVAL_FIELDS = [
  { key: 'pedigreeGrade', label: '血', long: '血統' },
  { key: 'buildGrade', label: '体', long: '体格' },
  { key: 'growthGrade', label: '成', long: '成長' },
];

function horseName(h) {
  return h?.horseName || h?.馬名 || h?.name || '（不明）';
}
function fatherName(h) { return h?.fatherName || h?.父 || ''; }
function motherName(h) { return h?.motherName || h?.母 || ''; }
function motherFatherName(h) { return h?.motherFatherName || h?.母父 || ''; }

function genderChar(h) {
  const g = h?.gender || h?.性別;
  if (g === '牝' || g === 'f') return 'f';
  return 'm';
}
function genderSymbol(g) { return g === 'f' ? '♀' : '♂'; }

// ひらがな→カタカナ変換
function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

// 検索語にマッチする部分を <mark> で囲んで返す
function HighlightText({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const normText = toKatakana(text);
  const normQuery = toKatakana(query);
  const idx = normText.indexOf(normQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="v2-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ドラフト指名状況バッジ（ツールチップ付き）
function DraftInfoBadge({ info }) {
  if (!info || info.type === 'conflict') return null;

  const label = {
    confirmed_mine: '獲得済',
    confirmed_other: '指名済',
    nominated: '単独指名',
    rejected: '落選',
  }[info.type] || '';

  const colorClass = {
    confirmed_mine: 'di-mine',
    confirmed_other: 'di-other',
    nominated: 'di-nominated',
    rejected: 'di-rejected',
  }[info.type] || '';

  let tooltip = '';
  if (info.type === 'confirmed_mine') tooltip = `${info.round}巡目 自分が獲得`;
  else if (info.type === 'confirmed_other') tooltip = `${info.round}巡目 ${info.userName} が獲得`;
  else if (info.type === 'nominated') tooltip = `${info.round}巡目 ${info.userName} が指名中（単独）`;
  else if (info.type === 'rejected') tooltip = `${info.round}巡目 ${info.userName} が落選 → 再指名`;

  return (
    <span className={`v2-draft-info-badge ${colorClass}`}>
      <Info size={10} />
      <span className="v2-draft-info-label">{label}</span>
      <span className="v2-draft-info-tooltip">{tooltip}</span>
    </span>
  );
}

export default function FavoritesPage() {
  const { results, loading: searchLoading, search, cacheReady, cacheCount, cacheLoading } = useHorseSearch();
  const { favorites, loading: favLoading, toggleFavorite, isFavorite, updateEvaluation, removeFavorite, addFavorite } = useFavorites();
  const { fixedResults, currentRoundStatuses, draftUsers, draftSettings } = useDraftState();
  const { user } = useAuth();

  // 馬ごとのドラフト指名状況マップ
  const draftStatusMap = useMemo(() => {
    const myUid = user?.uid;
    const map = {};
    // 確定済み → 自分 or 他者で分ける
    fixedResults.forEach((r) => {
      const u = draftUsers.find((du) => du.id === r.userId);
      map[r.umaId] = {
        type: r.userId === myUid ? 'confirmed_mine' : 'confirmed_other',
        round: r.round,
        userName: u?.nickname || '???',
      };
    });
    // 現ラウンドの指名（確定済みでないもの、競合は除外）
    currentRoundStatuses.forEach((s) => {
      if (map[s.umaId]) return;
      const u = draftUsers.find((du) => du.id === s.nominatedBy);
      const sameHorse = currentRoundStatuses.filter((x) => x.umaId === s.umaId);
      if (sameHorse.length > 1) return; // 競合は表示しない
      if (s.status === 'rejected') {
        map[s.umaId] = { type: 'rejected', round: draftSettings?.currentRound, userName: u?.nickname || '???' };
      } else {
        map[s.umaId] = { type: 'nominated', round: draftSettings?.currentRound, userName: u?.nickname || '???' };
      }
    });
    return map;
  }, [fixedResults, currentRoundStatuses, draftUsers, draftSettings, user]);

  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rank');
  const [editingId, setEditingId] = useState(null);
  // 追加フォーム表示中の馬
  const [addingHorse, setAddingHorse] = useState(null);

  const handleSearch = (q) => {
    setQuery(q);
    if (q.trim()) search(q);
  };

  // 統計情報
  const stats = useMemo(() => {
    let withScore = 0;
    const gradeCount = { A: 0, B: 0, C: 0 };
    for (const f of favorites) {
      if (f.score != null) withScore++;
      for (const ef of EVAL_FIELDS) {
        const g = f[ef.key];
        if (g && gradeCount[g] !== undefined) gradeCount[g]++;
      }
    }
    return { withScore, gradeCount };
  }, [favorites]);

  // ソート・フィルター
  const filteredFavs = useMemo(() => {
    let items = [...favorites];
    if (genderFilter !== 'all') items = items.filter((f) => genderChar(f) === genderFilter);
    if (regionFilter !== 'all') items = items.filter((f) => f.region === regionFilter);

    const collator = new Intl.Collator('ja');
    const gradeOrder = { A: 0, B: 1, C: 2 };
    items.sort((a, b) => {
      let r = 0;
      switch (sortBy) {
        case 'rank': r = (a.priority || 999) - (b.priority || 999); break;
        case 'score': r = (b.score ?? -1) - (a.score ?? -1); break;
        case 'pedigree': case 'build': case 'growth': {
          const key = sortBy + 'Grade';
          r = (gradeOrder[a[key]] ?? 99) - (gradeOrder[b[key]] ?? 99); break;
        }
        case 'name': r = collator.compare(horseName(a), horseName(b)); break;
        default: break;
      }
      return r !== 0 ? r : (a.priority || 999) - (b.priority || 999);
    });
    return items;
  }, [favorites, genderFilter, regionFilter, sortBy]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return results.filter((h) => !isFavorite(h.登録番号 || h.id));
  }, [results, query, isFavorite]);

  // 追加フォームから登録
  const handleAddWithEval = async (horse, evalData) => {
    await addFavorite(horse);
    // addFavorite後にevalDataを保存
    const horseId = horse.登録番号 || horse.id;
    if (evalData && Object.values(evalData).some((v) => v != null && v !== '')) {
      await updateEvaluation(horseId, evalData);
    }
    setAddingHorse(null);
    setQuery('');
  };

  return (
    <>
      <Header />
      <main className="v2-page" style={{ paddingBottom: 80 }}>
        <div className="v2-fav-page">
          {/* ヘッダー */}
          <div className="v2-fav-page-head">
            <h1 className="v2-page-title"><Star size={18} /> お気に入り馬</h1>
            <div className="v2-fav-stats">
              <div className="v2-fav-stat-main">
                <b>{filteredFavs.length}</b>
                <span>/ {favorites.length} 頭</span>
              </div>
              <div className="v2-fav-stat-chips">
                <span className="v2-fav-stat-chip"><i>点数</i>{stats.withScore}</span>
                <span className="v2-fav-stat-chip grade-A"><i>A</i>{stats.gradeCount.A}</span>
                <span className="v2-fav-stat-chip grade-B"><i>B</i>{stats.gradeCount.B}</span>
                <span className="v2-fav-stat-chip grade-C"><i>C</i>{stats.gradeCount.C}</span>
              </div>
            </div>
          </div>

          {/* ツールバー */}
          <div className="v2-fav-toolbar">
            <div className="v2-fav-search">
              <Search size={14} />
              <input type="text" placeholder="馬名・父・母で検索してお気に入りに追加..."
                value={query} onChange={(e) => handleSearch(e.target.value)} disabled={cacheLoading} />
              {query && <button className="v2-btn-icon" onClick={() => setQuery('')}><X size={13} /></button>}
            </div>
            <div className="v2-fav-filters">
              <button className={`v2-fav-filter ${genderFilter === 'all' ? 'active' : ''}`} onClick={() => setGenderFilter('all')}>全て</button>
              <button className={`v2-fav-filter ${genderFilter === 'm' ? 'active' : ''}`} onClick={() => setGenderFilter('m')}>♂</button>
              <button className={`v2-fav-filter ${genderFilter === 'f' ? 'active' : ''}`} onClick={() => setGenderFilter('f')}>♀</button>
              <div className="v2-fav-filter-sep" />
              <button className={`v2-fav-filter ${regionFilter === 'all' ? 'active' : ''}`} onClick={() => setRegionFilter('all')}>全厩舎</button>
              <button className={`v2-fav-filter ${regionFilter === '栗東' ? 'active' : ''}`} onClick={() => setRegionFilter('栗東')}>栗東</button>
              <button className={`v2-fav-filter ${regionFilter === '美浦' ? 'active' : ''}`} onClick={() => setRegionFilter('美浦')}>美浦</button>
              <div className="v2-fav-filter-sep" />
              <span className="v2-fav-sort-label">並び:</span>
              <button className={`v2-fav-filter ${sortBy === 'rank' ? 'active' : ''}`} onClick={() => setSortBy('rank')}>順位</button>
              <button className={`v2-fav-filter ${sortBy === 'score' ? 'active' : ''}`} onClick={() => setSortBy('score')}>点数</button>
              <button className={`v2-fav-filter ${sortBy === 'pedigree' ? 'active' : ''}`} onClick={() => setSortBy('pedigree')}>血統</button>
              <button className={`v2-fav-filter ${sortBy === 'build' ? 'active' : ''}`} onClick={() => setSortBy('build')}>体格</button>
              <button className={`v2-fav-filter ${sortBy === 'growth' ? 'active' : ''}`} onClick={() => setSortBy('growth')}>成長</button>
              <button className={`v2-fav-filter ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>馬名</button>
            </div>
          </div>

          {cacheLoading && (
            <div className="v2-fav-cache-banner">馬データを読み込み中... ({cacheCount}件キャッシュ済み)</div>
          )}

          {/* 追加フォーム（評価同時入力） */}
          {addingHorse && (
            <AddHorseForm horse={addingHorse} onAdd={handleAddWithEval} onCancel={() => setAddingHorse(null)} nextRank={favorites.length + 1} />
          )}

          {/* 検索結果 */}
          {query.trim() && !addingHorse && (
            <div className="v2-fav-results">
              <div className="v2-fav-results-head">
                <span><Search size={11} style={{ marginRight: 4 }} />検索結果 {searchResults.length}件</span>
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  クリックで追加フォームを表示
                </span>
              </div>
              <div className="v2-fav-results-list">
                {searchLoading ? (
                  <div className="v2-empty">検索中...</div>
                ) : searchResults.length === 0 ? (
                  <div className="v2-empty"><Search />「{query}」に一致する馬がありません</div>
                ) : (
                  searchResults.map((h) => (
                    <div key={h.id || h.登録番号} className="v2-fav-result-row" onClick={() => setAddingHorse(h)}>
                      <div className="v2-fav-name-cell">
                        <span className={`v2-fav-gender-badge ${genderChar(h)}`}>{genderSymbol(genderChar(h))}</span>
                        <span className="v2-fav-name"><HighlightText text={horseName(h)} query={query} /></span>
                        {(h.登録番号 || h.id) && (
                          <a href={`https://db.netkeiba.com/horse/${h.登録番号 || h.id}/`} target="_blank" rel="noopener noreferrer"
                             className="v2-fav-netkeiba" title="netkeibaで見る" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <div className="v2-fav-result-ped">
                        <span className="v2-fav-result-ped-item"><i>父</i><b><HighlightText text={fatherName(h)} query={query} /></b></span>
                        <span className="v2-fav-result-ped-item"><i>母</i><b><HighlightText text={motherName(h)} query={query} /></b></span>
                        <span className="v2-fav-result-ped-item"><i>母父</i><b><HighlightText text={motherFatherName(h)} query={query} /></b></span>
                      </div>
                      <div className="v2-fav-trainer">
                        {(h.東西 || h.region) && <span className={`v2-fav-region-tag ${genderChar(h)}`}>{h.東西 || h.region}</span>}
                        {h.調教師 || h.trainer || ''}
                      </div>
                      <button className="v2-btn v2-btn-gold v2-btn-sm"><Plus size={12} />追加</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* お気に入りリスト */}
          <div className="v2-fav-list">
            {filteredFavs.length > 0 && (
              <div className="v2-fav-rowc v2-fav-rowc-head">
                <div className="v2-fav-colh rank">順位</div>
                <div className="v2-fav-colh main">馬名・血統・メモ</div>
                <div className="v2-fav-colh grades">
                  <span title="血統">血</span><span title="体格">体</span><span title="成長">成</span>
                </div>
                <div className="v2-fav-colh score">点数</div>
                <div className="v2-fav-colh actions"></div>
              </div>
            )}
            {favLoading ? (
              <div className="v2-empty">読み込み中...</div>
            ) : filteredFavs.length === 0 ? (
              <div className="v2-empty">
                <Star />お気に入り馬はまだ登録されていません
                <br /><span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>上の検索から馬を探して追加してください</span>
              </div>
            ) : (
              filteredFavs.map((fav, index) => (
                <FavRow key={fav.id} fav={fav} index={index}
                  editing={editingId === fav.id} lockedByOther={editingId != null && editingId !== fav.id}
                  onStartEdit={() => setEditingId(fav.id)} onCancelEdit={() => setEditingId(null)}
                  onSave={updateEvaluation} onRemove={() => removeFavorite(fav.id)}
                  draftInfo={draftStatusMap[fav.umaId || fav.id]} />
              ))
            )}
          </div>

          <div className="v2-fav-hint">
            <Info size={12} />
            各行の <b>鉛筆</b> で評価を編集、<b>ゴミ箱</b> でお気に入りから削除。評価は A / B / C の3段階（A=青 / B=赤 / C=緑）。
          </div>
        </div>
      </main>
    </>
  );
}

// ════════════════════════════════════════════════
// 追加フォーム（評価を同時入力してから登録）
// ════════════════════════════════════════════════
function AddHorseForm({ horse, onAdd, onCancel, nextRank }) {
  const [rank, setRank] = useState(nextRank);
  const [score, setScore] = useState('');
  const [memo, setMemo] = useState('');
  const [pedigreeGrade, setPedigreeGrade] = useState(null);
  const [buildGrade, setBuildGrade] = useState(null);
  const [growthGrade, setGrowthGrade] = useState(null);
  const g = genderChar(horse);

  const gradeState = { pedigreeGrade, buildGrade, growthGrade };
  const gradeSetters = { pedigreeGrade: setPedigreeGrade, buildGrade: setBuildGrade, growthGrade: setGrowthGrade };
  const toggleGrade = (key, val) => gradeSetters[key](gradeState[key] === val ? null : val);

  const handleSubmit = () => {
    onAdd(horse, {
      priority: rank === '' ? null : Number(rank),
      score: score === '' ? null : Number(score),
      memo,
      pedigreeGrade: pedigreeGrade || null,
      buildGrade: buildGrade || null,
      growthGrade: growthGrade || null,
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="v2-add-form">
      <div className="v2-add-form-header">
        <span className="v2-add-form-title"><Plus size={14} /> お気に入りに追加</span>
        <button className="v2-btn-icon" onClick={onCancel}><X size={14} /></button>
      </div>

      {/* 馬情報 */}
      <div className="v2-add-form-horse">
        <span className={`v2-fav-gender-badge ${g}`}>{genderSymbol(g)}</span>
        <div className="v2-add-form-horse-info">
          <div className="v2-add-form-horse-name">{horseName(horse)}</div>
          <div className="v2-add-form-horse-ped">
            <span><i>父</i><b>{fatherName(horse)}</b></span>
            <span><i>母</i><b>{motherName(horse)}</b></span>
            {motherFatherName(horse) && <span><i>母父</i><b>{motherFatherName(horse)}</b></span>}
          </div>
          <div className="v2-add-form-horse-meta">
            {(horse.東西 || horse.region) && <span className={`v2-fav-region-tag ${g}`}>{horse.東西 || horse.region}</span>}
            {horse.調教師 || horse.trainer || ''}
            {(horse.生産者 || horse.breeder) && <span> · {horse.生産者 || horse.breeder}</span>}
          </div>
        </div>
      </div>

      {/* 評価入力 */}
      <div className="v2-add-form-fields">
        <div className="v2-add-form-field">
          <label>順位</label>
          <div className="v2-fav-rankc-edit">
            <span className="v2-fav-rankc-prefix">#</span>
            <input type="number" min="1" value={rank} onChange={(e) => setRank(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))} />
          </div>
        </div>

        {EVAL_FIELDS.map((ef) => (
          <div key={ef.key} className="v2-add-form-field">
            <label>{ef.long}</label>
            <span className="v2-fav-grade-pickerc">
              {EVAL_GRADES.map((grade) => (
                <button key={grade} type="button"
                  className={`v2-fav-grade-btnc grade-${grade} ${gradeState[ef.key] === grade ? 'active' : ''}`}
                  onClick={() => toggleGrade(ef.key, grade)}
                >{grade}</button>
              ))}
            </span>
          </div>
        ))}

        <div className="v2-add-form-field">
          <label>点数</label>
          <div className="v2-fav-scorec-edit">
            <input type="number" min="0" max="100" placeholder="—" value={score}
              onChange={(e) => { const v = e.target.value; setScore(v === '' ? '' : Math.max(0, Math.min(100, Number(v)))); }} />
            <span>点</span>
          </div>
        </div>

        <div className="v2-add-form-field v2-add-form-field-wide">
          <label>メモ</label>
          <input type="text" className="v2-fav-memo-inline" placeholder="メモ..." value={memo}
            onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>

      <div className="v2-add-form-actions">
        <button className="v2-btn v2-btn-ghost" onClick={onCancel}>キャンセル</button>
        <button className="v2-btn v2-btn-gold" onClick={handleSubmit}>
          <Plus size={14} /> お気に入りに登録
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
function FavRow({ fav, index, editing, lockedByOther, onStartEdit, onCancelEdit, onSave, onRemove, draftInfo }) {
  return (
    <div className={`v2-fav-row ${editing ? 'is-editing' : ''} ${lockedByOther ? 'is-locked' : ''}`}>
      {editing ? (
        <FavRowEdit fav={fav} index={index} onSave={onSave} onCancel={onCancelEdit} onRemove={onRemove} />
      ) : (
        <FavRowView fav={fav} index={index} lockedByOther={lockedByOther} onStartEdit={onStartEdit} onRemove={onRemove} draftInfo={draftInfo} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
function FavRowView({ fav, index, lockedByOther, onStartEdit, onRemove, draftInfo }) {
  const g = genderChar(fav);
  const rank = fav.priority ?? (index + 1);
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

  return (
    <div className="v2-fav-rowc v2-fav-rowc-view">
      <div className={`v2-fav-rankc ${rankClass}`}><span>#</span>{rank}</div>
      <div className="v2-fav-mainc">
        <div className="v2-fav-linec1">
          <span className={`v2-fav-gender-badge ${g}`}>{genderSymbol(g)}</span>
          <span className="v2-fav-namec">{horseName(fav)}</span>
          {fav.region && <span className={`v2-fav-region-tag ${g}`}>{fav.region}</span>}
          {fav.trainer && <span className="v2-fav-trainerc">{fav.trainer}</span>}
          {fav.umaId && (
            <a href={`https://db.netkeiba.com/horse/${fav.umaId}/`} target="_blank" rel="noopener noreferrer"
               className="v2-fav-netkeiba" title="netkeibaで見る" onClick={(e) => e.stopPropagation()}>
              <ExternalLink size={10} />
            </a>
          )}
          {draftInfo && <DraftInfoBadge info={draftInfo} />}
        </div>
        <div className="v2-fav-linec2">
          <span className="v2-fav-pedc">
            <i>父</i><b>{fav.fatherName || '不明'}</b>
            <span className="sep">／</span><i>母</i><b>{fav.motherName || '不明'}</b>
            {fav.motherFatherName && <span className="mf">（母父：{fav.motherFatherName}）</span>}
          </span>
          <span className="v2-fav-metac">
            {fav.breeder && <><i>生産</i>{fav.breeder}</>}
            {fav.owner && <><span className="sep">·</span><i>馬主</i>{fav.owner}</>}
          </span>
        </div>
        {fav.memo && <div className="v2-fav-linec3"><i>メモ</i><span className="v2-fav-memoc-text">{fav.memo}</span></div>}
      </div>
      <div className="v2-fav-gradesc">
        {EVAL_FIELDS.map((ef) => {
          const val = fav[ef.key];
          return val
            ? <span key={ef.key} className={`v2-fav-grade-chipc grade-${val}`} title={ef.long}>{val}</span>
            : <span key={ef.key} className="v2-fav-grade-chipc is-empty" title={ef.long}>—</span>;
        })}
      </div>
      <div className="v2-fav-scorec">
        {fav.score != null ? <><b>{fav.score}</b><span>点</span></> : <span className="dash">—</span>}
      </div>
      <div className="v2-fav-col-actions" onClick={(e) => e.stopPropagation()}>
        <button className="v2-btn-icon v2-btn-icon-edit" onClick={() => onStartEdit()} title="評価を編集" disabled={lockedByOther}><Edit size={14} /></button>
        <button className="v2-btn-icon v2-btn-icon-danger" onClick={() => onRemove()} title="削除" disabled={lockedByOther}><Trash size={14} /></button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
function FavRowEdit({ fav, index, onSave, onCancel }) {
  const [memo, setMemo] = useState(fav.memo || '');
  const [rank, setRank] = useState(fav.priority ?? (index + 1));
  const [pedigreeGrade, setPedigreeGrade] = useState(fav.pedigreeGrade || null);
  const [buildGrade, setBuildGrade] = useState(fav.buildGrade || null);
  const [growthGrade, setGrowthGrade] = useState(fav.growthGrade || null);
  const [score, setScore] = useState(fav.score ?? '');
  const g = genderChar(fav);

  const gradeState = { pedigreeGrade, buildGrade, growthGrade };
  const gradeSetters = { pedigreeGrade: setPedigreeGrade, buildGrade: setBuildGrade, growthGrade: setGrowthGrade };
  const toggleGrade = (key, val) => gradeSetters[key](gradeState[key] === val ? null : val);

  const handleSave = () => {
    onSave(fav.id, {
      memo, priority: rank === '' ? null : Number(rank),
      pedigreeGrade: pedigreeGrade || null, buildGrade: buildGrade || null, growthGrade: growthGrade || null,
      score: score === '' ? null : Number(score),
    });
    onCancel();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="v2-fav-edit-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="v2-fav-edit-row1">
        <div className="v2-fav-rankc-edit">
          <span className="v2-fav-rankc-prefix">#</span>
          <input type="number" min="1" value={rank} onChange={(e) => setRank(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))} autoFocus />
        </div>
        <div className="v2-fav-mainc">
          <div className="v2-fav-linec1">
            <span className={`v2-fav-gender-badge ${g}`}>{genderSymbol(g)}</span>
            <span className="v2-fav-namec">{horseName(fav)}</span>
            {fav.region && <span className={`v2-fav-region-tag ${g}`}>{fav.region}</span>}
            <span className="v2-fav-editing-flag">編集中</span>
          </div>
          <div className="v2-fav-linec2">
            <span className="v2-fav-pedc"><i>父</i><b>{fav.fatherName || '不明'}</b><span className="sep">／</span><i>母</i><b>{fav.motherName || '不明'}</b></span>
          </div>
        </div>
        <div className="v2-fav-col-actions v2-fav-col-actions-edit">
          <button className="v2-btn-icon v2-btn-icon-save" onClick={handleSave} title="保存 (⌘Enter)"><Check size={14} /></button>
          <button className="v2-btn-icon v2-btn-icon-cancel" onClick={onCancel} title="キャンセル (Esc)"><X size={14} /></button>
        </div>
      </div>
      <div className="v2-fav-edit-row2">
        <div className="v2-fav-edit-memo">
          <i>メモ</i>
          <input type="text" className="v2-fav-memo-inline" placeholder="メモ..." value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div className="v2-fav-edit-grades">
          {EVAL_FIELDS.map((ef) => (
            <div key={ef.key} className="v2-fav-edit-grade-group">
              <span className="v2-fav-edit-grade-label">{ef.label}</span>
              <span className="v2-fav-grade-pickerc">
                {EVAL_GRADES.map((grade) => (
                  <button key={grade} type="button"
                    className={`v2-fav-grade-btnc grade-${grade} ${gradeState[ef.key] === grade ? 'active' : ''}`}
                    onClick={() => toggleGrade(ef.key, grade)}>{grade}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="v2-fav-edit-score">
          <span className="v2-fav-edit-grade-label">点数</span>
          <div className="v2-fav-scorec-edit">
            <input type="number" min="0" max="100" placeholder="—" value={score}
              onChange={(e) => { const v = e.target.value; setScore(v === '' ? '' : Math.max(0, Math.min(100, Number(v)))); }} />
            <span>点</span>
          </div>
        </div>
      </div>
    </div>
  );
}
