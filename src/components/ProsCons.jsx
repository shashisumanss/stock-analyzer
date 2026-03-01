import { useMemo } from 'react';

export default function ProsCons({ quote, financials }) {
    const { pros, cons } = useMemo(() => {
        const fd = financials?.financialData || {};
        const pros = [];
        const cons = [];

        // Revenue Growth
        if (fd.revenueGrowth != null) {
            if (fd.revenueGrowth > 0.1) pros.push(`Strong revenue growth of ${(fd.revenueGrowth * 100).toFixed(1)}% year-over-year`);
            else if (fd.revenueGrowth > 0) pros.push(`Positive revenue growth of ${(fd.revenueGrowth * 100).toFixed(1)}%`);
            else cons.push(`Revenue declining at ${(fd.revenueGrowth * 100).toFixed(1)}% year-over-year`);
        }

        // Earnings Growth
        if (fd.earningsGrowth != null) {
            if (fd.earningsGrowth > 0.1) pros.push(`Earnings growing at ${(fd.earningsGrowth * 100).toFixed(1)}%`);
            else if (fd.earningsGrowth < -0.05) cons.push(`Earnings declining at ${(fd.earningsGrowth * 100).toFixed(1)}%`);
        }

        // Profit Margins
        if (fd.profitMargins != null) {
            if (fd.profitMargins > 0.2) pros.push(`High profit margins of ${(fd.profitMargins * 100).toFixed(1)}%`);
            else if (fd.profitMargins < 0.05) cons.push(`Low profit margins of ${(fd.profitMargins * 100).toFixed(1)}%`);
            else if (fd.profitMargins < 0) cons.push(`Company is unprofitable with ${(fd.profitMargins * 100).toFixed(1)}% margins`);
        }

        // ROE
        if (fd.returnOnEquity != null) {
            if (fd.returnOnEquity > 0.2) pros.push(`Excellent return on equity of ${(fd.returnOnEquity * 100).toFixed(1)}%`);
            else if (fd.returnOnEquity < 0.05) cons.push(`Weak return on equity at ${(fd.returnOnEquity * 100).toFixed(1)}%`);
        }

        // Free Cash Flow
        if (fd.freeCashflow != null) {
            if (fd.freeCashflow > 1e9) pros.push(`Strong free cash flow of $${(fd.freeCashflow / 1e9).toFixed(1)}B`);
            else if (fd.freeCashflow > 0) pros.push(`Positive free cash flow of $${(fd.freeCashflow / 1e6).toFixed(0)}M`);
            else cons.push('Negative free cash flow — burning cash');
        }

        // Debt
        if (fd.debtToEquity != null) {
            if (fd.debtToEquity < 30) pros.push(`Low debt-to-equity ratio of ${fd.debtToEquity.toFixed(1)}`);
            else if (fd.debtToEquity > 150) cons.push(`High debt-to-equity ratio of ${fd.debtToEquity.toFixed(1)}`);
            else if (fd.debtToEquity > 100) cons.push(`Elevated debt levels with D/E of ${fd.debtToEquity.toFixed(1)}`);
        }

        // Current Ratio
        if (fd.currentRatio != null) {
            if (fd.currentRatio > 2) pros.push(`Strong liquidity with current ratio of ${fd.currentRatio.toFixed(2)}`);
            else if (fd.currentRatio < 1) cons.push(`Liquidity risk — current ratio below 1.0 (${fd.currentRatio.toFixed(2)})`);
        }

        // Valuation (P/E)
        if (quote?.trailingPE != null) {
            if (quote.trailingPE < 15) pros.push(`Attractive valuation with P/E of ${quote.trailingPE.toFixed(1)}`);
            else if (quote.trailingPE > 40) cons.push(`Premium valuation with P/E of ${quote.trailingPE.toFixed(1)}`);
        }

        // Dividend
        if (quote?.dividendYield != null && quote.dividendYield > 0.02) {
            pros.push(`Pays dividend yield of ${(quote.dividendYield * 100).toFixed(2)}%`);
        }

        // Beta / Volatility
        if (quote?.beta != null) {
            if (quote.beta > 1.5) cons.push(`High volatility with beta of ${quote.beta.toFixed(2)}`);
            else if (quote.beta < 0.8) pros.push(`Low volatility with beta of ${quote.beta.toFixed(2)}`);
        }

        // 52-Week position
        if (quote?.price && quote?.fiftyTwoWeekHigh && quote?.fiftyTwoWeekLow) {
            const pctFromHigh = ((quote.fiftyTwoWeekHigh - quote.price) / quote.fiftyTwoWeekHigh) * 100;
            if (pctFromHigh > 20) cons.push(`Trading ${pctFromHigh.toFixed(0)}% below 52-week high`);
            else if (pctFromHigh < 5) pros.push('Trading near 52-week highs');
        }

        return { pros: pros.slice(0, 5), cons: cons.slice(0, 5) };
    }, [quote, financials]);

    if (pros.length === 0 && cons.length === 0) return null;

    return (
        <div className="pros-cons-container">
            <div className="pros-section">
                <h4 className="pros-title">
                    <span className="indicator-dot green" /> Growth Drivers
                </h4>
                <ul className="pros-list">
                    {pros.map((item, i) => (
                        <li key={i}><span className="bullet green">✓</span> {item}</li>
                    ))}
                    {pros.length === 0 && <li className="empty-item">No significant growth drivers identified</li>}
                </ul>
            </div>
            <div className="cons-section">
                <h4 className="cons-title">
                    <span className="indicator-dot red" /> Challenges
                </h4>
                <ul className="cons-list">
                    {cons.map((item, i) => (
                        <li key={i}><span className="bullet red">✗</span> {item}</li>
                    ))}
                    {cons.length === 0 && <li className="empty-item">No significant challenges identified</li>}
                </ul>
            </div>
        </div>
    );
}
