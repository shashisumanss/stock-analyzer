import { useState, useEffect } from 'react';

function formatValue(val, type) {
    if (val == null) return 'N/A';
    if (type === 'revenue') {
        if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
        if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
        if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
        return `$${val.toFixed(0)}`;
    }
    return `$${val.toFixed(2)}`;
}

function BarChart({ data, type, label }) {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value).filter(v => v != null);
    if (values.length === 0) return null;
    const maxVal = Math.max(...values.map(Math.abs));
    if (maxVal === 0) return null;

    return (
        <div className="forecast-chart">
            <h4>{label}</h4>
            <div className="bar-chart">
                {data.map((item, i) => {
                    const height = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
                    const isEstimate = item.type === 'estimate';
                    return (
                        <div key={i} className="bar-col">
                            <div className="bar-value">{formatValue(item.value, type)}</div>
                            <div className="bar-track">
                                <div
                                    className={`bar-fill ${isEstimate ? 'estimate' : 'actual'} ${item.value < 0 ? 'negative' : ''}`}
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                />
                            </div>
                            <div className={`bar-label ${isEstimate ? 'estimate-label' : ''}`}>
                                {item.year}
                                {isEstimate && <span className="est-badge">Est</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function ForecastCharts({ ticker }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analyst/${ticker}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [ticker]);

    if (loading) return <div className="forecast-loading"><div className="spinner" /></div>;
    if (!data) return null;

    const revenueData = (data.revenueHistory || []).filter(d => d.value != null);
    const epsData = (data.epsHistory || []).filter(d => d.value != null);

    if (revenueData.length === 0 && epsData.length === 0) return null;

    return (
        <div className="forecast-container">
            <h3>Forecasts & Estimates</h3>
            <div className="forecast-grid">
                <BarChart data={revenueData} type="revenue" label="Revenue" />
                <BarChart data={epsData} type="eps" label="Earnings Per Share (EPS)" />
            </div>
        </div>
    );
}
