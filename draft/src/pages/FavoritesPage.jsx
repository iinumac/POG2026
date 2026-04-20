// お気に入り馬管理画面 — v2 Dense Layout + Inline Edit
import { useState, useMemo } from 'react';
import Header from '../components/Header';
import { useHorseSearch } from '../hooks/useHorseSearch';
import { useFavorites } from '../hooks/useFavorites';
import { Star, Search, X, Plus, Edit, Trash, Check, Info, ExternalLink } from '../components/Icons';
import './FavoritesPage.css';

const EVAL_GRADES = ['A', 'B', 'C'];
const EVAL_FIELDS = [
  { key: 'pedigree', label: '血', long: '血統' },
  { key: 'build', label: '体', long: '体格' },
  { key: 'growth', label: '成', long: '成長' },
];

function horseName(h) {
  return h?.horseName || h?.馬名 || h?.name || '（不明）';
}

function genderChar(h) {
  const g = h?.gender || h?.性別;
  if (g === '牝' || g === 'f') return 'f';
  return 'm';
}

function genderSymbol(g) {
  return g === 'f' ? '♀' : '♂';
}

export default function FavoritesPage() {
  const { results, loading: searchLoading, search, cacheReady, cacheCount, cacheLoading } = useHorseSearch();
  const { favorites, loading: favLoading, toggleFavorite, isFavorite, updateMemo, removeFavorite } = useFavorites();

  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rank');
  const [editingId, setEditingId] = useState(null);

  // 検索実行
  const handleSearch = (q) => {
    setQuery(q);
    if (q.trim()) search(q);
  };

  // ソート・フィルター適用
  const filteredFavs = useMemo(() => {
    let items = [...favorites];

    if (genderFilter !== 'all') {
      items = items.filter((f) => {
        const g = genderChar(f);
        return g === genderFilter;
      });
    }

    if (regionFilter !== 'all') {
      items = items.filter((f) => f.region === regionFilter);
    }

    const collator = new Intl.Collator('ja');
    items.sort((a, b) => {
      switch (sortBy) {
        case 'rank': return 0; // 既存の順序を維持
        case 'name': return collator.compare(horseName(a), horseName(b));
        default: return 0;
      }
    });

    return items;
  }, [favorites, genderFilter, regionFilter, sortBy]);

  // 検索結果からお気に入りを除外
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return results.filter((h) => !isFavorite(h.登録番号 || h.id));
  }, [results, query, isFavorite]);

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
            </div>
          </div>

          {/* ツールバー */}
          <div className="v2-fav-toolbar">
            <div className="v2-fav-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="馬名・父・母で検索してお気に入りに追加..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                disabled={cacheLoading}
              />
              {query && (
                <button className="v2-btn-icon" onClick={() => { setQuery(''); }}>
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="v2-fav-filters">
              <button className={`v2-fav-filter ${genderFilter === 'all' ? 'active' : ''}`} onClick={() => setGenderFilter('all')}>全性</button>
              <button className={`v2-fav-filter ${genderFilter === 'm' ? 'active' : ''}`} onClick={() => setGenderFilter('m')}>♂</button>
              <button className={`v2-fav-filter ${genderFilter === 'f' ? 'active' : ''}`} onClick={() => setGenderFilter('f')}>♀</button>
              <div className="v2-fav-filter-sep" />
              <button className={`v2-fav-filter ${regionFilter === 'all' ? 'active' : ''}`} onClick={() => setRegionFilter('all')}>全厩舎</button>
              <button className={`v2-fav-filter ${regionFilter === '栗東' ? 'active' : ''}`} onClick={() => setRegionFilter('栗東')}>栗東</button>
              <button className={`v2-fav-filter ${regionFilter === '美浦' ? 'active' : ''}`} onClick={() => setRegionFilter('美浦')}>美浦</button>
              <div className="v2-fav-filter-sep" />
              <span className="v2-fav-sort-label">並び:</span>
              <button className={`v2-fav-filter ${sortBy === 'rank' ? 'active' : ''}`} onClick={() => setSortBy('rank')}>順位</button>
              <button className={`v2-fav-filter ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>馬名</button>
            </div>
          </div>

          {/* キャッシュ読み込み中 */}
          {cacheLoading && (
            <div className="v2-fav-cache-banner">
              馬データを読み込み中... ({cacheCount}件キャッシュ済み)
            </div>
          )}

          {/* 検索結果 */}
          {query.trim() && (
            <div className="v2-fav-results">
              <div className="v2-fav-results-head">
                <span><Search size={11} style={{ marginRight: 4 }} />検索結果 {searchResults.length}件</span>
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  クリックでお気に入り追加
                </span>
              </div>
              <div className="v2-fav-results-list">
                {searchLoading ? (
                  <div className="v2-empty">検索中...</div>
                ) : searchResults.length === 0 ? (
                  <div className="v2-empty"><Search />「{query}」に一致する馬がありません</div>
                ) : (
                  searchResults.map((h) => (
                    <div key={h.id || h.登録番号} className="v2-fav-result-row" onClick={() => toggleFavorite(h)}>
                      <div className="v2-fav-name-cell">
                        <span className={`v2-fav-gender-badge ${genderChar(h)}`}>{genderSymbol(genderChar(h))}</span>
                        <span className="v2-fav-name">{horseName(h)}</span>
                      </div>
                      <div className="v2-fav-pedigree">
                        <b>{h.fatherName || h.父名 || ''}</b>
                        <span className="p-sep">×</span>
                        {h.motherName || h.母名 || ''}
                      </div>
                      <div className="v2-fav-trainer">
                        {h.region && <span className={`v2-fav-region-tag ${genderChar(h)}`}>{h.region}</span>}
                        {h.trainer || h.調教師名 || ''}
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
            {/* カラムヘッダー */}
            {filteredFavs.length > 0 && (
              <div className="v2-fav-rowc v2-fav-rowc-head">
                <div className="v2-fav-colh rank">順位</div>
                <div className="v2-fav-colh main">馬名・血統・メモ</div>
                <div className="v2-fav-colh actions"></div>
              </div>
            )}

            {favLoading ? (
              <div className="v2-empty">読み込み中...</div>
            ) : filteredFavs.length === 0 ? (
              <div className="v2-empty">
                <Star />
                お気に入り馬はまだ登録されていません
                <br />
                <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>上の検索から馬を探して追加してください</span>
              </div>
            ) : (
              filteredFavs.map((fav, index) => (
                <FavRow
                  key={fav.id}
                  fav={fav}
                  index={index}
                  editing={editingId === fav.id}
                  lockedByOther={editingId != null && editingId !== fav.id}
                  onStartEdit={() => setEditingId(fav.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveMemo={updateMemo}
                  onRemove={() => removeFavorite(fav.id)}
                />
              ))
            )}
          </div>

          <div className="v2-fav-hint">
            <Info size={12} />
            各行の <b>鉛筆</b> で評価を編集、<b>ゴミ箱</b> でお気に入りから削除。
          </div>
        </div>
      </main>
    </>
  );
}

// ────────────────────────────────────────────────
// Row component
// ────────────────────────────────────────────────
function FavRow({ fav, index, editing, lockedByOther, onStartEdit, onCancelEdit, onSaveMemo, onRemove }) {
  return (
    <div className={`v2-fav-row ${editing ? 'is-editing' : ''} ${lockedByOther ? 'is-locked' : ''}`}>
      {editing ? (
        <FavRowEdit fav={fav} index={index} onSave={onSaveMemo} onCancel={onCancelEdit} onRemove={onRemove} />
      ) : (
        <FavRowView fav={fav} index={index} lockedByOther={lockedByOther} onStartEdit={onStartEdit} onRemove={onRemove} />
      )}
    </div>
  );
}

function FavRowView({ fav, index, lockedByOther, onStartEdit, onRemove }) {
  const g = genderChar(fav);
  const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

  return (
    <div className="v2-fav-rowc v2-fav-rowc-view">
      {/* Rank */}
      <div className={`v2-fav-rankc ${rankClass}`}>
        <span>#</span>{index + 1}
      </div>

      {/* Main */}
      <div className="v2-fav-mainc">
        <div className="v2-fav-linec1">
          <span className={`v2-fav-gender-badge ${g}`}>{genderSymbol(g)}</span>
          <span className="v2-fav-namec">{horseName(fav)}</span>
          {fav.region && <span className={`v2-fav-region-tag ${g}`}>{fav.region}</span>}
          {fav.trainer && <span className="v2-fav-trainerc">{fav.trainer}</span>}
          {fav.登録番号 && (
            <a
              href={`https://db.netkeiba.com/horse/${fav.登録番号}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="v2-fav-netkeiba"
              title="netkeibaで見る"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
        <div className="v2-fav-linec2">
          <span className="v2-fav-pedc">
            <i>父</i><b>{fav.fatherName || '不明'}</b>
            <span className="sep">／</span>
            <i>母</i><b>{fav.motherName || '不明'}</b>
            {fav.motherFatherName && <span className="mf">（母父：{fav.motherFatherName}）</span>}
          </span>
          <span className="v2-fav-metac">
            {fav.breeder && <><i>生産</i>{fav.breeder}</>}
            {fav.owner && <><span className="sep">·</span><i>馬主</i>{fav.owner}</>}
          </span>
        </div>
        {fav.memo && (
          <div className="v2-fav-linec3">
            <i>メモ</i>
            <span className="v2-fav-memoc-text">{fav.memo}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="v2-fav-col-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="v2-btn-icon v2-btn-icon-edit"
          onClick={() => onStartEdit()}
          title="評価を編集"
          disabled={lockedByOther}
        >
          <Edit size={14} />
        </button>
        <button
          className="v2-btn-icon v2-btn-icon-danger"
          onClick={() => onRemove()}
          title="お気に入りから削除"
          disabled={lockedByOther}
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}

function FavRowEdit({ fav, index, onSave, onCancel, onRemove }) {
  const [memo, setMemo] = useState(fav.memo || '');
  const g = genderChar(fav);

  const handleSave = () => {
    onSave(fav.id, memo);
    onCancel();
  };

  return (
    <div className="v2-fav-rowc v2-fav-rowc-edit" onClick={(e) => e.stopPropagation()}>
      {/* Rank */}
      <div className="v2-fav-rankc">
        <span>#</span>{index + 1}
      </div>

      {/* Main with editable memo */}
      <div className="v2-fav-mainc">
        <div className="v2-fav-linec1">
          <span className={`v2-fav-gender-badge ${g}`}>{genderSymbol(g)}</span>
          <span className="v2-fav-namec">{horseName(fav)}</span>
          {fav.region && <span className={`v2-fav-region-tag ${g}`}>{fav.region}</span>}
          <span className="v2-fav-editing-flag">編集中</span>
        </div>
        <div className="v2-fav-linec2">
          <span className="v2-fav-pedc">
            <i>父</i><b>{fav.fatherName || '不明'}</b>
            <span className="sep">／</span>
            <i>母</i><b>{fav.motherName || '不明'}</b>
          </span>
        </div>
        <div className="v2-fav-linec3">
          <i>メモ</i>
          <input
            type="text"
            className="v2-fav-memo-inline"
            placeholder="メモ..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="v2-fav-col-actions v2-fav-col-actions-edit">
        <button className="v2-btn-icon v2-btn-icon-save" onClick={handleSave} title="保存 (⌘Enter)">
          <Check size={14} />
        </button>
        <button className="v2-btn-icon v2-btn-icon-cancel" onClick={onCancel} title="キャンセル (Esc)">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
