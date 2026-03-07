import { useState, useEffect } from 'react';

const RATING_COLORS = {
    'strongBuy': '#22c55e',
    'buy': '#4ade80',
    'hold': '#eab308',
    'sell': '#f97316',
    'strongSell': '#ef4444',
};

const RATING_LABELS = {
    'strongBuy': 'Strong Buy',
    'buy': 'Buy',
    'hold': 'Hold',
    'sell': 'Sell',
    'strongSell': 'Strong Sell',
};

export default function AnalystRatings({ ticker }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analyst/${ticker}`)
            .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); })
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [ticker]);

    if (loading) return <div className="analyst-loading"><div className="spinner" /></div>;
    if (!data) return null;

    const recKey = data.recommendationKey?.toLowerCase();
    const totalAnalysts = data.numberOfAnalystOpinions || 0;

    // Get recommendation breakdown from latest period
    const recBreakdown = data.recommendations?.[0] || {};
    const counts = {
        strongBuy: recBreakdown.strongBuy || recBreakdown['Strong Buy'] || 0,
        buy: recBreakdown.buy || recBreakdown['Buy'] || 0,
        hold: recBreakdown.hold || recBreakdown['Hold'] || 0,
        sell: recBreakdown.sell || recBreakdown['Sell'] || 0,
        strongSell: recBreakdown.strongSell || recBreakdown['Strong Sell'] || 0,
    };
    const totalCounts = Object.values(counts).reduce((a, b) => a + b, 0);

    // Calculate consensus percentage
    const buyPct = totalCounts > 0 ? ((counts.strongBuy + counts.buy) / totalCounts * 100).toFixed(0) : 0;

    // Target price
    const targetLow = data.targetLowPrice;
    const targetMean = data.targetMeanPrice;
    const targetMedian = data.targetMedianPrice;
    const targetHigh = data.targetHighPrice;

    return (
        <div className="analyst-container">
            <h3>Analyst Ratings</h3>

            <div className="analyst-grid">
                {/* Consensus gauge */}
                <div className="analyst-consensus">
                    <div className="consensus-gauge">
                        <svg viewBox="0 0 120 70" className="gauge-svg">
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#ef4444" />
                                    <stop offset="25%" stopColor="#f97316" />
                                    <stop offset="50%" stopColor="#eab308" />
                                    <stop offset="75%" stopColor="#4ade80" />
                                    <stop offset="100%" stopColor="#22c55e" />
                                </linearGradient>
                            </defs>
                            <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" strokeLinecap="round" />
                            <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="url(#gaugeGradient)" strokeWidth="8" fill="none" strokeLinecap="round"
                                strokeDasharray={`${Math.PI * 50}`}
                                strokeDashoffset={`${Math.PI * 50 * (1 - (buyPct / 100))}`}
                            />
                            <text x="60" y="52" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{buyPct}%</text>
                            <text x="60" y="66" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8">BUY</text>
                        </svg>
                    </div>
                    <div className="consensus-label">
                        <span className="consensus-text" style={{ color: RATING_COLORS[recKey] || '#eab308' }}>
                            {RATING_LABELS[recKey] || recKey || 'N/A'}
                        </span>
                        <span className="consensus-count">{totalAnalysts} analyst{totalAnalysts !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Rating breakdown bar */}
                <div className="rating-breakdown">
                    <h4>Breakdown</h4>
                    {totalCounts > 0 && (
                        <div className="breakdown-stacked-bar">
                            {Object.entries(counts).map(([key, count]) => (
                                count > 0 && (
                                    <div
                                        key={key}
                                        className="bar-segment"
                                        style={{
                                            width: `${(count / totalCounts) * 100}%`,
                                            backgroundColor: RATING_COLORS[key],
                                        }}
                                        title={`${RATING_LABELS[key]}: ${count}`}
                                    />
                                )
                            ))}
                        </div>
                    )}
                    <div className="breakdown-legend">
                        {Object.entries(counts).map(([key, count]) => (
                            count > 0 && (
                                <div key={key} className="legend-item">
                                    <span className="legend-dot" style={{ backgroundColor: RATING_COLORS[key] }} />
                                    <span className="legend-label">{RATING_LABELS[key]}</span>
                                    <span className="legend-count">{count}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </div>

            {/* Target price range */}
            {targetLow != null && targetHigh != null && (
                <div className="target-price-section">
                    <h4>Price Target</h4>
                    <div className="target-bar-container">
                        <div className="target-labels">
                            <span className="target-low">${targetLow?.toFixed(0)}</span>
                            <span className="target-mean">${(targetMedian || targetMean)?.toFixed(0)}</span>
                            <span className="target-high">${targetHigh?.toFixed(0)}</span>
                        </div>
                        <div className="target-bar">
                            <div className="target-range" style={{
                                left: '0%',
                                width: '100%',
                            }} />
                            {targetMean && (
                                <div className="target-marker mean" style={{
                                    left: `${((targetMean - targetLow) / (targetHigh - targetLow)) * 100}%`,
                                }} />
                            )}
                        </div>
                        <div className="target-label-row">
                            <span>Low</span>
                            <span>Median</span>
                            <span>High</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
