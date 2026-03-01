import { useState, useEffect } from 'react';
import MetricCard from './MetricCard';
import FairValueGauge from './FairValueGauge';
import PriceChart from './PriceChart';
import Scorecard from './Scorecard';
import ProsCons from './ProsCons';
import AnalystRatings from './AnalystRatings';
import ForecastCharts from './ForecastCharts';
import PeerComparison from './PeerComparison';
import DeepResearch from './DeepResearch';

function formatLargeNumber(num) {
    if (num == null) return 'N/A';
    if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return `$${num.toLocaleString()}`;
}

function formatPercent(val) {
    if (val == null) return 'N/A';
    return `${(val * 100).toFixed(2)}%`;
}

const TABS = ['Overview', 'Fair Value', 'Financials', 'Peers', 'AI Analysis', 'Deep Research'];

export default function StockDashboard({ ticker, onBack }) {
    const [activeTab, setActiveTab] = useState('Overview');
    const [quote, setQuote] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [fairValue, setFairValue] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setActiveTab('Overview');

        Promise.all([
            fetch(`/api/quote/${ticker}`).then(r => r.json()),
            fetch(`/api/financials/${ticker}`).then(r => r.json()),
            fetch(`/api/fair-value/${ticker}`).then(r => r.json()),
        ])
            .then(([q, f, fv]) => {
                if (q.error) throw new Error(q.error);
                setQuote(q);
                setFinancials(f);
                setFairValue(fv);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

        // Load AI analysis in background
        fetch(`/api/ai-analysis/${ticker}`)
            .then(r => r.json())
            .then(setAiAnalysis)
            .catch(() => { });
    }, [ticker]);

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-content">
                    <div className="spinner large" />
                    <p>Analyzing <strong>{ticker}</strong>...</p>
                    <span className="loading-sub">Fetching financials, calculating fair value</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <div className="error-content">
                    <span className="error-icon">⚠️</span>
                    <h3>Unable to load data</h3>
                    <p>{error}</p>
                    <button className="back-btn" onClick={onBack}>← Try Another Stock</button>
                </div>
            </div>
        );
    }

    const isPositive = (quote?.change || 0) >= 0;

    return (
        <div className="dashboard">
            <button className="back-btn" onClick={onBack}>← New Search</button>

            {/* Stock header */}
            <div className="stock-header-card">
                <div className="stock-header-left">
                    <div className="stock-title-row">
                        <h1 className="stock-symbol">{quote?.symbol}</h1>
                        <span className="exchange-badge">{quote?.exchange}</span>
                        {quote?.sector && <span className="sector-badge">{quote.sector}</span>}
                    </div>
                    <p className="stock-company-name">{quote?.longName || quote?.shortName}</p>
                </div>
                <div className="stock-header-right">
                    <span className="stock-price">${quote?.price?.toFixed(2)}</span>
                    <span className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? '▲' : '▼'} ${Math.abs(quote?.change || 0).toFixed(2)} ({Math.abs(quote?.changePercent || 0).toFixed(2)}%)
                    </span>
                    <span className="stock-currency">{quote?.currency}</span>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="tab-nav">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
                {activeTab === 'Overview' && (
                    <OverviewTab quote={quote} financials={financials} fairValue={fairValue} ticker={ticker} />
                )}
                {activeTab === 'Fair Value' && (
                    <FairValueTab fairValue={fairValue} quote={quote} />
                )}
                {activeTab === 'Financials' && (
                    <FinancialsTab financials={financials} />
                )}
                {activeTab === 'Peers' && (
                    <PeersTab ticker={ticker} quote={quote} />
                )}
                {activeTab === 'AI Analysis' && (
                    <AITab analysis={aiAnalysis} />
                )}
                {activeTab === 'Deep Research' && (
                    <DeepResearch ticker={ticker} />
                )}
            </div>
        </div>
    );
}

/* ─── Overview Tab ─── */
function OverviewTab({ quote, financials, fairValue, ticker }) {
    const fd = financials?.financialData || {};

    return (
        <div className="overview-tab">
            {/* Price Chart */}
            <PriceChart ticker={ticker} />

            {/* Fair Value + Scorecard row */}
            <div className="overview-analysis-row">
                <div className="overview-fair-value">
                    <FairValueGauge fairValue={fairValue} currentPrice={quote?.price} />
                </div>
                <div className="overview-scorecard">
                    <Scorecard quote={quote} financials={financials} />
                </div>
            </div>

            {/* Pros / Cons */}
            <ProsCons quote={quote} financials={financials} />

            {/* Analyst Ratings + Forecasts */}
            <div className="overview-analyst-row">
                <AnalystRatings ticker={ticker} />
                <ForecastCharts ticker={ticker} />
            </div>

            {/* Key Metrics Grid */}
            <div className="section-card">
                <h3>Key Metrics</h3>
                <div className="metrics-grid">
                    <MetricCard label="Market Cap" value={formatLargeNumber(quote?.marketCap)} />
                    <MetricCard label="P/E Ratio" value={quote?.trailingPE?.toFixed(2) || 'N/A'} />
                    <MetricCard label="Forward P/E" value={quote?.forwardPE?.toFixed(2) || 'N/A'} />
                    <MetricCard label="EPS (TTM)" value={quote?.eps ? `$${quote.eps.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="Forward EPS" value={quote?.forwardEps ? `$${quote.forwardEps.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="P/B Ratio" value={quote?.priceToBook?.toFixed(2) || 'N/A'} />
                    <MetricCard label="Beta" value={quote?.beta?.toFixed(2) || 'N/A'} />
                    <MetricCard label="Div. Yield" value={quote?.dividendYield ? formatPercent(quote.dividendYield) : 'None'} />
                </div>
            </div>

            {/* Trading Data */}
            <div className="section-card">
                <h3>Trading Data</h3>
                <div className="metrics-grid">
                    <MetricCard label="Open" value={quote?.open ? `$${quote.open.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="Day High" value={quote?.dayHigh ? `$${quote.dayHigh.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="Day Low" value={quote?.dayLow ? `$${quote.dayLow.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="52W High" value={quote?.fiftyTwoWeekHigh ? `$${quote.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="52W Low" value={quote?.fiftyTwoWeekLow ? `$${quote.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'} />
                    <MetricCard label="Volume" value={quote?.volume?.toLocaleString() || 'N/A'} />
                    <MetricCard label="Avg Volume" value={quote?.avgVolume?.toLocaleString() || 'N/A'} />
                    <MetricCard label="50D Avg" value={quote?.fiftyDayAverage ? `$${quote.fiftyDayAverage.toFixed(2)}` : 'N/A'} />
                </div>
            </div>
        </div>
    );
}

/* ─── Fair Value Tab ─── */
function FairValueTab({ fairValue, quote }) {
    if (!fairValue) return <p className="no-data">Fair value data not available</p>;

    // Convert methods object { dcf: {...}, graham: {...} } to array
    const methodsObj = fairValue.methods || {};
    const methodsList = Object.entries(methodsObj).map(([key, data]) => ({
        name: data.label || key,
        value: data.value,
        assumptions: data.assumptions || null,
    })).filter(m => m.value != null);

    return (
        <div className="fair-value-tab">
            <FairValueGauge fairValue={fairValue} currentPrice={quote?.price} />

            {methodsList.length > 0 && (
                <div className="section-card">
                    <h3>Valuation Methods</h3>
                    <div className="methods-grid">
                        {methodsList.map((method, i) => (
                            <div key={i} className="method-card">
                                <div className="method-header">
                                    <h4>{method.name}</h4>
                                    <span className={`method-value ${method.value > quote?.price ? 'undervalued' : 'overvalued'}`}>
                                        ${method.value?.toFixed(2)}
                                    </span>
                                </div>
                                <div className="method-diff">
                                    {method.value && quote?.price && (
                                        <span className={method.value > quote.price ? 'positive' : 'negative'}>
                                            {((method.value - quote.price) / quote.price * 100).toFixed(1)}% {method.value > quote.price ? 'upside' : 'downside'}
                                        </span>
                                    )}
                                </div>
                                {method.assumptions && (
                                    <div className="method-assumptions">
                                        {Object.entries(method.assumptions).map(([k, v]) => (
                                            <div key={k} className="assumption-row">
                                                <span className="assumption-label">{k}:</span>
                                                <span className="assumption-value">{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


/* ─── Financials Tab ─── */
function FinancialsTab({ financials }) {
    const [view, setView] = useState('annual');
    const fd = financials?.financialData || {};
    const incomeAnnual = financials?.incomeStatement || [];
    const incomeQuarterly = financials?.quarterlyIncome || [];
    const cashflow = financials?.cashflowStatement || [];
    const balanceSheet = financials?.balanceSheet || [];

    const incomeData = view === 'annual' ? incomeAnnual : incomeQuarterly;

    return (
        <div className="financials-tab">
            {/* Financial Health Summary */}
            <div className="section-card">
                <h3>Financial Health</h3>
                <div className="metrics-grid">
                    <MetricCard label="Revenue" value={formatLargeNumber(fd.totalRevenue)} trend={Number.isFinite(fd.revenueGrowth) ? `${(fd.revenueGrowth * 100).toFixed(1)}%` : null} trendUp={fd.revenueGrowth > 0} />
                    <MetricCard label="Gross Profit" value={formatLargeNumber(fd.grossProfits)} />
                    <MetricCard label="Profit Margin" value={fd.profitMargins != null ? formatPercent(fd.profitMargins) : 'N/A'} />
                    <MetricCard label="Operating Margin" value={fd.operatingMargins != null ? formatPercent(fd.operatingMargins) : 'N/A'} />
                    <MetricCard label="EBITDA" value={formatLargeNumber(fd.ebitda)} />
                    <MetricCard label="Free Cash Flow" value={formatLargeNumber(fd.freeCashflow)} />
                    <MetricCard label="ROE" value={fd.returnOnEquity != null ? formatPercent(fd.returnOnEquity) : 'N/A'} />
                    <MetricCard label="ROA" value={fd.returnOnAssets != null ? formatPercent(fd.returnOnAssets) : 'N/A'} />
                    <MetricCard label="Total Debt" value={formatLargeNumber(fd.totalDebt)} />
                    <MetricCard label="Total Cash" value={formatLargeNumber(fd.totalCash)} />
                    <MetricCard label="Debt/Equity" value={fd.debtToEquity?.toFixed(1) || 'N/A'} />
                    <MetricCard label="Current Ratio" value={fd.currentRatio?.toFixed(2) || 'N/A'} />
                </div>
            </div>

            {/* Income Statement */}
            {incomeData.length > 0 && (
                <div className="section-card">
                    <div className="section-header-row">
                        <h3>Income Statement</h3>
                        <div className="view-toggle">
                            <button className={view === 'annual' ? 'active' : ''} onClick={() => setView('annual')}>Annual</button>
                            <button className={view === 'quarterly' ? 'active' : ''} onClick={() => setView('quarterly')}>Quarterly</button>
                        </div>
                    </div>
                    <div className="financial-table-wrapper">
                        <table className="financial-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    {incomeData.map((s, i) => (
                                        <th key={i}>{s.endDate ? new Date(s.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : `Period ${i + 1}`}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { key: 'totalRevenue', label: 'Revenue' },
                                    { key: 'grossProfit', label: 'Gross Profit' },
                                    { key: 'operatingIncome', label: 'Operating Income' },
                                    { key: 'netIncome', label: 'Net Income' },
                                    { key: 'ebitda', label: 'EBITDA' },
                                    { key: 'dilutedEps', label: 'EPS (Diluted)' },
                                ].map(row => (
                                    <tr key={row.key}>
                                        <td className="metric-label">{row.label}</td>
                                        {incomeData.map((s, i) => (
                                            <td key={i}>
                                                {row.key === 'dilutedEps' || row.key === 'basicEps'
                                                    ? s[row.key] != null ? `$${s[row.key].toFixed(2)}` : 'N/A'
                                                    : s[row.key] != null ? formatLargeNumber(s[row.key]) : 'N/A'
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Cash Flow */}
            {cashflow.length > 0 && (
                <div className="section-card">
                    <h3>Cash Flow Statement</h3>
                    <div className="financial-table-wrapper">
                        <table className="financial-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    {cashflow.map((s, i) => (
                                        <th key={i}>{s.endDate ? new Date(s.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : `Period ${i + 1}`}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
                                    { key: 'capitalExpenditure', label: 'Capital Expenditure' },
                                    { key: 'freeCashFlow', label: 'Free Cash Flow' },
                                    { key: 'shareRepurchase', label: 'Share Repurchases' },
                                    { key: 'dividendsPaid', label: 'Dividends Paid' },
                                ].map(row => (
                                    <tr key={row.key}>
                                        <td className="metric-label">{row.label}</td>
                                        {cashflow.map((s, i) => (
                                            <td key={i}>{s[row.key] != null ? formatLargeNumber(s[row.key]) : 'N/A'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Balance Sheet */}
            {balanceSheet.length > 0 && (
                <div className="section-card">
                    <h3>Balance Sheet</h3>
                    <div className="financial-table-wrapper">
                        <table className="financial-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    {balanceSheet.map((s, i) => (
                                        <th key={i}>{s.endDate ? new Date(s.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : `Period ${i + 1}`}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { key: 'totalAssets', label: 'Total Assets' },
                                    { key: 'totalLiabilities', label: 'Total Liabilities' },
                                    { key: 'totalEquity', label: 'Total Equity' },
                                    { key: 'totalDebt', label: 'Total Debt' },
                                    { key: 'cashAndEquivalents', label: 'Cash & Equivalents' },
                                    { key: 'netDebt', label: 'Net Debt' },
                                ].map(row => (
                                    <tr key={row.key}>
                                        <td className="metric-label">{row.label}</td>
                                        {balanceSheet.map((s, i) => (
                                            <td key={i}>{s[row.key] != null ? formatLargeNumber(s[row.key]) : 'N/A'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Peers Tab ─── */
function PeersTab({ ticker, quote }) {
    return (
        <div className="peers-tab">
            <PeerComparison ticker={ticker} quote={quote} />
        </div>
    );
}

/* ─── AI Analysis Tab ─── */
function AITab({ analysis }) {
    if (!analysis) {
        return (
            <div className="ai-loading-section">
                <div className="spinner" />
                <p>Loading AI analysis...</p>
            </div>
        );
    }

    if (!analysis.available) {
        return (
            <div className="section-card ai-not-available">
                <div className="ai-setup">
                    <span className="ai-icon">🤖</span>
                    <h3>AI Analysis Not Available</h3>
                    <p>To enable AI-powered investment analysis, configure your Gemini API key:</p>
                    <ol>
                        <li>Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></li>
                        <li>Create a <code>.env</code> file in the project root</li>
                        <li>Add: <code>GEMINI_API_KEY=your_key_here</code></li>
                        <li>Restart the server</li>
                    </ol>
                </div>
            </div>
        );
    }

    const a = analysis.analysis;

    return (
        <div className="ai-tab">
            {/* Rating badge */}
            <div className="ai-rating-header">
                <div className={`ai-rating-badge ${getRatingClass(a.rating)}`}>
                    {a.rating}
                </div>
                {a.confidenceLevel && <span className="ai-confidence">Confidence: {a.confidenceLevel}</span>}
                {a.targetPrice && <span className="ai-target">Target: ${a.targetPrice}</span>}
            </div>

            {/* Summary */}
            {a.summary && (
                <div className="section-card ai-summary">
                    <h3>Investment Thesis</h3>
                    <p>{a.summary}</p>
                </div>
            )}

            <div className="ai-grid">
                {a.bullCase?.length > 0 && (
                    <div className="section-card ai-bull">
                        <h3>🟢 Bull Case</h3>
                        <ul>{a.bullCase.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                )}
                {a.bearCase?.length > 0 && (
                    <div className="section-card ai-bear">
                        <h3>🔴 Bear Case</h3>
                        <ul>{a.bearCase.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                )}
            </div>

            <div className="ai-grid">
                {a.catalysts?.length > 0 && (
                    <div className="section-card">
                        <h3>⚡ Catalysts</h3>
                        <ul>{a.catalysts.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                )}
                {a.risks?.length > 0 && (
                    <div className="section-card">
                        <h3>⚠️ Risks</h3>
                        <ul>{a.risks.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                )}
            </div>
        </div>
    );
}

function getRatingClass(rating) {
    if (!rating) return '';
    const r = rating.toLowerCase();
    if (r.includes('strong buy')) return 'strong-buy';
    if (r.includes('buy')) return 'buy';
    if (r.includes('strong sell')) return 'strong-sell';
    if (r.includes('sell')) return 'sell';
    return 'hold';
}
