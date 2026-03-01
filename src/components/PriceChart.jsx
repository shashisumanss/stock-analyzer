import { useEffect, useRef, useState } from 'react';

const RANGES = [
    { label: '1W', period: '5d', interval: '15m' },
    { label: '1M', period: '1mo', interval: '1d' },
    { label: '3M', period: '3mo', interval: '1d' },
    { label: '6M', period: '6mo', interval: '1d' },
    { label: '1Y', period: '1y', interval: '1d' },
    { label: '5Y', period: '5y', interval: '1wk' },
];

function drawChart(canvas, data, hoveredIdx, setHoveredIdx, setPriceInfo) {
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD_TOP = 20;
    const PAD_BOT = 40;
    const PAD_LEFT = 10;
    const PAD_RIGHT = 70;

    const closes = data.map(d => d.close).filter(v => v != null);
    const volumes = data.map(d => d.volume || 0);
    const minPrice = Math.min(...closes) * 0.995;
    const maxPrice = Math.max(...closes) * 1.005;
    const maxVol = Math.max(...volumes);

    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOT;

    const xScale = (i) => PAD_LEFT + (i / (data.length - 1)) * chartW;
    const yScale = (v) => PAD_TOP + (1 - (v - minPrice) / (maxPrice - minPrice)) * chartH;
    const volH = chartH * 0.15;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
        const y = PAD_TOP + (i / gridSteps) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(W - PAD_RIGHT, y);
        ctx.stroke();

        // Price labels
        const price = maxPrice - (i / gridSteps) * (maxPrice - minPrice);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`$${price.toFixed(2)}`, W - PAD_RIGHT + 6, y + 4);
    }

    // Volume bars
    if (maxVol > 0) {
        data.forEach((d, i) => {
            const x = xScale(i);
            const barW = Math.max(1, chartW / data.length - 1);
            const h = (d.volume / maxVol) * volH;
            const color = i > 0 && d.close >= data[i - 1].close
                ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
            ctx.fillStyle = color;
            ctx.fillRect(x - barW / 2, PAD_TOP + chartH - h, barW, h);
        });
    }

    // Price line with gradient fill
    const firstClose = data[0].close;
    const lastClose = data[data.length - 1].close;
    const isPositive = lastClose >= firstClose;
    const lineColor = isPositive ? '#22c55e' : '#ef4444';
    const fillTop = isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';

    // Fill area
    ctx.beginPath();
    let started = false;
    data.forEach((d, i) => {
        if (d.close == null) return;
        const x = xScale(i);
        const y = yScale(d.close);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    });
    ctx.lineTo(xScale(data.length - 1), PAD_TOP + chartH);
    ctx.lineTo(xScale(0), PAD_TOP + chartH);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + chartH);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    started = false;
    data.forEach((d, i) => {
        if (d.close == null) return;
        const x = xScale(i);
        const y = yScale(d.close);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Date labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelCount = Math.min(6, data.length);
    for (let i = 0; i < labelCount; i++) {
        const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
        const x = xScale(idx);
        const date = new Date(data[idx].time);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(label, x, H - 8);
    }

    // Crosshair on hover
    if (hoveredIdx != null && hoveredIdx >= 0 && hoveredIdx < data.length) {
        const d = data[hoveredIdx];
        const x = xScale(hoveredIdx);
        const y = yScale(d.close);

        // Vertical line
        ctx.strokeStyle = 'rgba(139,92,246,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, PAD_TOP);
        ctx.lineTo(x, PAD_TOP + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(W - PAD_RIGHT, y);
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

export default function PriceChart({ ticker }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [activeRange, setActiveRange] = useState('1Y');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const [priceInfo, setPriceInfo] = useState(null);

    useEffect(() => {
        const range = RANGES.find(r => r.label === activeRange) || RANGES[4];
        setLoading(true);
        setData([]);
        setHoveredIdx(null);
        setPriceInfo(null);

        fetch(`/api/history/${ticker}?range=${range.period}&interval=${range.interval}`)
            .then(r => r.json())
            .then(d => {
                if (Array.isArray(d) && d.length > 0) {
                    setData(d);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [ticker, activeRange]);

    useEffect(() => {
        if (!canvasRef.current || data.length === 0) return;
        drawChart(canvasRef.current, data, hoveredIdx, setHoveredIdx, setPriceInfo);
    }, [data, hoveredIdx]);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && data.length > 0) {
                drawChart(canvasRef.current, data, hoveredIdx, setHoveredIdx, setPriceInfo);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [data, hoveredIdx]);

    const handleMouseMove = (e) => {
        if (!canvasRef.current || data.length === 0) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const PAD_LEFT = 10;
        const PAD_RIGHT = 70;
        const chartW = rect.width - PAD_LEFT - PAD_RIGHT;
        const idx = Math.round(((x - PAD_LEFT) / chartW) * (data.length - 1));
        if (idx >= 0 && idx < data.length) {
            setHoveredIdx(idx);
            const d = data[idx];
            const firstClose = data[0].close;
            const change = d.close - firstClose;
            const changePct = (change / firstClose) * 100;
            setPriceInfo({ price: d.close, change, changePct, date: d.time });
        }
    };

    const handleMouseLeave = () => {
        setHoveredIdx(null);
        setPriceInfo(null);
    };

    const firstPrice = data.length > 0 ? data[0].close : null;
    const lastPrice = data.length > 0 ? data[data.length - 1].close : null;
    const totalChange = firstPrice && lastPrice ? lastPrice - firstPrice : 0;
    const totalChangePct = firstPrice ? (totalChange / firstPrice) * 100 : 0;

    return (
        <div className="price-chart-container">
            <div className="chart-header">
                <div className="chart-title">
                    <h3>Price Chart</h3>
                    {priceInfo ? (
                        <div className="chart-crosshair-info">
                            <span className="crosshair-price">${priceInfo.price.toFixed(2)}</span>
                            <span className={`crosshair-change ${priceInfo.change >= 0 ? 'positive' : 'negative'}`}>
                                {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)} ({priceInfo.changePct.toFixed(2)}%)
                            </span>
                            <span className="crosshair-date">{priceInfo.date}</span>
                        </div>
                    ) : data.length > 0 ? (
                        <div className="chart-crosshair-info">
                            <span className={`crosshair-change ${totalChange >= 0 ? 'positive' : 'negative'}`}>
                                {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)} ({totalChangePct.toFixed(2)}%) in period
                            </span>
                        </div>
                    ) : null}
                </div>
                <div className="chart-range-buttons">
                    {RANGES.map(r => (
                        <button
                            key={r.label}
                            className={`range-btn ${activeRange === r.label ? 'active' : ''}`}
                            onClick={() => setActiveRange(r.label)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="chart-wrapper" ref={containerRef}>
                {loading ? (
                    <div className="chart-loading">
                        <div className="spinner" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="chart-loading">
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>No chart data available</span>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '360px', cursor: 'crosshair' }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    />
                )}
            </div>
        </div>
    );
}
