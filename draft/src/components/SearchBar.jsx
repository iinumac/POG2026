// 検索バーコンポーネント
import { useState } from 'react';
import './SearchBar.css';

export default function SearchBar({ onSearch, placeholder = '馬名を入力...', cacheReady, cacheCount }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('name'); // 'name' or 'mother'

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value, searchType);
  };

  const handleTypeToggle = (type) => {
    setSearchType(type);
    if (query) {
      onSearch(query, type);
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('', searchType);
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={handleChange}
          placeholder={searchType === 'name' ? '馬名で検索...' : '母名で検索...'}
          disabled={!cacheReady}
          id="horse-search-input"
        />
        {query && (
          <button className="search-clear" onClick={handleClear} aria-label="クリア">
            ✕
          </button>
        )}
      </div>

      <div className="search-controls">
        <div className="search-type-toggle">
          <button
            className={`toggle-btn ${searchType === 'name' ? 'active' : ''}`}
            onClick={() => handleTypeToggle('name')}
          >
            馬名
          </button>
          <button
            className={`toggle-btn ${searchType === 'mother' ? 'active' : ''}`}
            onClick={() => handleTypeToggle('mother')}
          >
            母名
          </button>
        </div>

        {cacheReady && (
          <span className="search-cache-info">
            📦 {cacheCount.toLocaleString()}頭
          </span>
        )}
        {!cacheReady && (
          <span className="search-cache-loading">
            データ読込中...
          </span>
        )}
      </div>
    </div>
  );
}
