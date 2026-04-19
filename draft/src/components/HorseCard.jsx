// 馬カードコンポーネント
import './HorseCard.css';

export default function HorseCard({
  horse,
  onFavorite,
  isFavorite = false,
  onSelect,
  selected = false,
  compact = false,
  showActions = true,
}) {
  const genderClass = horse.性別 === '牝' ? 'gender-female' : 'gender-male';
  const genderIcon = horse.性別 === '牝' ? '♀' : horse.性別 === '牡' ? '♂' : '';

  // netkeibaリンク生成
  const netkeibaUrl = horse.登録番号
    ? `https://db.netkeiba.com/horse/${horse.登録番号}/`
    : horse.リンク || null;

  return (
    <div
      className={`horse-card ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect?.(horse)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="horse-card-header">
        <div className="horse-name-area">
          <span className={`horse-gender ${genderClass}`}>{genderIcon}</span>
          <span className="horse-name">{horse.馬名 || horse.母名生年 || '名前未定'}</span>
          {netkeibaUrl && (
            <a
              href={netkeibaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="horse-link-btn"
              onClick={(e) => e.stopPropagation()}
              aria-label="netkeibaで見る"
            >
              🔗
            </a>
          )}
        </div>
        {showActions && (
          <button
            className={`favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onFavorite?.(horse); }}
            aria-label={isFavorite ? 'お気に入り解除' : 'お気に入り登録'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
      </div>

      <div className="horse-card-body">
        <div className="horse-pedigree">
          <span className="pedigree-item">
            <span className="pedigree-label">父</span>
            <span className="pedigree-value">{horse.父 || '不明'}</span>
          </span>
          <span className="pedigree-item">
            <span className="pedigree-label">母</span>
            <span className="pedigree-value">{horse.母 || '不明'}</span>
          </span>
          {!compact && (
            <span className="pedigree-item">
              <span className="pedigree-label">母父</span>
              <span className="pedigree-value">{horse.母父 || '不明'}</span>
            </span>
          )}
        </div>
        {/* 厩舎・生産者・馬主（ローカルDBデータ） */}
        <div className="horse-meta-row">
          {horse.調教師 && (
            <span className="horse-meta-item">
              {horse.東西 === '栗東' ? '🟤' : horse.東西 === '美浦' ? '🔵' : '🏠'}
              {horse.調教師}
              {horse.東西 && <span className="horse-region-tag">{horse.東西}</span>}
            </span>
          )}
          {horse.生産者 && <span className="horse-meta-item">🌾 {horse.生産者}</span>}
          {horse.馬主 && <span className="horse-meta-item">👤 {horse.馬主}</span>}
        </div>
      </div>
    </div>
  );
}
