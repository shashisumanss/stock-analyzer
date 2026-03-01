import { useState, useEffect, useRef } from 'react';

const POPULAR_TICKERS = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'JPM', name: 'JPMorgan' },
];

export default function SearchBar({ onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (query.length < 1) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/search/${encodeURIComponent(query)}`);
                const data = await res.json();
                setResults(data);
                setShowDropdown(data.length > 0);
                setHighlightIndex(-1);
            } catch {
                setResults([]);
            }
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSelect = (symbol) => {
        setQuery('');
        setShowDropdown(false);
        onSelect(symbol);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (highlightIndex >= 0 && results[highlightIndex]) {
            handleSelect(results[highlightIndex].symbol);
        } else if (query.trim()) {
            handleSelect(query.trim().toUpperCase());
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(i => Math.max(i - 1, -1));
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    return (
        <div className="search-container">
            <form onSubmit={handleSubmit} className="search-form" ref={dropdownRef}>
                <div className="search-input-wrapper">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search ticker symbol (e.g. AAPL, MSFT, TSLA)..."
                        className="search-input"
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {isSearching && <div className="search-spinner" />}
                    {query && !isSearching && (
                        <button
                            type="button"
                            className="search-clear"
                            onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); inputRef.current?.focus(); }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {showDropdown && (
                    <div className="search-dropdown">
                        {results.map((result, i) => (
                            <button
                                key={result.symbol}
                                type="button"
                                className={`search-result ${i === highlightIndex ? 'highlighted' : ''}`}
                                onClick={() => handleSelect(result.symbol)}
                                onMouseEnter={() => setHighlightIndex(i)}
                            >
                                <span className="result-symbol">{result.symbol}</span>
                                <span className="result-name">{result.name}</span>
                                <span className="result-exchange">{result.exchange}</span>
                            </button>
                        ))}
                    </div>
                )}
            </form>

            <div className="popular-tickers">
                <span className="popular-label">Popular:</span>
                <div className="ticker-chips">
                    {POPULAR_TICKERS.map((t) => (
                        <button
                            key={t.symbol}
                            className="ticker-chip"
                            onClick={() => handleSelect(t.symbol)}
                        >
                            <span className="chip-symbol">{t.symbol}</span>
                            <span className="chip-name">{t.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
