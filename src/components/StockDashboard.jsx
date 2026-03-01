import { useState, useEffect } from 'react';
import MetricCard from './MetricCard';
import FairValueGauge from './FairValueGauge';

const fmt = (val, prefix = '', suffix = '') => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return `${prefix}${val}${suffix}`;
};

const fmtNum = (val, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return Number(val).toFixed(decimals);
};

const fmtCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return `$${Number(val).toFixed(2)}`;
};

const fmtLargeNumber = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

const fmtVolume = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return val.toLocaleString();
};

const fmtPercent = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return `${(val * 100).toFixed(2)}%`;
};

export default function StockDashboard({ ticker, onBack }) {
    const [quote, setQuote] = useState(null);
    const [fairValue, setFairValue] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (!ticker) return;
        setLoading(true);
        setError(null);
        setAiAnalysis(null);

        const fetchData = async () => {
            try {
                const [quoteRes, fairValueRes, financialsRes] = await Promise.all([
                    fetch(`/api/quote/${ticker}`).then(r => r.json()),
                    fetch(`/api/fair-value/${ticker}`).then(r => r.json()),
                    fetch(`/api/financials/${ticker}`).then(r => r.json()),
                ]);

                if (quoteRes.error) throw new Error(quoteRes.error);

                setQuote(quoteRes);
                setFairValue(fairValueRes);
                setFinancials(financialsRes);
                setLoading(false);

                // Fetch AI analysis in the background
                setAiLoading(true);
                try {
                    const aiRes = await fetch(`/api/ai-analysis/${ticker}`).then(r => r.json());
                    setAiAnalysis(aiRes);
                } catch {
                    setAiAnalysis({ available: false });
                }
                setAiLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchData();
    }, [ticker]);

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner-large" />
                <h3>Analyzing {ticker}...</h3>
                <p>Fetching financial data and calculating fair value</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <div className="error-icon">⚠</div>
                <h3>Unable to load data</h3>
                <p>{error}</p>
                <button className="btn-primary" onClick={onBack}>← Try Another Ticker</button>
            </div>
        );
    }

    const isPositive = quote.change >= 0;

    return (
        <div className="dashboard">
            {/* Back button */}
            <button className="back-btn" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                New Search
            </button>

            {/* Stock header */}
            <div className="stock-header glass-card">
                <div className="stock-header-left">
                    <div className="stock-identity">
                        <h2 className="stock-symbol">{quote.symbol}</h2>
                        <span className="stock-exchange">{quote.exchange}</span>
                    </div>
                    <p className="stock-name">{quote.longName}</p>
                </div>
                <div className="stock-header-right">
                    <div className="stock-price">{fmtCurrency(quote.price)}</div>
                    <div className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>
                        <span>{isPositive ? '▲' : '▼'} {fmtCurrency(Math.abs(quote.change))}</span>
                        <span>({isPositive ? '+' : ''}{fmtNum(quote.changePercent)}%)</span>
                    </div>
                    <span className="stock-currency">{quote.currency}</span>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="tab-nav">
                {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'fairvalue', label: 'Fair Value' },
                    { id: 'financials', label: 'Financials' },
                    { id: 'ai', label: 'AI Analysis' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        {tab.id === 'ai' && aiLoading && <span className="tab-loading" />}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
                {activeTab === 'overview' && (
                    <OverviewTab quote={quote} fairValue={fairValue} />
                )}
                {activeTab === 'fairvalue' && (
                    <FairValueTab quote={quote} fairValue={fairValue} />
                )}
                {activeTab === 'financials' && (
                    <FinancialsTab financials={financials} />
                )}
                {activeTab === 'ai' && (
                    <AIAnalysisTab aiAnalysis={aiAnalysis} aiLoading={aiLoading} />
                )}
            </div>
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ quote, fairValue }) {
    return (
        <div className="tab-panel">
            {/* Fair Value Summary at top */}
            {fairValue && fairValue.fairValueRange && fairValue.fairValueRange.mid && (
                <div className="glass-card fair-value-summary-card">
                    <FairValueGauge
                        currentPrice={quote.price}
                        fairValue={fairValue.fairValueRange}
                        verdict={fairValue.verdict}
                    />
                </div>
            )}

            {/* Key Metrics */}
            <h3 className="section-title">Key Metrics</h3>
            <div className="metrics-grid">
                <MetricCard label="Market Cap" value={fmtLargeNumber(quote.marketCap)} icon="📊" />
                <MetricCard label="P/E Ratio (TTM)" value={fmtNum(quote.trailingPE)} icon="📈" />
                <MetricCard label="Forward P/E" value={fmtNum(quote.forwardPE)} icon="🔮" />
                <MetricCard label="EPS (TTM)" value={fmtCurrency(quote.eps)} icon="💰" />
                <MetricCard label="Forward EPS" value={fmtCurrency(quote.forwardEps)} icon="📝" />
                <MetricCard label="Dividend Yield" value={quote.dividendYield ? fmtPercent(quote.dividendYield) : 'None'} icon="💵" />
                <MetricCard label="Beta" value={fmtNum(quote.beta)} icon="⚡" />
                <MetricCard label="Book Value" value={fmtCurrency(quote.bookValue)} icon="📚" />
                <MetricCard label="Price/Book" value={fmtNum(quote.priceToBook)} icon="🏷" />
            </div>

            {/* Trading Data */}
            <h3 className="section-title">Trading Data</h3>
            <div className="metrics-grid">
                <MetricCard label="Open" value={fmtCurrency(quote.open)} icon="🔓" />
                <MetricCard label="Day High" value={fmtCurrency(quote.dayHigh)} icon="⬆" />
                <MetricCard label="Day Low" value={fmtCurrency(quote.dayLow)} icon="⬇" />
                <MetricCard label="Volume" value={fmtVolume(quote.volume)} icon="📶" />
                <MetricCard label="Avg Volume" value={fmtVolume(quote.avgVolume)} icon="📉" />
                <MetricCard label="52W High" value={fmtCurrency(quote.fiftyTwoWeekHigh)} icon="🏔" />
                <MetricCard label="52W Low" value={fmtCurrency(quote.fiftyTwoWeekLow)} icon="🏜" />
                <MetricCard label="50D Avg" value={fmtCurrency(quote.fiftyDayAverage)} icon="📐" />
                <MetricCard label="200D Avg" value={fmtCurrency(quote.twoHundredDayAverage)} icon="📏" />
            </div>
        </div>
    );
}

// ─── Fair Value Tab ───────────────────────────────────────────
function FairValueTab({ quote, fairValue }) {
    if (!fairValue || !fairValue.methods || Object.keys(fairValue.methods).length === 0) {
        return (
            <div className="tab-panel">
                <div className="glass-card empty-state">
                    <h3>No Fair Value Data</h3>
                    <p>Insufficient financial data to calculate fair value for this stock.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="tab-panel">
            {/* Gauge */}
            {fairValue.fairValueRange && fairValue.fairValueRange.mid && (
                <div className="glass-card">
                    <FairValueGauge
                        currentPrice={quote.price}
                        fairValue={fairValue.fairValueRange}
                        verdict={fairValue.verdict}
                    />
                </div>
            )}

            {/* Individual methods */}
            <h3 className="section-title">Valuation Methods</h3>
            <div className="valuation-methods">
                {Object.entries(fairValue.methods).map(([key, method]) => {
                    const diff = ((method.value - quote.price) / quote.price * 100);
                    const isAbove = diff > 0;

                    return (
                        <div key={key} className="glass-card valuation-method-card">
                            <div className="method-header">
                                <h4>{method.label}</h4>
                                <div className="method-value-group">
                                    <span className="method-value">{fmtCurrency(method.value)}</span>
                                    <span className={`method-diff ${isAbove ? 'positive' : 'negative'}`}>
                                        {isAbove ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% {isAbove ? 'above' : 'below'} current
                                    </span>
                                </div>
                            </div>
                            <div className="method-assumptions">
                                <span className="assumptions-label">Assumptions:</span>
                                <div className="assumptions-grid">
                                    {Object.entries(method.assumptions).map(([aKey, aVal]) => (
                                        <div key={aKey} className="assumption-item">
                                            <span className="assumption-key">{formatAssumptionKey(aKey)}</span>
                                            <span className="assumption-val">
                                                {typeof aVal === 'number'
                                                    ? aVal >= 1e6 ? fmtLargeNumber(aVal) : fmtNum(aVal)
                                                    : String(aVal)
                                                }
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function formatAssumptionKey(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
}

// ─── Financials Tab ───────────────────────────────────────────
function FinancialsTab({ financials }) {
    if (!financials) {
        return (
            <div className="tab-panel">
                <div className="glass-card empty-state">
                    <h3>Financial data unavailable</h3>
                </div>
            </div>
        );
    }

    const fd = financials.financialData || {};
    const ks = financials.defaultKeyStatistics || {};
    const sd = financials.summaryDetail || {};

    return (
        <div className="tab-panel">
            {/* Financial Health */}
            <h3 className="section-title">Financial Health</h3>
            <div className="metrics-grid">
                <MetricCard label="Revenue" value={fmtLargeNumber(fd.totalRevenue)} icon="💹" />
                <MetricCard label="Revenue Growth" value={fd.revenueGrowth ? fmtPercent(fd.revenueGrowth) : 'N/A'} icon="📈"
                    trend={fd.revenueGrowth ? fd.revenueGrowth * 100 : null} />
                <MetricCard label="Gross Profit" value={fmtLargeNumber(fd.grossProfits)} icon="✅" />
                <MetricCard label="Profit Margin" value={fd.profitMargins ? fmtPercent(fd.profitMargins) : 'N/A'} icon="📊" />
                <MetricCard label="Operating Margin" value={fd.operatingMargins ? fmtPercent(fd.operatingMargins) : 'N/A'} icon="⚙" />
                <MetricCard label="EBITDA" value={fmtLargeNumber(fd.ebitda)} icon="🏢" />
                <MetricCard label="Free Cash Flow" value={fmtLargeNumber(fd.freeCashflow)} icon="💸" />
                <MetricCard label="Operating Cash Flow" value={fmtLargeNumber(fd.operatingCashflow)} icon="🔄" />
                <MetricCard label="Earnings Growth" value={fd.earningsGrowth ? fmtPercent(fd.earningsGrowth) : 'N/A'} icon="🚀"
                    trend={fd.earningsGrowth ? fd.earningsGrowth * 100 : null} />
            </div>

            {/* Balance Sheet */}
            <h3 className="section-title">Balance Sheet</h3>
            <div className="metrics-grid">
                <MetricCard label="Total Cash" value={fmtLargeNumber(fd.totalCash)} icon="🏦" />
                <MetricCard label="Total Debt" value={fmtLargeNumber(fd.totalDebt)} icon="📋" />
                <MetricCard label="Debt/Equity" value={fd.debtToEquity ? fmtNum(fd.debtToEquity) : 'N/A'} icon="⚖" />
                <MetricCard label="Current Ratio" value={fd.currentRatio ? fmtNum(fd.currentRatio) : 'N/A'} icon="🔢" />
                <MetricCard label="Return on Equity" value={fd.returnOnEquity ? fmtPercent(fd.returnOnEquity) : 'N/A'} icon="💎" />
                <MetricCard label="Return on Assets" value={fd.returnOnAssets ? fmtPercent(fd.returnOnAssets) : 'N/A'} icon="🏠" />
            </div>

            {/* Valuation Ratios */}
            <h3 className="section-title">Valuation Ratios</h3>
            <div className="metrics-grid">
                <MetricCard label="Trailing P/E" value={fmtNum(sd.trailingPE)} icon="📈" />
                <MetricCard label="Forward P/E" value={fmtNum(sd.forwardPE)} icon="🔮" />
                <MetricCard label="PEG Ratio" value={fmtNum(ks.pegRatio)} icon="📐" />
                <MetricCard label="Price/Sales" value={fmtNum(ks.priceToSalesTrailing12Months)} icon="🏷" />
                <MetricCard label="Price/Book" value={fmtNum(sd.priceToBook)} icon="📚" />
                <MetricCard label="EV/Revenue" value={fmtNum(ks.enterpriseToRevenue)} icon="🔍" />
                <MetricCard label="EV/EBITDA" value={fmtNum(ks.enterpriseToEbitda)} icon="🗄" />
                <MetricCard label="Enterprise Value" value={fmtLargeNumber(ks.enterpriseValue)} icon="🏢" />
            </div>

            {/* Income Statement History */}
            {financials.incomeStatement && financials.incomeStatement.length > 0 && (
                <>
                    <h3 className="section-title">Annual Income Statement</h3>
                    <div className="glass-card table-card">
                        <div className="table-wrapper">
                            <table className="financials-table">
                                <thead>
                                    <tr>
                                        <th>Period</th>
                                        <th>Total Revenue</th>
                                        <th>Gross Profit</th>
                                        <th>Operating Income</th>
                                        <th>Net Income</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financials.incomeStatement.map((stmt, i) => (
                                        <tr key={i}>
                                            <td>{stmt.endDate ? new Date(stmt.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'N/A'}</td>
                                            <td>{fmtLargeNumber(stmt.totalRevenue)}</td>
                                            <td>{fmtLargeNumber(stmt.grossProfit)}</td>
                                            <td>{fmtLargeNumber(stmt.operatingIncome)}</td>
                                            <td>{fmtLargeNumber(stmt.netIncome)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── AI Analysis Tab ──────────────────────────────────────────
function AIAnalysisTab({ aiAnalysis, aiLoading }) {
    if (aiLoading) {
        return (
            <div className="tab-panel">
                <div className="glass-card ai-loading-card">
                    <div className="loading-spinner-large" />
                    <h3>Generating AI Analysis...</h3>
                    <p>Our AI agent is analyzing financial data and forming an investment thesis</p>
                </div>
            </div>
        );
    }

    if (!aiAnalysis || !aiAnalysis.available) {
        return (
            <div className="tab-panel">
                <div className="glass-card empty-state">
                    <div className="ai-disabled-icon">🤖</div>
                    <h3>AI Analysis Not Available</h3>
                    <p>{aiAnalysis?.message || 'Set your GEMINI_API_KEY in the .env file to enable AI-powered analysis.'}</p>
                    <div className="setup-instructions">
                        <h4>Setup Instructions:</h4>
                        <ol>
                            <li>Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></li>
                            <li>Create a <code>.env</code> file in the project root</li>
                            <li>Add: <code>GEMINI_API_KEY=your_key_here</code></li>
                            <li>Restart the server</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    const a = aiAnalysis.analysis;

    const getRatingColor = (rating) => {
        if (!rating) return '#888';
        const r = rating.toLowerCase();
        if (r.includes('strong buy')) return '#00e676';
        if (r.includes('buy')) return '#66bb6a';
        if (r.includes('hold')) return '#ffa726';
        if (r.includes('sell')) return '#ef5350';
        return '#888';
    };

    return (
        <div className="tab-panel">
            {/* Rating Banner */}
            <div className="glass-card ai-rating-card" style={{ borderColor: getRatingColor(a.rating) }}>
                <div className="ai-rating-header">
                    <span className="ai-label">🤖 AI Rating</span>
                    <span className="ai-rating" style={{ color: getRatingColor(a.rating) }}>{a.rating}</span>
                </div>
                {a.targetPrice && (
                    <div className="ai-target">
                        <span className="target-label">Price Target:</span>
                        <span className="target-value">${Number(a.targetPrice).toFixed(2)}</span>
                        <span className="target-horizon">({a.timeHorizon})</span>
                    </div>
                )}
                <div className="ai-confidence">
                    <span>Confidence: <strong>{a.confidenceLevel}</strong></span>
                </div>
            </div>

            {/* Summary */}
            <div className="glass-card">
                <h3 className="card-title">Executive Summary</h3>
                <p className="ai-summary-text">{a.summary}</p>
            </div>

            {/* Bull / Bear Cases */}
            <div className="ai-cases-grid">
                <div className="glass-card bull-card">
                    <h3 className="card-title">🟢 Bull Case</h3>
                    <ul className="ai-list">
                        {(a.bullCase || []).map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
                <div className="glass-card bear-card">
                    <h3 className="card-title">🔴 Bear Case</h3>
                    <ul className="ai-list">
                        {(a.bearCase || []).map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Risks & Catalysts */}
            <div className="ai-cases-grid">
                <div className="glass-card">
                    <h3 className="card-title">⚠️ Key Risks</h3>
                    <ul className="ai-list">
                        {(a.risks || []).map((risk, i) => (
                            <li key={i}>{risk}</li>
                        ))}
                    </ul>
                </div>
                <div className="glass-card">
                    <h3 className="card-title">🚀 Catalysts</h3>
                    <ul className="ai-list">
                        {(a.catalysts || []).map((cat, i) => (
                            <li key={i}>{cat}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
