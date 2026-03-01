/**
 * Fair Value Calculation Engine
 * Implements DCF, Graham Number, and Multiples-based valuation
 */

export function calculateFairValue(quote, financials, analysis) {
    const results = {
        currentPrice: quote.regularMarketPrice,
        symbol: quote.symbol,
        methods: {},
        fairValueRange: {},
        marginOfSafety: null,
        verdict: null,
    };

    const fd = financials?.financialData || {};
    const ks = financials?.defaultKeyStatistics || {};
    const cashflows = financials?.cashflowStatementHistory?.cashflowStatements || [];
    const incomeStatements = financials?.incomeStatementHistory?.incomeStatementHistory || [];

    // ─── 1. DCF (Discounted Cash Flow) ──────────────────────────
    try {
        const freeCashFlow = fd.freeCashflow;
        if (freeCashFlow && freeCashFlow > 0) {
            const sharesOutstanding = ks.sharesOutstanding || quote.sharesOutstanding;
            if (sharesOutstanding) {
                // Estimate growth rate from earnings trend or use a conservative default
                let growthRate = 0.08; // default 8%
                const revenueGrowth = fd.revenueGrowth;
                const earningsGrowth = fd.earningsGrowth;
                if (earningsGrowth && earningsGrowth > 0) {
                    growthRate = Math.min(earningsGrowth, 0.25); // cap at 25%
                } else if (revenueGrowth && revenueGrowth > 0) {
                    growthRate = Math.min(revenueGrowth, 0.25);
                }

                const discountRate = 0.10; // 10% WACC
                const terminalGrowthRate = 0.03; // 3% perpetual growth
                const projectionYears = 10;

                let totalPV = 0;
                let projectedFCF = freeCashFlow;

                const projections = [];
                for (let year = 1; year <= projectionYears; year++) {
                    // Taper growth rate towards terminal rate
                    const yearGrowth = growthRate - ((growthRate - terminalGrowthRate) * (year - 1) / projectionYears);
                    projectedFCF *= (1 + yearGrowth);
                    const pv = projectedFCF / Math.pow(1 + discountRate, year);
                    totalPV += pv;
                    projections.push({
                        year,
                        growthRate: (yearGrowth * 100).toFixed(1),
                        fcf: projectedFCF,
                        presentValue: pv,
                    });
                }

                // Terminal value
                const terminalFCF = projectedFCF * (1 + terminalGrowthRate);
                const terminalValue = terminalFCF / (discountRate - terminalGrowthRate);
                const terminalPV = terminalValue / Math.pow(1 + discountRate, projectionYears);
                totalPV += terminalPV;

                // Net cash / debt adjustment
                const totalCash = fd.totalCash || 0;
                const totalDebt = fd.totalDebt || 0;
                const netCash = totalCash - totalDebt;

                const equityValue = totalPV + netCash;
                const dcfPerShare = equityValue / sharesOutstanding;

                results.methods.dcf = {
                    label: 'Discounted Cash Flow (DCF)',
                    value: Math.max(0, dcfPerShare),
                    assumptions: {
                        freeCashFlow,
                        initialGrowthRate: (growthRate * 100).toFixed(1) + '%',
                        discountRate: (discountRate * 100) + '%',
                        terminalGrowthRate: (terminalGrowthRate * 100) + '%',
                        projectionYears,
                        totalCash,
                        totalDebt,
                    },
                    projections,
                };
            }
        }
    } catch (e) {
        console.error('DCF calc error:', e.message);
    }

    // ─── 2. Graham Number ────────────────────────────────────────
    try {
        const eps = quote.epsTrailingTwelveMonths;
        const bookValue = quote.bookValue;
        if (eps && eps > 0 && bookValue && bookValue > 0) {
            const grahamNumber = Math.sqrt(22.5 * eps * bookValue);
            results.methods.graham = {
                label: 'Graham Number',
                value: grahamNumber,
                assumptions: {
                    eps,
                    bookValue,
                    multiplier: 22.5,
                },
            };
        }
    } catch (e) {
        console.error('Graham calc error:', e.message);
    }

    // ─── 3. P/E Based Fair Value ─────────────────────────────────
    try {
        const eps = quote.epsTrailingTwelveMonths;
        const forwardEps = quote.epsForward;
        if (eps && eps > 0) {
            // Use sector average P/E of ~20 or a growth-adjusted PEG of 1
            const earningsGrowth = fd.earningsGrowth || fd.revenueGrowth || 0.1;
            const fairPE = Math.max(10, Math.min(30, earningsGrowth * 100)); // PEG = 1 approach
            const peBasedValue = eps * fairPE;

            results.methods.peMultiple = {
                label: 'P/E Multiple (PEG = 1)',
                value: peBasedValue,
                assumptions: {
                    eps,
                    fairPE: fairPE.toFixed(1),
                    earningsGrowth: (earningsGrowth * 100).toFixed(1) + '%',
                },
            };
        }

        // Forward P/E based
        if (forwardEps && forwardEps > 0) {
            const sectorPE = 18; // conservative market average
            const forwardFairValue = forwardEps * sectorPE;
            results.methods.forwardPE = {
                label: 'Forward Earnings Value',
                value: forwardFairValue,
                assumptions: {
                    forwardEps,
                    appliedPE: sectorPE,
                },
            };
        }
    } catch (e) {
        console.error('PE calc error:', e.message);
    }

    // ─── 4. EV/EBITDA Based ──────────────────────────────────────
    try {
        const ev = ks.enterpriseValue;
        const ebitda = fd.ebitda;
        if (ev && ebitda && ebitda > 0) {
            const currentEvEbitda = ev / ebitda;
            const fairEvEbitda = 12; // market average
            const sharesOutstanding = ks.sharesOutstanding || quote.sharesOutstanding;
            const totalDebt = fd.totalDebt || 0;
            const totalCash = fd.totalCash || 0;

            if (sharesOutstanding) {
                const fairEV = ebitda * fairEvEbitda;
                const fairEquity = fairEV - totalDebt + totalCash;
                const fairPrice = fairEquity / sharesOutstanding;

                results.methods.evEbitda = {
                    label: 'EV/EBITDA Multiple',
                    value: Math.max(0, fairPrice),
                    assumptions: {
                        currentEvEbitda: currentEvEbitda.toFixed(1),
                        fairEvEbitda,
                        ebitda,
                        enterpriseValue: ev,
                    },
                };
            }
        }
    } catch (e) {
        console.error('EV/EBITDA calc error:', e.message);
    }

    // ─── Calculate composite fair value range ────────────────────
    const methodValues = Object.values(results.methods)
        .map(m => m.value)
        .filter(v => v > 0 && isFinite(v));

    if (methodValues.length > 0) {
        const sorted = [...methodValues].sort((a, b) => a - b);
        const avg = methodValues.reduce((a, b) => a + b, 0) / methodValues.length;
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        results.fairValueRange = {
            low: sorted[0],
            mid: median,
            high: sorted[sorted.length - 1],
            average: avg,
            methodCount: methodValues.length,
        };

        // Margin of safety (using median as base)
        const marginOfSafety = ((median - quote.regularMarketPrice) / median) * 100;
        results.marginOfSafety = marginOfSafety;

        // Verdict
        if (marginOfSafety > 30) {
            results.verdict = { label: 'Significantly Undervalued', color: '#00e676', icon: '🟢' };
        } else if (marginOfSafety > 10) {
            results.verdict = { label: 'Undervalued', color: '#66bb6a', icon: '🟢' };
        } else if (marginOfSafety > -10) {
            results.verdict = { label: 'Fairly Valued', color: '#ffa726', icon: '🟡' };
        } else if (marginOfSafety > -30) {
            results.verdict = { label: 'Overvalued', color: '#ef5350', icon: '🔴' };
        } else {
            results.verdict = { label: 'Significantly Overvalued', color: '#d32f2f', icon: '🔴' };
        }
    }

    return results;
}
