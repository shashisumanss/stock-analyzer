import { useState, useEffect } from 'react';

function ScoreBar({ score, max = 10 }) {
    const pct = Math.min(100, (score / max) * 100);
    const color = score >= 8 ? '#22c55e' : score >= 6 ? '#00D4FF' : score >= 4 ? '#f59e0b' : '#ef4444';
    return (
        <div className="dr-score-bar">
            <div className="dr-score-fill" style={{ width: `${pct}%`, background: color }} />
            <span className="dr-score-label">{score}/{max}</span>
        </div>
    );
}

function RatingBadge({ rating }) {
    const cls = rating?.toLowerCase().replace(/\s+/g, '-') || 'hold';
    return <span className={`dr-rating-badge dr-rating-${cls}`}>{rating}</span>;
}

function VerdictTag({ verdict }) {
    const cls = verdict === 'Cheap' ? 'cheap' : verdict === 'Expensive' ? 'expensive' : 'fair';
    return <span className={`dr-verdict-tag dr-verdict-${cls}`}>{verdict}</span>;
}

export default function DeepResearch({ ticker }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generated, setGenerated] = useState(false);

    const generateReport = () => {
        setLoading(true);
        setError(null);
        fetch(`/api/deep-research/${ticker}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setData(d);
                setGenerated(true);
                setLoading(false);
            })
            .catch(e => { setError(e.message); setLoading(false); });
    };

    // Reset when ticker changes
    useEffect(() => {
        setData(null);
        setGenerated(false);
        setError(null);
    }, [ticker]);

    if (!generated && !loading) {
        return (
            <div className="dr-prompt">
                <div className="dr-prompt-icon">🔬</div>
                <h3>Deep Research Report</h3>
                <p>Generate a comprehensive institutional-grade equity research report powered by AI. This analysis covers business model, revenue streams, profitability trends, balance sheet health, competitive advantages, management quality, valuation, and investment thesis.</p>
                <button className="dr-generate-btn" onClick={generateReport}>
                    <span className="dr-btn-icon">⚡</span>
                    Generate Deep Research
                </button>
                <span className="dr-prompt-note">Takes 15-30 seconds · Powered by Gemini AI</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dr-loading">
                <div className="spinner large" />
                <h3>Generating Deep Research Report...</h3>
                <p>Analyzing financials, competitive position, and valuation...</p>
                <div className="dr-loading-steps">
                    <span className="dr-step active">📊 Gathering financial data</span>
                    <span className="dr-step">🔍 Analyzing business model</span>
                    <span className="dr-step">📈 Evaluating valuation</span>
                    <span className="dr-step">✍️ Writing research report</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dr-error">
                <span className="dr-error-icon">⚠️</span>
                <p>{error}</p>
                <button className="dr-generate-btn" onClick={generateReport}>Try Again</button>
            </div>
        );
    }

    const r = data?.report;
    if (!r) return null;

    const rb = r.ratingBox || {};

    return (
        <div className="deep-research">
            {/* ── Rating Box ── */}
            <div className="dr-rating-box">
                <div className="dr-rating-left">
                    <span className="dr-report-label">CLYVANTA EQUITY RESEARCH</span>
                    <RatingBadge rating={rb.rating} />
                    <div className="dr-rating-meta">
                        <span>Conviction: <strong>{rb.conviction}</strong></span>
                        <span>Risk: <strong>{rb.riskLevel}</strong></span>
                        <span>Horizon: <strong>{rb.timeHorizon}</strong></span>
                    </div>
                </div>
                <div className="dr-rating-right">
                    <div className="dr-price-target">
                        <span className="dr-pt-label">Price Target</span>
                        <span className="dr-pt-value">${rb.targetPrice}</span>
                        <span className={`dr-pt-upside ${String(rb.upside).startsWith('+') ? 'positive' : 'negative'}`}>{rb.upside} upside</span>
                    </div>
                    <div className="dr-current-price">
                        <span>Current: ${rb.currentPrice}</span>
                    </div>
                </div>
            </div>

            {/* ── Business Model ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">01</span>
                    Business Model
                </h3>
                <div className="dr-section-body">
                    <p className="dr-body-text">{r.businessModel?.overview}</p>
                    {r.businessModel?.keyInsight && (
                        <div className="dr-insight">
                            <span className="dr-insight-label">💡 Key Insight</span>
                            <p>{r.businessModel.keyInsight}</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Revenue Streams ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">02</span>
                    Revenue Streams
                </h3>
                <div className="dr-section-body">
                    <div className="dr-revenue-grid">
                        {(r.revenueStreams || []).map((seg, i) => (
                            <div key={i} className="dr-revenue-card">
                                <div className="dr-rev-header">
                                    <span className="dr-rev-name">{seg.segment}</span>
                                    <span className="dr-rev-pct">{seg.contribution}</span>
                                </div>
                                <div className="dr-rev-growth">Growth: <strong>{seg.growth}</strong></div>
                                <p className="dr-rev-outlook">{seg.outlook}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Profitability Analysis ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">03</span>
                    Profitability Analysis
                </h3>
                <div className="dr-section-body">
                    <div className="dr-profit-grid">
                        {['grossMargin', 'operatingMargin', 'netMargin'].map(key => {
                            const m = r.profitability?.[key];
                            if (!m) return null;
                            const label = key === 'grossMargin' ? 'Gross Margin' : key === 'operatingMargin' ? 'Operating Margin' : 'Net Margin';
                            const trendIcon = m.fiveYearTrend === 'Expanding' ? '📈' : m.fiveYearTrend === 'Contracting' ? '📉' : '➡️';
                            return (
                                <div key={key} className="dr-profit-card">
                                    <span className="dr-profit-label">{label}</span>
                                    <span className="dr-profit-value">{m.current}</span>
                                    <span className={`dr-profit-trend ${m.fiveYearTrend?.toLowerCase()}`}>
                                        {trendIcon} {m.fiveYearTrend}
                                    </span>
                                    <p className="dr-profit-analysis">{m.analysis}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Balance Sheet Health ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">04</span>
                    Balance Sheet Health
                    {r.balanceSheetHealth?.grade && (
                        <span className="dr-grade-badge">Grade: {r.balanceSheetHealth.grade}</span>
                    )}
                </h3>
                <div className="dr-section-body">
                    <div className="dr-bs-grid">
                        <div className="dr-bs-metric"><span>Debt/Equity</span><strong>{r.balanceSheetHealth?.debtToEquity}</strong></div>
                        <div className="dr-bs-metric"><span>Current Ratio</span><strong>{r.balanceSheetHealth?.currentRatio}</strong></div>
                        <div className="dr-bs-metric"><span>Cash Position</span><strong>{r.balanceSheetHealth?.cashPosition}</strong></div>
                        <div className="dr-bs-metric"><span>Total Debt</span><strong>{r.balanceSheetHealth?.totalDebt}</strong></div>
                        <div className="dr-bs-metric dr-bs-wide"><span>Net Position</span><strong>{r.balanceSheetHealth?.netDebtPosition}</strong></div>
                    </div>
                    <p className="dr-body-text">{r.balanceSheetHealth?.assessment}</p>
                </div>
            </section>

            {/* ── Free Cash Flow ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">05</span>
                    Free Cash Flow Analysis
                </h3>
                <div className="dr-section-body">
                    <div className="dr-fcf-grid">
                        <div className="dr-bs-metric"><span>FCF</span><strong>{r.freeCashFlow?.fcf}</strong></div>
                        <div className="dr-bs-metric"><span>FCF Yield</span><strong>{r.freeCashFlow?.fcfYield}</strong></div>
                        <div className="dr-bs-metric"><span>FCF Growth</span><strong>{r.freeCashFlow?.fcfGrowth}</strong></div>
                    </div>
                    <p className="dr-body-text">{r.freeCashFlow?.capitalAllocation}</p>
                </div>
            </section>

            {/* ── Competitive Advantages ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">06</span>
                    Competitive Advantages
                    <span className="dr-moat-badge">Moat: {r.competitiveAdvantages?.moatRating}/10</span>
                </h3>
                <div className="dr-section-body">
                    <div className="dr-moat-grid">
                        {(r.competitiveAdvantages?.factors || []).map((f, i) => (
                            <div key={i} className="dr-moat-card">
                                <div className="dr-moat-header">
                                    <span className="dr-moat-name">{f.name}</span>
                                    <ScoreBar score={f.score} />
                                </div>
                                <p className="dr-moat-explain">{f.explanation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Management Quality ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">07</span>
                    Management Quality
                    <span className="dr-moat-badge">Score: {r.managementQuality?.capitalAllocationScore}/10</span>
                </h3>
                <div className="dr-section-body">
                    <p className="dr-body-text">{r.managementQuality?.assessment}</p>
                    <div className="dr-mgmt-lists">
                        {(r.managementQuality?.keyStrengths || []).length > 0 && (
                            <div className="dr-mgmt-list positive">
                                <h4>✅ Strengths</h4>
                                <ul>{r.managementQuality.keyStrengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                            </div>
                        )}
                        {(r.managementQuality?.concerns || []).length > 0 && (
                            <div className="dr-mgmt-list negative">
                                <h4>⚠️ Concerns</h4>
                                <ul>{r.managementQuality.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Valuation Snapshot ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">08</span>
                    Valuation Snapshot
                </h3>
                <div className="dr-section-body">
                    <div className="dr-val-table">
                        <div className="dr-val-header-row">
                            <span>Metric</span>
                            <span>Current</span>
                            <span>5Y Avg</span>
                            <span>Sector</span>
                            <span>Verdict</span>
                        </div>
                        {(r.valuation?.metrics || []).map((m, i) => (
                            <div key={i} className="dr-val-row">
                                <span className="dr-val-name">{m.name}</span>
                                <span className="dr-val-current">{m.current}</span>
                                <span>{m.fiveYearAvg}</span>
                                <span>{m.sectorAvg}</span>
                                <VerdictTag verdict={m.verdict} />
                            </div>
                        ))}
                    </div>
                    <p className="dr-body-text" style={{ marginTop: 16 }}>{r.valuation?.overallAssessment}</p>
                </div>
            </section>

            {/* ── Bull / Bear Case ── */}
            <section className="dr-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">09</span>
                    Bull & Bear Case
                </h3>
                <div className="dr-section-body">
                    <div className="dr-cases-grid">
                        <div className="dr-case dr-case-bull">
                            <div className="dr-case-header">
                                <span className="dr-case-icon">🐂</span>
                                <span className="dr-case-label">Bull Case</span>
                                <span className="dr-case-target">${r.bullCase?.targetPrice}</span>
                            </div>
                            <p className="dr-case-thesis">{r.bullCase?.thesis}</p>
                            <ul className="dr-case-list">
                                {(r.bullCase?.catalysts || []).map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                        <div className="dr-case dr-case-bear">
                            <div className="dr-case-header">
                                <span className="dr-case-icon">🐻</span>
                                <span className="dr-case-label">Bear Case</span>
                                <span className="dr-case-target">${r.bearCase?.targetPrice}</span>
                            </div>
                            <p className="dr-case-thesis">{r.bearCase?.thesis}</p>
                            <ul className="dr-case-list">
                                {(r.bearCase?.risks || []).map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Verdict ── */}
            <section className="dr-section dr-verdict-section">
                <h3 className="dr-section-title">
                    <span className="dr-section-num">10</span>
                    Investment Verdict
                </h3>
                <div className="dr-verdict-box">
                    <p>{r.verdict}</p>
                </div>
            </section>

            <div className="dr-footer">
                <p>Report generated by Clyvanta StockLens AI · {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''}</p>
                <p className="dr-disclaimer">This report is generated by AI and is for informational purposes only. It does not constitute investment advice. Always conduct your own due diligence before making investment decisions.</p>
            </div>
        </div>
    );
}
