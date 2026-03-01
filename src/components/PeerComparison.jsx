import { useState, useEffect } from 'react';

function formatMktCap(val) {
    if (val == null) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
    return `$${val.toFixed(0)}`;
}

function formatPct(val) {
    if (val == null) return 'N/A';
    return `${(val * 100).toFixed(1)}%`;
}

function formatNum(val, decimals = 1) {
    if (val == null) return 'N/A';
    return val.toFixed(decimals);
}

const METRICS = [
    { key: 'marketCap', label: 'Market Cap', format: formatMktCap },
    { key: 'trailingPE', label: 'P/E Ratio', format: v => formatNum(v) },
    { key: 'forwardPE', label: 'Forward P/E', format: v => formatNum(v) },
    { key: 'priceToBook', label: 'P/B Ratio', format: v => formatNum(v, 2) },
    { key: 'dividendYield', label: 'Div. Yield', format: formatPct },
    { key: 'revenueGrowth', label: 'Rev. Growth', format: formatPct },
    { key: 'profitMargins', label: 'Profit Margin', format: formatPct },
    { key: 'returnOnEquity', label: 'ROE', format: formatPct },
    { key: 'beta', label: 'Beta', format: v => formatNum(v, 2) },
];

export default function PeerComparison({ ticker, quote }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/peers/${ticker}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [ticker]);

    if (loading) return <div className="peers-loading"><div className="spinner" /></div>;
    if (!data || !data.peers || data.peers.length === 0) return null;

    // Build the comparison array with the current stock first
    const currentStock = {
        symbol: ticker,
        name: quote?.shortName || quote?.longName || ticker,
        price: quote?.price,
        marketCap: quote?.marketCap,
        trailingPE: quote?.trailingPE,
        forwardPE: quote?.forwardPE,
        priceToBook: quote?.priceToBook,
        dividendYield: quote?.dividendYield,
        revenueGrowth: null, // from financials, not quote
        profitMargins: null,
        returnOnEquity: null,
        beta: quote?.beta,
        isCurrent: true,
    };

    const allStocks = [currentStock, ...data.peers];

    return (
        <div className="peer-container">
            <div className="peer-header">
                <h3>Peer Comparison</h3>
                <span className="peer-sector">{data.sector} — {data.industry}</span>
            </div>
            <div className="peer-table-wrapper">
                <table className="peer-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">Company</th>
                            <th>Price</th>
                            {METRICS.map(m => (
                                <th key={m.key}>{m.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allStocks.map(stock => (
                            <tr key={stock.symbol} className={stock.isCurrent ? 'current-stock' : ''}>
                                <td className="sticky-col">
                                    <div className="peer-name-cell">
                                        <span className="peer-symbol">{stock.symbol}</span>
                                        <span className="peer-company-name">{stock.name}</span>
                                    </div>
                                </td>
                                <td>${stock.price?.toFixed(2) || 'N/A'}</td>
                                {METRICS.map(m => {
                                    const val = stock[m.key];
                                    return (
                                        <td key={m.key} className={getMetricClass(m.key, val, allStocks)}>
                                            {m.format(val)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function getMetricClass(key, val, allStocks) {
    if (val == null) return '';
    const vals = allStocks.map(s => s[key]).filter(v => v != null);
    if (vals.length < 2) return '';

    const sorted = [...vals].sort((a, b) => a - b);
    const isLowerBetter = ['trailingPE', 'forwardPE', 'priceToBook', 'beta'].includes(key);

    if (isLowerBetter) {
        if (val === sorted[0]) return 'best-value';
        if (val === sorted[sorted.length - 1]) return 'worst-value';
    } else {
        if (val === sorted[sorted.length - 1]) return 'best-value';
        if (val === sorted[0]) return 'worst-value';
    }
    return '';
}
