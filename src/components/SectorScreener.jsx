import { useState, useEffect } from 'react';

// Safe number check — returns true only for actual finite numbers
const n = (v) => typeof v === 'number' && Number.isFinite(v);

const SECTOR_ICONS = {
    'Indexes': '📈',
    'AI': '🧠',
    'Penny Stocks': '🪙',
    'Technology': '💻',
    'Financial Services': '🏦',
    'Healthcare': '🏥',
    'Consumer Cyclical': '🛍️',
    'Communication Services': '📡',
    'Consumer Defensive': '🛒',
    'Energy': '⚡',
    'Industrials': '🏭',
    'Basic Materials': '⛏️',
    'Real Estate': '🏢',
    'Utilities': '💡',
};

function formatMcap(num) {
    if (!num) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(0)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return `$${num.toLocaleString()}`;
}

function RangeBar({ position }) {
    const pos = Math.max(0, Math.min(100, position || 0));
    return (
        <div className="range-bar-52w">
            <div className="range-bar-track">
                <div className="range-bar-fill" style={{ width: `${pos}%` }} />
                <div className="range-bar-dot" style={{ left: `${pos}%` }} />
            </div>
            <div className="range-bar-labels">
                <span>52W Low</span>
                <span>52W High</span>
            </div>
        </div>
    );
}

function StockRow({ stock, onClick }) {
    const isPos = (stock.change || 0) >= 0;
    return (
        <div className="screener-stock-row" onClick={() => onClick(stock.symbol)}>
            <div className="stock-row-main">
                <div className="stock-row-info">
                    <span className="stock-row-symbol">{stock.symbol}</span>
                    <span className="stock-row-name">{stock.name}</span>
                </div>
                <div className="stock-row-price-group">
                    <span className="stock-row-price">${stock.price?.toFixed(2)}</span>
                    <span className={`stock-row-change ${isPos ? 'positive' : 'negative'}`}>
                        {isPos ? '+' : ''}{stock.change?.toFixed(2)}%
                    </span>
                </div>
            </div>
            <div className="stock-row-52w">
                <RangeBar position={stock.rangePosition} />
                <div className="stock-row-52w-prices">
                    <span>${stock.fiftyTwoWeekLow?.toFixed(2)}</span>
                    <span className="stock-row-mcap">{formatMcap(stock.marketCap)}</span>
                    <span>${stock.fiftyTwoWeekHigh?.toFixed(2)}</span>
                </div>
            </div>
            <div className="stock-row-metrics">
                {n(stock.pctFromHigh) && (
                    <span className={`metric-pill ${stock.pctFromHigh > -5 ? 'near-high' : stock.pctFromHigh < -30 ? 'near-low' : ''}`}>
                        {stock.pctFromHigh > 0 ? '+' : ''}{stock.pctFromHigh}% from 52W High
                    </span>
                )}
                {n(stock.revenueGrowth) && (
                    <span className={`metric-pill ${stock.revenueGrowth > 0 ? 'positive' : 'negative'}`}>
                        Rev: {(stock.revenueGrowth * 100).toFixed(1)}%
                    </span>
                )}
                {n(stock.trailingPE) && (
                    <span className="metric-pill">P/E: {stock.trailingPE.toFixed(1)}</span>
                )}
            </div>
        </div>
    );
}

function TopPickCard({ stock, onClick }) {
    const isPos = (stock.change || 0) >= 0;
    const upside = stock.targetMeanPrice && stock.price
        ? ((stock.targetMeanPrice - stock.price) / stock.price * 100).toFixed(1) : null;

    return (
        <div className="top-pick-card" onClick={() => onClick(stock.symbol)}>
            <div className="top-pick-header">
                <div>
                    <span className="top-pick-symbol">{stock.symbol}</span>
                    {stock.recommendationKey && (
                        <span className={`rec-badge rec-${stock.recommendationKey.replace('_', '-')}`}>
                            {stock.recommendationKey.replace('_', ' ')}
                        </span>
                    )}
                </div>
                <span className="top-pick-price">${stock.price?.toFixed(2)}</span>
            </div>
            <p className="top-pick-name">{stock.name}</p>
            {stock.topPickReason && (
                <div className="tp-reason">
                    <span className="tp-reason-icon">⭐</span>
                    <span className="tp-reason-text">{stock.topPickReason}</span>
                </div>
            )}
            <div className="top-pick-metrics">
                {n(stock.revenueGrowth) && (
                    <div className="tp-metric">
                        <span className="tp-label">Revenue Growth</span>
                        <span className={`tp-value ${stock.revenueGrowth > 0 ? 'positive' : 'negative'}`}>
                            {(stock.revenueGrowth * 100).toFixed(1)}%
                        </span>
                    </div>
                )}
                {n(stock.profitMargins) && (
                    <div className="tp-metric">
                        <span className="tp-label">Profit Margin</span>
                        <span className="tp-value">{(stock.profitMargins * 100).toFixed(1)}%</span>
                    </div>
                )}
                {n(stock.returnOnEquity) && (
                    <div className="tp-metric">
                        <span className="tp-label">ROE</span>
                        <span className="tp-value">{(stock.returnOnEquity * 100).toFixed(1)}%</span>
                    </div>
                )}
                {upside && (
                    <div className="tp-metric">
                        <span className="tp-label">Analyst Upside</span>
                        <span className={`tp-value ${parseFloat(upside) > 0 ? 'positive' : 'negative'}`}>
                            {parseFloat(upside) > 0 ? '+' : ''}{upside}%
                        </span>
                    </div>
                )}
            </div>
            <RangeBar position={stock.rangePosition} />
        </div>
    );
}

export default function SectorScreener({ onSelectTicker }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('near52High');
    const [activeSector, setActiveSector] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/screener')
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setData(d);
                const sectors = Object.keys(d.sectors || {});
                if (sectors.length > 0) setActiveSector(sectors[0]);
                setLoading(false);
            })
            .catch(e => { setError(e.message); setLoading(false); });
    }, []);

    if (loading) {
        return (
            <div className="screener-loading">
                <div className="spinner large" />
                <p>Loading market data across <strong>11 sectors</strong>...</p>
                <span className="loading-sub">Fetching 100+ stocks — this may take 30-60 seconds</span>
            </div>
        );
    }

    if (error || !data?.sectors) {
        return (
            <div className="screener-error">
                <p>Unable to load screener data{error ? `: ${error}` : ''}</p>
            </div>
        );
    }

    const sectors = Object.keys(data.sectors);
    const sectorData = activeSector ? data.sectors[activeSector] : null;

    const TABS = [
        { key: 'near52High', label: '📈 Near 52W High', desc: 'Stocks trading closest to their 52-week highs' },
        { key: 'near52Low', label: '📉 Near 52W Low', desc: 'Stocks trading closest to their 52-week lows' },
        { key: 'topPicks', label: '⭐ Top Picks', desc: 'Best stocks by growth, profitability & analyst rating' },
    ];

    const activeTabData = TABS.find(t => t.key === activeTab);

    return (
        <div className="sector-screener">
            <div className="screener-header">
                <h2>Market Screener</h2>
                <p>Discover stocks across sectors — 52W highs, lows, and top investment picks</p>
            </div>

            {/* View tabs */}
            <div className="screener-view-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`screener-view-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTabData && (
                <p className="screener-tab-desc">{activeTabData.desc}</p>
            )}

            {/* Sector pills */}
            <div className="sector-pills">
                {sectors.map(s => (
                    <button
                        key={s}
                        className={`sector-pill ${activeSector === s ? 'active' : ''}`}
                        onClick={() => setActiveSector(s)}
                    >
                        <span className="sector-pill-icon">{SECTOR_ICONS[s] || '📊'}</span>
                        {s}
                        <span className="sector-pill-count">{data.sectors[s].stockCount}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {sectorData && (
                <div className="screener-content">
                    <div className="screener-sector-header">
                        <h3>{SECTOR_ICONS[activeSector] || '📊'} {activeSector}</h3>
                        <span className="sector-stock-count">{sectorData.stockCount} stocks tracked</span>
                    </div>

                    {activeTab === 'near52High' && (
                        <div className="screener-list">
                            {sectorData.nearHigh.map(stock => (
                                <StockRow key={stock.symbol} stock={stock} onClick={onSelectTicker} />
                            ))}
                        </div>
                    )}

                    {activeTab === 'near52Low' && (
                        <div className="screener-list">
                            {sectorData.nearLow.map(stock => (
                                <StockRow key={stock.symbol} stock={stock} onClick={onSelectTicker} />
                            ))}
                        </div>
                    )}

                    {activeTab === 'topPicks' && (
                        <div className="top-picks-grid">
                            {sectorData.topPicks.map(stock => (
                                <TopPickCard key={stock.symbol} stock={stock} onClick={onSelectTicker} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
