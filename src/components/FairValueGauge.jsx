export default function FairValueGauge({ currentPrice, fairValue, verdict }) {
    if (!fairValue || !fairValue.low || !fairValue.high) {
        return (
            <div className="gauge-container">
                <p className="gauge-unavailable">Insufficient data for fair value calculation</p>
            </div>
        );
    }

    const { low, mid, high } = fairValue;

    // Calculate position on the gauge (0 to 100)
    const rangeMin = low * 0.5;
    const rangeMax = high * 1.5;
    const range = rangeMax - rangeMin;
    const pricePosition = Math.max(0, Math.min(100, ((currentPrice - rangeMin) / range) * 100));
    const lowPosition = ((low - rangeMin) / range) * 100;
    const midPosition = ((mid - rangeMin) / range) * 100;
    const highPosition = ((high - rangeMin) / range) * 100;

    const marginOfSafety = ((mid - currentPrice) / mid * 100);
    const isUndervalued = marginOfSafety > 10;
    const isOvervalued = marginOfSafety < -10;

    return (
        <div className="gauge-container">
            <div className="gauge-header">
                <h3>Fair Value Analysis</h3>
                {verdict && (
                    <span className="gauge-verdict" style={{ color: verdict.color }}>
                        {verdict.icon} {verdict.label}
                    </span>
                )}
            </div>

            <div className="gauge-visual">
                <div className="gauge-bar">
                    {/* Colored zones */}
                    <div
                        className="gauge-zone gauge-zone-undervalued"
                        style={{ left: '0%', width: `${lowPosition}%` }}
                    />
                    <div
                        className="gauge-zone gauge-zone-fair"
                        style={{ left: `${lowPosition}%`, width: `${highPosition - lowPosition}%` }}
                    />
                    <div
                        className="gauge-zone gauge-zone-overvalued"
                        style={{ left: `${highPosition}%`, width: `${100 - highPosition}%` }}
                    />

                    {/* Fair value markers */}
                    <div className="gauge-marker gauge-marker-low" style={{ left: `${lowPosition}%` }}>
                        <div className="marker-line" />
                        <span className="marker-label">${low.toFixed(0)}</span>
                    </div>
                    <div className="gauge-marker gauge-marker-mid" style={{ left: `${midPosition}%` }}>
                        <div className="marker-line marker-line-mid" />
                        <span className="marker-label">Fair: ${mid.toFixed(0)}</span>
                    </div>
                    <div className="gauge-marker gauge-marker-high" style={{ left: `${highPosition}%` }}>
                        <div className="marker-line" />
                        <span className="marker-label">${high.toFixed(0)}</span>
                    </div>

                    {/* Current price pointer */}
                    <div className="gauge-pointer" style={{ left: `${pricePosition}%` }}>
                        <div className="pointer-arrow" />
                        <span className="pointer-label">${currentPrice.toFixed(2)}</span>
                    </div>
                </div>

                <div className="gauge-labels">
                    <span className="gauge-label-text undervalued-text">Undervalued</span>
                    <span className="gauge-label-text fair-text">Fair Value</span>
                    <span className="gauge-label-text overvalued-text">Overvalued</span>
                </div>
            </div>

            <div className="gauge-stats">
                <div className="gauge-stat">
                    <span className="stat-label">Margin of Safety</span>
                    <span className={`stat-value ${isUndervalued ? 'positive' : isOvervalued ? 'negative' : 'neutral'}`}>
                        {marginOfSafety > 0 ? '+' : ''}{marginOfSafety.toFixed(1)}%
                    </span>
                </div>
                <div className="gauge-stat">
                    <span className="stat-label">Upside/Downside</span>
                    <span className={`stat-value ${mid > currentPrice ? 'positive' : 'negative'}`}>
                        {mid > currentPrice ? '+' : ''}{((mid - currentPrice) / currentPrice * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="gauge-stat">
                    <span className="stat-label">Methods Used</span>
                    <span className="stat-value neutral">{fairValue.methodCount}</span>
                </div>
            </div>
        </div>
    );
}
