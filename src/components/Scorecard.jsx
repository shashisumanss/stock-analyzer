import { useMemo } from 'react';

function calcScore(value, thresholds) {
    // thresholds = [bad, ok, good, great] — returns 1-10
    if (value == null) return null;
    const [bad, ok, good, great] = thresholds;
    if (value >= great) return 10;
    if (value >= good) return 8;
    if (value >= ok) return 6;
    if (value >= bad) return 4;
    return 2;
}

function calcInverseScore(value, thresholds) {
    // Lower is better (e.g., P/E, debt)
    if (value == null) return null;
    const [great, good, ok, bad] = thresholds;
    if (value <= great) return 10;
    if (value <= good) return 8;
    if (value <= ok) return 6;
    if (value <= bad) return 4;
    return 2;
}

function getScoreColor(score) {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
}

function getScoreLabel(score) {
    if (score >= 8) return 'Strong';
    if (score >= 6) return 'Moderate';
    if (score >= 4) return 'Weak';
    return 'Poor';
}

export default function Scorecard({ quote, financials }) {
    const scores = useMemo(() => {
        const fd = financials?.financialData || {};
        const price = quote?.price;
        const high52 = quote?.fiftyTwoWeekHigh;
        const low52 = quote?.fiftyTwoWeekLow;
        const avg50 = quote?.fiftyDayAverage;
        const avg200 = quote?.twoHundredDayAverage;

        // 1. Performance: based on position in 52W range and vs moving averages
        let perfScore = null;
        if (price && high52 && low52) {
            const rangePos = (price - low52) / (high52 - low52); // 0 to 1
            let pScore = rangePos * 10;
            if (avg50 && price > avg50) pScore = Math.min(10, pScore + 1);
            if (avg200 && price > avg200) pScore = Math.min(10, pScore + 1);
            perfScore = Math.round(Math.max(1, Math.min(10, pScore)));
        }

        // 2. Valuation: P/E, PEG, P/B (lower = better)
        const peScore = calcInverseScore(quote?.trailingPE, [12, 18, 25, 40]);
        const pbScore = calcInverseScore(quote?.priceToBook, [1, 3, 5, 10]);
        const pegScore = calcInverseScore(financials?.defaultKeyStatistics?.pegRatio, [0.5, 1, 1.5, 2.5]);
        const valScores = [peScore, pbScore, pegScore].filter(s => s != null);
        const valScore = valScores.length > 0 ? Math.round(valScores.reduce((a, b) => a + b) / valScores.length) : null;

        // 3. Growth: revenue + earnings growth
        const revGrowthScore = calcScore(fd.revenueGrowth, [0, 0.05, 0.1, 0.2]);
        const earnGrowthScore = calcScore(fd.earningsGrowth, [0, 0.05, 0.1, 0.2]);
        const growthScores = [revGrowthScore, earnGrowthScore].filter(s => s != null);
        const growthScore = growthScores.length > 0 ? Math.round(growthScores.reduce((a, b) => a + b) / growthScores.length) : null;

        // 4. Profitability: margins, ROE, ROA
        const marginScore = calcScore(fd.profitMargins, [0, 0.05, 0.15, 0.25]);
        const roeScore = calcScore(fd.returnOnEquity, [0, 0.08, 0.15, 0.25]);
        const roaScore = calcScore(fd.returnOnAssets, [0, 0.03, 0.08, 0.15]);
        const profScores = [marginScore, roeScore, roaScore].filter(s => s != null);
        const profScore = profScores.length > 0 ? Math.round(profScores.reduce((a, b) => a + b) / profScores.length) : null;

        // 5. Financial Stability: D/E, current ratio, FCF
        const deScore = calcInverseScore(fd.debtToEquity, [20, 50, 100, 200]);
        const crScore = calcScore(fd.currentRatio, [0.5, 1, 1.5, 2]);
        const fcfScore = fd.freeCashflow > 0 ? calcScore(fd.freeCashflow, [0, 1e8, 1e9, 5e9]) : 2;
        const stabScores = [deScore, crScore, fcfScore].filter(s => s != null);
        const stabScore = stabScores.length > 0 ? Math.round(stabScores.reduce((a, b) => a + b) / stabScores.length) : null;

        return [
            { name: 'Performance', score: perfScore, icon: '📈' },
            { name: 'Valuation', score: valScore, icon: '💎' },
            { name: 'Growth', score: growthScore, icon: '🚀' },
            { name: 'Profitability', score: profScore, icon: '💰' },
            { name: 'Stability', score: stabScore, icon: '🛡️' },
        ];
    }, [quote, financials]);

    const overallScore = useMemo(() => {
        const valid = scores.filter(s => s.score != null);
        if (valid.length === 0) return null;
        return Math.round(valid.reduce((a, b) => a + b.score, 0) / valid.length);
    }, [scores]);

    return (
        <div className="scorecard-container">
            <div className="scorecard-header">
                <h3>Stock Scorecard</h3>
                {overallScore != null && (
                    <div className="overall-score" style={{ borderColor: getScoreColor(overallScore) }}>
                        <span className="score-number" style={{ color: getScoreColor(overallScore) }}>
                            {overallScore}
                        </span>
                        <span className="score-max">/10</span>
                    </div>
                )}
            </div>
            <div className="scorecard-grid">
                {scores.map(({ name, score, icon }) => (
                    <div key={name} className="score-item">
                        <div className="score-item-header">
                            <span className="score-icon">{icon}</span>
                            <span className="score-name">{name}</span>
                        </div>
                        <div className="score-bar-container">
                            <div
                                className="score-bar"
                                style={{
                                    width: score != null ? `${score * 10}%` : '0%',
                                    backgroundColor: score != null ? getScoreColor(score) : '#333',
                                }}
                            />
                        </div>
                        <div className="score-details">
                            <span className="score-value" style={{ color: score != null ? getScoreColor(score) : '#666' }}>
                                {score != null ? `${score}/10` : 'N/A'}
                            </span>
                            <span className="score-label">{score != null ? getScoreLabel(score) : '—'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
