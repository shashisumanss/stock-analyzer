import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { calculateFairValue } from './valuation.js';
import yahooFinance from 'yahoo-finance2';
import NodeCache from 'node-cache';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// General cache configuration
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // 1 min default TTL

app.use(cors());
app.use(express.json());

// Helper for generating consistent responses that mirror the old Python output
function handleAsync(fn) {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    };
}

// ─── Quote ───────────────────────────────────────────────────
app.get('/api/quote/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `quote_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const quoteRaw = await yahooFinance.quote(ticker);

    const quote = {
        symbol: quoteRaw.symbol,
        shortName: quoteRaw.shortName || '',
        longName: quoteRaw.longName || quoteRaw.shortName || '',
        price: quoteRaw.regularMarketPrice,
        previousClose: quoteRaw.regularMarketPreviousClose,
        change: quoteRaw.regularMarketChange,
        changePercent: quoteRaw.regularMarketChangePercent,
        open: quoteRaw.regularMarketOpen,
        dayHigh: quoteRaw.regularMarketDayHigh,
        dayLow: quoteRaw.regularMarketDayLow,
        volume: quoteRaw.regularMarketVolume,
        avgVolume: quoteRaw.averageDailyVolume3Month,
        marketCap: quoteRaw.marketCap,
        fiftyTwoWeekHigh: quoteRaw.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quoteRaw.fiftyTwoWeekLow,
        trailingPE: quoteRaw.trailingPE,
        forwardPE: quoteRaw.forwardPE,
        eps: quoteRaw.epsTrailingTwelveMonths,
        forwardEps: quoteRaw.epsForward,
        dividendYield: quoteRaw.trailingAnnualDividendYield,
        dividendRate: quoteRaw.trailingAnnualDividendRate,
        exchange: quoteRaw.exchange || '',
        currency: quoteRaw.currency || 'USD'
    };

    cache.set(cacheKey, quote, 60); // 1 minute
    res.json(quote);
}));

// ─── Financials ──────────────────────────────────────────────
app.get('/api/financials/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `financials_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    // 'financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory', 'cashflowStatementHistory', 'balanceSheetHistory'
    const modules = ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory', 'incomeStatementHistoryQuarterly', 'cashflowStatementHistory', 'balanceSheetHistory'];
    const data = await yahooFinance.quoteSummary(ticker, { modules });

    // Fallback logic mapping Yahoo Finance Node JS object structure back to Python expectation structure
    const financialData = data.financialData || {};
    const defaultKeyStatistics = data.defaultKeyStatistics || {};
    const summaryDetail = data.summaryDetail || {};

    const mapped = {
        financialData: {
            totalRevenue: financialData.totalRevenue,
            revenueGrowth: financialData.revenueGrowth,
            grossProfits: financialData.grossMargins, // Fallback mapping
            profitMargins: financialData.profitMargins,
            operatingMargins: financialData.operatingMargins,
            grossMargins: financialData.grossMargins,
            ebitda: financialData.ebitda,
            ebitdaMargins: financialData.ebitdaMargins,
            freeCashflow: financialData.freeCashflow,
            operatingCashflow: financialData.operatingCashflow,
            earningsGrowth: financialData.earningsGrowth,
            totalCash: financialData.totalCash,
            totalCashPerShare: financialData.totalCashPerShare,
            totalDebt: financialData.totalDebt,
            debtToEquity: financialData.debtToEquity,
            currentRatio: financialData.currentRatio,
            quickRatio: financialData.quickRatio,
            returnOnEquity: financialData.returnOnEquity,
            returnOnAssets: financialData.returnOnAssets,
            revenuePerShare: financialData.revenuePerShare
        },
        defaultKeyStatistics: {
            enterpriseValue: defaultKeyStatistics.enterpriseValue,
            enterpriseToRevenue: defaultKeyStatistics.enterpriseToRevenue,
            enterpriseToEbitda: defaultKeyStatistics.enterpriseToEbitda,
            pegRatio: defaultKeyStatistics.pegRatio,
            priceToSalesTrailing12Months: defaultKeyStatistics.priceToSalesTrailing12Months,
            sharesOutstanding: defaultKeyStatistics.sharesOutstanding
        },
        summaryDetail: {
            trailingPE: summaryDetail.trailingPE,
            forwardPE: summaryDetail.forwardPE,
            priceToBook: summaryDetail.priceToBook,
            dividendYield: summaryDetail.dividendYield,
            payoutRatio: summaryDetail.payoutRatio
        },
        incomeStatement: (data.incomeStatementHistory?.incomeStatementHistory || []).map(inc => ({
            endDate: inc.endDate?.toISOString() || inc.endDate,
            totalRevenue: inc.totalRevenue,
            grossProfit: inc.grossProfit,
            operatingIncome: inc.operatingIncome,
            netIncome: inc.netIncomeFromContinuingOps, // Closest match
            ebitda: inc.ebit, // Closest proxy if ebitda missing
            totalExpenses: inc.totalOperatingExpenses,
            costOfRevenue: inc.costOfRevenue,
            sga: inc.sellingGeneralAdministrative,
            rnd: inc.researchDevelopment
        })),
        quarterlyIncome: (data.incomeStatementHistoryQuarterly?.incomeStatementHistory || []).map(inc => ({
            endDate: inc.endDate?.toISOString() || inc.endDate,
            totalRevenue: inc.totalRevenue,
            grossProfit: inc.grossProfit,
            operatingIncome: inc.operatingIncome,
            netIncome: inc.netIncomeFromContinuingOps
        })),
        cashflowStatement: (data.cashflowStatementHistory?.cashflowStatements || []).map(cf => ({
            endDate: cf.endDate?.toISOString() || cf.endDate,
            operatingCashFlow: cf.totalCashFromOperatingActivities,
            freeCashFlow: cf.totalCashFromOperatingActivities + (cf.capitalExpenditures || 0), // Rough calc
            capitalExpenditure: cf.capitalExpenditures,
            endCashPosition: cf.changeInCash, // Approximation
            issuanceOfDebt: cf.issuanceOfDebt,
            shareRepurchase: cf.repurchaseOfStock,
            dividendsPaid: cf.dividendsPaid
        })),
        balanceSheet: (data.balanceSheetHistory?.balanceSheetStatements || []).map(bs => ({
            endDate: bs.endDate?.toISOString() || bs.endDate,
            totalAssets: bs.totalAssets,
            totalLiabilities: bs.totalLiab,
            totalEquity: bs.totalStockholderEquity,
            totalDebt: (bs.shortLongTermDebt || 0) + (bs.longTermDebt || 0),
            cashAndEquivalents: bs.cash,
            cashAndShortTermInvestments: (bs.cash || 0) + (bs.shortTermInvestments || 0),
            currentAssets: bs.totalCurrentAssets,
            currentLiabilities: bs.totalCurrentLiabilities,
            longTermDebt: bs.longTermDebt,
            commonEquity: bs.totalStockholderEquity
        }))
    };

    cache.set(cacheKey, mapped, 3600); // 1 hour
    res.json(mapped);
}));

// ─── Fair Value ──────────────────────────────────────────────
app.get('/api/fair-value/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `fairvalue_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const modules = ['financialData', 'defaultKeyStatistics'];
    const [quoteRaw, data] = await Promise.all([
        yahooFinance.quote(ticker),
        yahooFinance.quoteSummary(ticker, { modules })
    ]);

    const fd = data.financialData || {};
    const ks = data.defaultKeyStatistics || {};

    const quote = {
        symbol: quoteRaw.symbol,
        regularMarketPrice: quoteRaw.regularMarketPrice,
        epsTrailingTwelveMonths: quoteRaw.epsTrailingTwelveMonths,
        epsForward: quoteRaw.epsForward,
        bookValue: quoteRaw.bookValue,
        sharesOutstanding: quoteRaw.sharesOutstanding,
        marketCap: quoteRaw.marketCap
    };

    const financials = {
        financialData: {
            freeCashflow: fd.freeCashflow,
            revenueGrowth: fd.revenueGrowth,
            earningsGrowth: fd.earningsGrowth,
            totalCash: fd.totalCash,
            totalDebt: fd.totalDebt,
            ebitda: fd.ebitda,
            profitMargins: fd.profitMargins
        },
        defaultKeyStatistics: {
            enterpriseValue: ks.enterpriseValue,
            sharesOutstanding: ks.sharesOutstanding
        }
    };

    const result = calculateFairValue(quote, financials, null);
    cache.set(cacheKey, result, 3600); // 1 hour
    res.json(result);
}));

// ─── Price History ───────────────────────────────────────────
app.get('/api/history/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    let { range = '1y', interval = '1d' } = req.query;

    // Format yf2 compatible dates. Map '1y' -> period1 (Date - 1 yr), period2 (now)
    const end = new Date();
    const start = new Date();

    if (range === '1mo') start.setMonth(start.getMonth() - 1);
    else if (range === '3mo') start.setMonth(start.getMonth() - 3);
    else if (range === '6mo') start.setMonth(start.getMonth() - 6);
    else if (range === '1y') start.setFullYear(start.getFullYear() - 1);
    else if (range === '2y') start.setFullYear(start.getFullYear() - 2);
    else if (range === '5y') start.setFullYear(start.getFullYear() - 5);
    else if (range === 'max') start.setFullYear(start.getFullYear() - 20); // Fallback to 20 YRS
    else start.setFullYear(start.getFullYear() - 1);

    const cacheKey = `history_${ticker}_${range}_${interval}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const options = { period1: start, period2: end, interval: interval === '1mo' ? '1mo' : interval === '1wk' ? '1wk' : '1d' };
    const historyData = await yahooFinance.historical(ticker, options);

    const mapped = historyData.map(row => ({
        time: row.date.toISOString().split('T')[0],
        open: typeof row.open === 'number' ? Number(row.open.toFixed(2)) : null,
        high: typeof row.high === 'number' ? Number(row.high.toFixed(2)) : null,
        low: typeof row.low === 'number' ? Number(row.low.toFixed(2)) : null,
        close: typeof row.close === 'number' ? Number(row.close.toFixed(2)) : null,
        volume: row.volume || 0
    }));

    cache.set(cacheKey, mapped, 3600); // 1 hour cache
    res.json(mapped);
}));

// ─── Analyst Ratings & Forecasts ─────────────────────────────
app.get('/api/analyst/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `analyst_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const modules = ['financialData', 'recommendationTrend', 'earningsHistory', 'earningsTrend'];
    const data = await yahooFinance.quoteSummary(ticker, { modules });
    const fd = data.financialData || {};

    const result = {
        recommendationKey: fd.recommendationKey || '',
        recommendationMean: fd.recommendationMean,
        targetHighPrice: fd.targetHighPrice,
        targetLowPrice: fd.targetLowPrice,
        targetMeanPrice: fd.targetMeanPrice,
        targetMedianPrice: fd.targetMedianPrice,
        numberOfAnalystOpinions: fd.numberOfAnalystOpinions,
        recommendations: (data.recommendationTrend?.trend || []).map(r => ({
            period: r.period,
            strongBuy: r.strongBuy || 0,
            buy: r.buy || 0,
            hold: r.hold || 0,
            sell: r.sell || 0,
            strongSell: r.strongSell || 0
        })),
        epsHistory: [],
        revenueHistory: []
    };

    const earningsHistory = data.earningsHistory?.history || [];
    earningsHistory.forEach(h => {
        if (h.quarter) {
            const yearStr = (h.quarter.toISOString ? h.quarter.toISOString().split('-')[0] : String(h.quarter));
            if (h.epsActual) result.epsHistory.push({ year: yearStr, value: h.epsActual, type: 'actual' });
        }
    });

    if (data.earningsTrend?.trend) {
        data.earningsTrend.trend.forEach(t => {
            if (t.period && t.period.includes('+1y') && t.earningsEstimate?.avg) {
                result.epsHistory.push({ year: 'Forward', value: t.earningsEstimate.avg, type: 'estimate' });
            }
        });
    }

    cache.set(cacheKey, result, 86400); // 24 hours
    res.json(result);
}));

// ─── Peer Comparison ─────────────────────────────────────────
app.get('/api/peers/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `peers_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const data = await yahooFinance.quoteSummary(ticker, { modules: ['assetProfile'] });
    const sector = data.assetProfile?.sector || '';
    const industry = data.assetProfile?.industry || '';

    // Map of well-known sector peers
    const SECTOR_PEERS = {
        "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMZN", "CRM", "ADBE", "ORCL", "INTC"],
        "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC", "C", "BLK", "SCHW", "AXP", "USB"],
        "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY", "BMY", "AMGN"],
        "Consumer Cyclical": ["AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "TJX", "BKNG"],
        "Communication Services": ["GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS", "CHTR", "SPOT"],
        "Consumer Defensive": ["PG", "KO", "PEP", "WMT", "COST", "CL", "MDLZ", "PM", "MO", "GIS"],
        "Energy": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "PXD"],
        "Industrials": ["UNP", "HON", "UPS", "BA", "CAT", "DE", "GE", "MMM", "LMT", "RTX"],
        "Basic Materials": ["LIN", "APD", "SHW", "ECL", "DD", "NEM", "FCX", "NUE", "VMC", "MLM"],
        "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "SPG", "PSA", "O", "WELL", "DLR", "AVB"],
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "ED", "WEC"]
    };

    let peerSymbols = SECTOR_PEERS[sector] || [];
    peerSymbols = peerSymbols.filter(s => s !== ticker).slice(0, 5);

    if (peerSymbols.length === 0) {
        return res.json({ sector, industry, peers: [] });
    }

    const peers = [];
    for (const sym of peerSymbols) {
        try {
            const [pQuote, pSumry] = await Promise.all([
                yahooFinance.quote(sym),
                yahooFinance.quoteSummary(sym, { modules: ['financialData'] })
            ]);

            const pf = pSumry.financialData || {};

            peers.push({
                symbol: pQuote.symbol,
                name: pQuote.shortName || sym,
                price: pQuote.regularMarketPrice,
                marketCap: pQuote.marketCap,
                trailingPE: pQuote.trailingPE,
                forwardPE: pQuote.forwardPE,
                priceToBook: pQuote.priceToBook,
                dividendYield: pQuote.trailingAnnualDividendYield,
                revenueGrowth: pf.revenueGrowth,
                profitMargins: pf.profitMargins,
                returnOnEquity: pf.returnOnEquity,
                beta: pf.beta
            });
        } catch (e) {
            // ignore failure for a single peer
        }
    }

    const result = { sector, industry, peers };
    cache.set(cacheKey, result, 86400); // 24 hours
    res.json(result);
}));

// ─── AI Analysis (Rule-Based + Optional Gemini) ─────────────
app.get('/api/ai-analysis/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `ai_analysis_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const [quoteRaw, data] = await Promise.all([
        yahooFinance.quote(ticker).catch(() => ({})),
        yahooFinance.quoteSummary(ticker, { modules: ['financialData'] }).catch(() => ({}))
    ]);

    const quote = {
        symbol: quoteRaw.symbol || ticker,
        shortName: quoteRaw.shortName || '',
        longName: quoteRaw.longName || quoteRaw.shortName || '',
        price: quoteRaw.regularMarketPrice,
        previousClose: quoteRaw.regularMarketPreviousClose,
        change: quoteRaw.regularMarketChange,
        changePercent: quoteRaw.regularMarketChangePercent,
        marketCap: quoteRaw.marketCap,
        trailingPE: quoteRaw.trailingPE,
        forwardPE: quoteRaw.forwardPE,
        dividendRate: quoteRaw.trailingAnnualDividendRate,
        beta: quoteRaw.beta
    };

    const fd = data.financialData || {};

    // Always generate rule-based analysis
    const analysis = generateAnalysis(quote, fd);

    // Optionally enhance with Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_api_key_here') {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' });
            const prompt = `Stock: ${quote.symbol} ($${quote.price}), P/E: ${quote.trailingPE?.toFixed(1) || 'N/A'}, Margins: ${fd.profitMargins ? (fd.profitMargins * 100).toFixed(1) + '%' : 'N/A'}, Growth: ${fd.revenueGrowth ? (fd.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}. Give a 2-sentence investment thesis. JSON only: {"summary":"..."}`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
            if (parsed.summary) analysis.summary = parsed.summary;
        } catch { /* use rule-based summary */ }
    }

    const result = { available: true, analysis };
    cache.set(cacheKey, result, 3600); // 1 hour 
    res.json(result);
}));

// ─── Deep Research (Rule-based + optional Gemini) ────────────
function fmtB(n) { if (n == null || isNaN(n)) return 'N/A'; if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`; if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`; if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`; return `$${n.toLocaleString()}`; }
function fmtPct(n) { if (n == null || isNaN(n)) return 'N/A'; return `${(n * 100).toFixed(1)}%`; }
function fin(v) { return typeof v === 'number' && Number.isFinite(v); }

function generateDeepResearch(quote, fd, incomeAnnual, balanceSheet, cashflow, peersData) {
    const name = quote.longName || quote.shortName || quote.symbol;
    const price = quote.price || 0;
    const mcap = quote.marketCap || 0;
    const sector = quote.sector || 'Unknown';
    const industry = quote.industry || 'Unknown';
    const peers = peersData?.peers || [];

    let totalScore = 0, scoreCount = 0;
    const addScore = (s) => { totalScore += s; scoreCount++; };

    // Profitability
    const gm = fin(fd.grossMargins) ? fd.grossMargins : null;
    const om = fin(fd.operatingMargins) ? fd.operatingMargins : null;
    const nm = fin(fd.profitMargins) ? fd.profitMargins : null;
    const revGrowth = fin(fd.revenueGrowth) ? fd.revenueGrowth : null;
    const roe = fin(fd.returnOnEquity) ? fd.returnOnEquity : null;

    function analyzeMargin(val, label, highT, midT) {
        if (val == null) return { current: 'N/A', fiveYearTrend: 'Stable', analysis: `${label} data not available.` };
        const pct = (val * 100).toFixed(1) + '%';
        const trend = val > highT ? 'Expanding' : val > midT ? 'Stable' : 'Contracting';
        let analysis;
        if (val > highT) { analysis = `${label} of ${pct} indicates strong pricing power and operational efficiency.`; addScore(8); }
        else if (val > midT) { analysis = `${label} of ${pct} is in line with industry standards.`; addScore(6); }
        else { analysis = `${label} of ${pct} suggests competitive pressures or high cost structure.`; addScore(4); }
        return { current: pct, fiveYearTrend: trend, analysis };
    }

    const profitability = {
        grossMargin: analyzeMargin(gm, 'Gross margin', 0.5, 0.3),
        operatingMargin: analyzeMargin(om, 'Operating margin', 0.25, 0.12),
        netMargin: analyzeMargin(nm, 'Net margin', 0.2, 0.08),
    };

    // Balance Sheet
    const de = fin(fd.debtToEquity) ? fd.debtToEquity : null;
    const cr = fin(fd.currentRatio) ? fd.currentRatio : null;
    const totalDebt = fin(fd.totalDebt) ? fd.totalDebt : 0;
    const totalCash = fin(fd.totalCash) ? fd.totalCash : 0;
    const netDebt = totalDebt - totalCash;

    let bsGrade = 'B', bsA = [];
    if (de != null) {
        if (de < 30) { bsGrade = 'A+'; addScore(9); bsA.push(`Conservative leverage with D/E of ${de.toFixed(1)}%.`); }
        else if (de < 80) { bsGrade = 'A'; addScore(7); bsA.push(`Moderate leverage with D/E of ${de.toFixed(1)}%.`); }
        else if (de < 150) { bsGrade = 'B+'; addScore(5); bsA.push(`Elevated leverage with D/E of ${de.toFixed(1)}%, manageable but bears monitoring.`); }
        else { bsGrade = 'C'; addScore(3); bsA.push(`High leverage with D/E of ${de.toFixed(1)}% — significant balance sheet risk.`); }
    }
    if (cr != null) { bsA.push(cr > 2 ? `Strong liquidity with current ratio of ${cr.toFixed(2)}.` : cr > 1 ? `Adequate liquidity with current ratio of ${cr.toFixed(2)}.` : `Tight liquidity with current ratio of ${cr.toFixed(2)}.`); }
    if (netDebt < 0) bsA.push(`Net cash position of ${fmtB(Math.abs(netDebt))} provides financial flexibility.`);
    else if (netDebt > 0) bsA.push(`Net debt of ${fmtB(netDebt)} requires ongoing debt service.`);

    const balanceSheetHealth = { debtToEquity: de != null ? de.toFixed(1) + '%' : 'N/A', currentRatio: cr != null ? cr.toFixed(2) : 'N/A', cashPosition: fmtB(totalCash), totalDebt: fmtB(totalDebt), netDebtPosition: netDebt < 0 ? `Net Cash: ${fmtB(Math.abs(netDebt))}` : `Net Debt: ${fmtB(netDebt)}`, assessment: bsA.join(' ') || 'Insufficient data.', grade: bsGrade };

    // FCF
    const fcf = fin(fd.freeCashflow) ? fd.freeCashflow : null;
    const fcfYield = fcf && mcap ? fcf / mcap : null;
    let fcfGrowthDesc = 'N/A';
    if (cashflow.length >= 2 && cashflow[0].freeCashflow && cashflow[1].freeCashflow) {
        fcfGrowthDesc = fmtPct((cashflow[0].freeCashflow - cashflow[1].freeCashflow) / Math.abs(cashflow[1].freeCashflow));
    }
    if (fcfYield != null) { addScore(fcfYield > 0.05 ? 8 : fcfYield > 0.02 ? 6 : 4); }

    let capParts = [];
    if (quote.dividendRate > 0) capParts.push(`pays a dividend of $${quote.dividendRate.toFixed(2)}/share`);
    if (fcf > 0) capParts.push('generates positive free cash flow supporting capital returns');
    if (mcap > 100e9) capParts.push('likely engages in significant share buyback programs');
    capParts.push('reinvests in R&D and strategic growth initiatives');

    const freeCashFlow = { fcf: fmtB(fcf), fcfYield: fcfYield != null ? fmtPct(fcfYield) : 'N/A', fcfGrowth: fcfGrowthDesc, capitalAllocation: `The company ${capParts.join(', ')}.` };

    // Competitive Advantages
    const ppScore = gm != null ? (gm > 0.6 ? 9 : gm > 0.4 ? 7 : gm > 0.25 ? 5 : 3) : 5;
    const brandScore = mcap > 500e9 ? 9 : mcap > 100e9 ? 7 : mcap > 10e9 ? 5 : 3;
    const highSw = ['Technology', 'Financial Services', 'Healthcare'];
    const switchScore = highSw.includes(sector) ? 7 : 4;
    const netSectors = ['Communication Services', 'Technology', 'Financial Services'];
    const netEffScore = netSectors.includes(sector) ? 6 : 3;
    const costScore = om != null ? (om > 0.3 ? 8 : om > 0.15 ? 6 : 4) : 5;

    const factors = [
        { name: 'Pricing Power', score: ppScore, explanation: gm != null ? `Gross margin of ${fmtPct(gm)} ${ppScore >= 7 ? 'indicates strong pricing power' : 'suggests limited pricing power'}.` : 'Insufficient data.' },
        { name: 'Brand Strength', score: brandScore, explanation: `${fmtB(mcap)} market cap ${brandScore >= 7 ? 'reflects strong brand recognition' : 'suggests developing brand presence'}.` },
        { name: 'Switching Costs', score: switchScore, explanation: `${sector} sector ${switchScore >= 6 ? 'typically benefits from high' : 'generally has moderate'} switching costs.` },
        { name: 'Network Effects', score: netEffScore, explanation: netSectors.includes(sector) ? 'Operates where network effects can drive value.' : 'Limited network effect advantages in this sector.' },
        { name: 'Cost Advantages', score: costScore, explanation: om != null ? `Operating margin of ${fmtPct(om)} ${costScore >= 6 ? 'demonstrates cost efficiency' : 'indicates room for improvement'}.` : 'Insufficient data.' },
    ];
    const moatScore = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
    addScore(moatScore);

    // Management Quality
    let mgmtScore = 5, mgmtStr = [], mgmtCon = [];
    if (roe != null) { if (roe > 0.25) { mgmtScore += 2; mgmtStr.push(`Exceptional ROE of ${fmtPct(roe)}`); } else if (roe > 0.15) { mgmtScore += 1; mgmtStr.push(`Solid ROE of ${fmtPct(roe)}`); } else if (roe < 0.05) { mgmtScore -= 1; mgmtCon.push(`Low ROE of ${fmtPct(roe)}`); } }
    if (revGrowth != null && revGrowth > 0.1) { mgmtScore++; mgmtStr.push(`Revenue growth of ${fmtPct(revGrowth)}`); }
    if (de != null && de < 50) mgmtStr.push('Conservative balance sheet'); else if (de != null && de > 200) mgmtCon.push('Aggressive leverage');
    if (quote.dividendRate > 0) mgmtStr.push('Commitment to dividends');
    mgmtScore = Math.max(1, Math.min(10, mgmtScore));
    addScore(mgmtScore);

    const managementQuality = { capitalAllocationScore: String(mgmtScore), assessment: `Management ${mgmtScore >= 7 ? 'demonstrates strong' : mgmtScore >= 5 ? 'shows adequate' : 'needs to improve'} capital allocation. ${roe != null ? `ROE of ${fmtPct(roe)} ${roe > 0.15 ? 'exceeds' : 'falls below'} the 15% benchmark.` : ''} ${mcap > 100e9 ? 'Large-cap status suggests institutional-quality governance.' : 'Company size warrants governance monitoring.'}`, keyStrengths: mgmtStr.length > 0 ? mgmtStr.slice(0, 3) : ['Insufficient data'], concerns: mgmtCon.length > 0 ? mgmtCon.slice(0, 2) : ['No major concerns identified'] };

    // Valuation
    const pe = fin(quote.trailingPE) ? quote.trailingPE : null;
    const ps = fin(quote.priceToSalesTrailing12Months) ? quote.priceToSalesTrailing12Months : null;
    const evEbitda = fin(quote.enterpriseToEbitda) ? quote.enterpriseToEbitda : null;
    const peerPEs = peers.filter(p => fin(p.trailingPE)).map(p => p.trailingPE);
    const avgPeerPE = peerPEs.length > 0 ? peerPEs.reduce((a, b) => a + b, 0) / peerPEs.length : null;

    function vm(n, cur, secAvg, typAvg) {
        const c = cur != null ? cur.toFixed(1) + 'x' : 'N/A';
        const s = secAvg != null ? secAvg.toFixed(1) + 'x' : 'N/A';
        const a = typAvg != null ? typAvg.toFixed(1) + 'x' : 'N/A';
        let v = 'Fair';
        if (cur != null && typAvg != null) { if (cur < typAvg * 0.8) v = 'Cheap'; else if (cur > typAvg * 1.2) v = 'Expensive'; }
        return { name: n, current: c, fiveYearAvg: a, sectorAvg: s, verdict: v };
    }

    const valMetrics = [vm('P/E', pe, avgPeerPE, pe ? pe * 0.9 : 20), vm('P/S', ps, null, ps ? ps * 0.85 : 3), vm('EV/EBITDA', evEbitda, null, evEbitda ? evEbitda * 0.9 : 15)];
    const cheapCnt = valMetrics.filter(m => m.verdict === 'Cheap').length;
    const expCnt = valMetrics.filter(m => m.verdict === 'Expensive').length;
    let valA; if (cheapCnt >= 2) { valA = `${name} appears undervalued across multiple metrics.`; addScore(8); } else if (expCnt >= 2) { valA = `${name} trades at a premium to historical averages.`; addScore(4); } else { valA = `${name} is trading near fair value.`; addScore(6); }

    // Business Model
    const overview = `${name} operates in the ${industry} space within the ${sector} sector, generating approximately ${fmtB(fd.totalRevenue)} in annual revenue${quote.fullTimeEmployees ? ` with ~${quote.fullTimeEmployees.toLocaleString()} employees` : ''}.\n\n${gm != null && gm > 0.5 ? 'The business model benefits from high gross margins, suggesting a differentiated product or service with significant value-add.' : gm != null ? 'The company operates a competitive business requiring ongoing investment to maintain position.' : ''} ${om != null && om > 0.2 ? 'Strong operating leverage converts a meaningful portion of revenue into operating profit.' : ''}\n\n${revGrowth != null ? (revGrowth > 0.1 ? `Revenue growing at ${fmtPct(revGrowth)} indicates the company is in a growth phase, benefiting from secular tailwinds.` : revGrowth > 0 ? `Revenue growth of ${fmtPct(revGrowth)} indicates a mature business with steady demand.` : `Revenue contraction of ${fmtPct(revGrowth)} signals potential headwinds.`) : ''}`;

    const keyInsight = mcap > 500e9 ? `${name}'s massive ${fmtB(mcap)} market cap creates scale advantages but sets a high bar for future growth.` : revGrowth != null && revGrowth > 0.15 ? `${fmtPct(revGrowth)} revenue growth with ${gm != null ? fmtPct(gm) + ' margins' : 'solid profitability'} signals a growth-with-profitability sweet spot.` : `${name} presents ${moatScore >= 7 ? 'a durable competitive position' : 'a business requiring continued execution'} with ${bsGrade <= 'B' ? 'solid' : 'manageable'} fundamentals.`;

    const revenueStreams = [
        { segment: 'Core Operations', contribution: '~70-80%', growth: revGrowth != null ? fmtPct(revGrowth) : 'N/A', outlook: `Primary revenue driver in ${industry}.` },
        { segment: 'Secondary Lines', contribution: '~15-20%', growth: 'Varies', outlook: 'Supporting streams providing diversification.' },
        { segment: 'Other/Emerging', contribution: '~5-10%', growth: 'High potential', outlook: 'Emerging streams that could expand addressable market.' },
    ];

    // Rating & Target
    const avgScore = scoreCount > 0 ? totalScore / scoreCount : 5;
    let rating, conviction, riskLevel;
    if (avgScore >= 8) { rating = 'Strong Buy'; conviction = 'High'; }
    else if (avgScore >= 6.5) { rating = 'Buy'; conviction = 'Medium'; }
    else if (avgScore >= 5) { rating = 'Hold'; conviction = 'Medium'; }
    else if (avgScore >= 3.5) { rating = 'Sell'; conviction = 'Medium'; }
    else { rating = 'Strong Sell'; conviction = 'High'; }
    riskLevel = (quote.beta || 1) > 1.5 ? 'High' : (quote.beta || 1) > 1 ? 'Moderate' : 'Low';
    if (de != null && de > 150) riskLevel = 'High';

    const targetPrice = Math.round(price * (revGrowth != null ? 1 + revGrowth * 0.6 : 1) * (avgScore / 6));
    const upside = price > 0 ? ((targetPrice - price) / price * 100) : 0;

    const ratingBox = { rating, targetPrice, currentPrice: Math.round(price * 100) / 100, upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`, conviction, riskLevel, timeHorizon: '12 months' };

    // Bull & Bear
    const bullCats = [], bearRisks = [];
    if (revGrowth != null && revGrowth > 0.05) bullCats.push(`Revenue growth of ${fmtPct(revGrowth)} demonstrates organic expansion`);
    if (gm != null && gm > 0.5) bullCats.push(`Industry-leading margins of ${fmtPct(gm)} provide pricing power`);
    if (fcf > 0) bullCats.push(`Strong FCF of ${fmtB(fcf)} enables sustained capital returns`);
    if (moatScore >= 7) bullCats.push(`Wide competitive moat (${moatScore}/10) protects market position`);
    if (bullCats.length < 3) bullCats.push('Potential for margin expansion through operational efficiency');

    if (pe != null && pe > 35) bearRisks.push(`Elevated P/E of ${pe.toFixed(1)}x limits margin of safety`);
    if (de != null && de > 100) bearRisks.push(`High D/E of ${de.toFixed(1)}% increases financial risk`);
    if (revGrowth != null && revGrowth < 0) bearRisks.push(`Revenue decline of ${fmtPct(revGrowth)} indicates deteriorating position`);
    if ((quote.beta || 1) > 1.3) bearRisks.push(`Elevated beta of ${(quote.beta || 1).toFixed(2)} amplifies downside`);
    if (bearRisks.length < 3) bearRisks.push('Macro headwinds or industry disruption could pressure fundamentals');

    const bullTarget = Math.round(price * 1.25 * (avgScore / 6));
    const bearTarget = Math.round(price * 0.8 * (Math.min(avgScore, 7) / 7));

    const verdict = `Our analysis rates ${name} (${quote.symbol}) as "${rating}" with ${conviction.toLowerCase()} conviction and a 12-month target of $${targetPrice} (${ratingBox.upside} ${upside >= 0 ? 'upside' : 'downside'}). ${avgScore >= 6.5 ? `The company demonstrates ${avgScore >= 8 ? 'exceptional' : 'solid'} fundamentals across profitability, balance sheet health, and competitive positioning.` : 'A balanced risk-reward profile limits conviction.'} ${gm != null && gm > 0.4 ? `High margins of ${fmtPct(gm)} provide downside protection. ` : ''}${roe != null && roe > 0.15 ? `ROE of ${fmtPct(roe)} demonstrates effective capital stewardship. ` : ''}${fcf > 0 ? `Free cash flow of ${fmtB(fcf)} supports sustained capital returns. ` : ''}We recommend investors ${rating.includes('Buy') ? 'consider building positions' : rating === 'Hold' ? 'maintain existing positions' : 'exercise caution'} given the ${riskLevel.toLowerCase()} risk profile.`;

    return {
        ratingBox,
        businessModel: { overview, keyInsight },
        revenueStreams,
        profitability,
        balanceSheetHealth,
        freeCashFlow,
        competitiveAdvantages: { moatRating: String(moatScore), factors },
        managementQuality,
        valuation: { metrics: valMetrics, overallAssessment: valA },
        bullCase: { targetPrice: bullTarget, thesis: `In our bull scenario, ${name} accelerates growth while maintaining margin discipline. ${revGrowth != null && revGrowth > 0 ? `Revenue continues at ${fmtPct(revGrowth)}+` : 'Revenue stabilizes'}, driving operating leverage. Multiple expansion follows as the market recognizes execution quality.`, catalysts: bullCats.slice(0, 3) },
        bearCase: { targetPrice: bearTarget, thesis: `In our bear scenario, ${name} faces headwinds from ${de != null && de > 100 ? 'leverage concerns and ' : ''}competitive pressures in ${sector}. Margin compression leads to earnings downgrades and multiple contraction.`, risks: bearRisks.slice(0, 3) },
        verdict,
    };
}

app.get('/api/deep-research/:ticker', handleAsync(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `deep_research_${ticker}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const modules = ['financialData', 'assetProfile', 'incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory'];
    const [quoteRaw, data] = await Promise.all([
        yahooFinance.quote(ticker).catch(() => ({})),
        yahooFinance.quoteSummary(ticker, { modules }).catch(() => ({}))
    ]);

    const quote = {
        symbol: quoteRaw.symbol || ticker,
        shortName: quoteRaw.shortName || '',
        longName: quoteRaw.longName || quoteRaw.shortName || '',
        price: quoteRaw.regularMarketPrice,
        marketCap: quoteRaw.marketCap,
        sector: data.assetProfile?.sector || '',
        industry: data.assetProfile?.industry || '',
        fullTimeEmployees: data.assetProfile?.fullTimeEmployees,
        dividendRate: quoteRaw.trailingAnnualDividendRate,
        beta: quoteRaw.beta,
        trailingPE: quoteRaw.trailingPE,
        forwardPE: quoteRaw.forwardPE,
        priceToSalesTrailing12Months: quoteRaw.priceToSalesTrailing12Months
    };

    const fd = data.financialData || {};

    // Convert old YF objects to what our generator understands
    const incomeAnnual = (data.incomeStatementHistory?.incomeStatementHistory || []).map(i => ({ netIncome: i.netIncomeFromContinuingOps }));
    const balanceSheet = (data.balanceSheetHistory?.balanceSheetStatements || []).map(b => ({ totalAssets: b.totalAssets }));
    const cashflow = (data.cashflowStatementHistory?.cashflowStatements || []).map(c => ({
        freeCashflow: (c.totalCashFromOperatingActivities || 0) + (c.capitalExpenditures || 0)
    }));

    // We don't have peer data natively without making 5 more sequential requests here, so we'll mock peers for the report
    const peersData = { peers: [] };

    let report = generateDeepResearch(quote, fd, incomeAnnual, balanceSheet, cashflow, peersData);

    // Optionally enhance with Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_api_key_here') {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' });
            const prompt = `Enhance this stock research report for ${quote.longName || ticker} with richer analysis. Base report: ${JSON.stringify(report)}. Return same JSON structure with improved prose for businessModel.overview, businessModel.keyInsight, verdict, bullCase.thesis, bearCase.thesis. Keep all numbers/scores. Return only valid JSON.`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const enh = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
            if (enh.businessModel?.overview) report.businessModel.overview = enh.businessModel.overview;
            if (enh.businessModel?.keyInsight) report.businessModel.keyInsight = enh.businessModel.keyInsight;
            if (enh.verdict) report.verdict = enh.verdict;
            if (enh.bullCase?.thesis) report.bullCase.thesis = enh.bullCase.thesis;
            if (enh.bearCase?.thesis) report.bearCase.thesis = enh.bearCase.thesis;
        } catch (e) { console.log('Gemini enhancement skipped:', e.message); }
    }

    const output = { available: true, report, generatedAt: new Date().toISOString() };
    cache.set(cacheKey, output, 3600); // 1 hour
    res.json(output);
}));


function generateAnalysis(quote, fd) {
    const bullCase = [];
    const bearCase = [];
    const risks = [];
    const catalysts = [];
    let scoreSum = 0;
    let scoreCount = 0;

    // Revenue growth
    if (fd.revenueGrowth != null) {
        if (fd.revenueGrowth > 0.15) { bullCase.push(`Strong revenue growth of ${(fd.revenueGrowth * 100).toFixed(1)}% year-over-year`); scoreSum += 9; }
        else if (fd.revenueGrowth > 0.05) { bullCase.push(`Solid revenue growth of ${(fd.revenueGrowth * 100).toFixed(1)}%`); scoreSum += 7; }
        else if (fd.revenueGrowth > 0) { scoreSum += 5; }
        else { bearCase.push(`Revenue declining at ${(fd.revenueGrowth * 100).toFixed(1)}%`); scoreSum += 3; }
        scoreCount++;
    }

    // Earnings growth
    if (fd.earningsGrowth != null) {
        if (fd.earningsGrowth > 0.15) { bullCase.push(`Earnings accelerating at ${(fd.earningsGrowth * 100).toFixed(1)}%`); scoreSum += 9; }
        else if (fd.earningsGrowth > 0) { scoreSum += 6; }
        else { bearCase.push(`Earnings declining at ${(fd.earningsGrowth * 100).toFixed(1)}%`); scoreSum += 3; }
        scoreCount++;
    }

    // Margins
    if (fd.profitMargins != null) {
        if (fd.profitMargins > 0.2) { bullCase.push(`High profit margins of ${(fd.profitMargins * 100).toFixed(1)}%, indicating pricing power`); scoreSum += 8; }
        else if (fd.profitMargins > 0.1) { scoreSum += 6; }
        else if (fd.profitMargins > 0) { scoreSum += 4; }
        else { bearCase.push(`Company operating at a loss with ${(fd.profitMargins * 100).toFixed(1)}% margins`); scoreSum += 2; }
        scoreCount++;
    }

    // ROE
    if (fd.returnOnEquity != null) {
        if (fd.returnOnEquity > 0.2) { bullCase.push(`Excellent return on equity of ${(fd.returnOnEquity * 100).toFixed(1)}%, demonstrating efficient capital allocation`); scoreSum += 9; }
        else if (fd.returnOnEquity > 0.1) { scoreSum += 6; }
        else { scoreSum += 3; }
        scoreCount++;
    }

    // Free cash flow
    if (fd.freeCashflow != null) {
        if (fd.freeCashflow > 5e9) { bullCase.push(`Massive free cash flow of $${(fd.freeCashflow / 1e9).toFixed(1)}B provides flexibility for buybacks, dividends, or acquisitions`); catalysts.push('Strong cash generation supports shareholder returns'); scoreSum += 9; }
        else if (fd.freeCashflow > 0) { scoreSum += 6; }
        else { bearCase.push('Negative free cash flow — burning cash'); risks.push('Cash burn may require dilutive financing'); scoreSum += 2; }
        scoreCount++;
    }

    // Debt
    if (fd.debtToEquity != null) {
        if (fd.debtToEquity > 150) { bearCase.push(`High leverage with debt-to-equity of ${fd.debtToEquity.toFixed(0)}`); risks.push('Elevated debt increases interest rate sensitivity and financial risk'); scoreSum += 3; }
        else if (fd.debtToEquity > 80) { risks.push('Moderate debt levels may limit financial flexibility'); scoreSum += 5; }
        else if (fd.debtToEquity < 30) { bullCase.push(`Conservative balance sheet with low debt (D/E: ${fd.debtToEquity.toFixed(0)})`); scoreSum += 8; }
        else { scoreSum += 6; }
        scoreCount++;
    }

    // Valuation
    if (quote.trailingPE != null) {
        if (quote.trailingPE > 40) { bearCase.push(`Premium valuation at ${quote.trailingPE.toFixed(1)}x P/E — priced for perfection`); risks.push('High valuation leaves little room for disappointment'); scoreSum += 3; }
        else if (quote.trailingPE > 25) { risks.push(`Above-average valuation at ${quote.trailingPE.toFixed(1)}x earnings`); scoreSum += 5; }
        else if (quote.trailingPE < 15) { bullCase.push(`Attractive valuation at just ${quote.trailingPE.toFixed(1)}x earnings`); catalysts.push('Potential for multiple expansion if growth accelerates'); scoreSum += 8; }
        else { scoreSum += 6; }
        scoreCount++;
    }

    // Dividend
    if (quote.dividendRate && quote.dividendRate > 0) {
        catalysts.push(`Dividend payment of $${quote.dividendRate.toFixed(2)}/share provides income support`);
    }

    // Market cap context
    if (quote.marketCap > 500e9) catalysts.push('Large-cap stability with institutional backing');
    else if (quote.marketCap < 2e9) risks.push('Small-cap volatility and liquidity risk');

    // Beta
    if (quote.beta > 1.5) risks.push(`High beta of ${quote.beta.toFixed(2)} means amplified market swings`);

    // Forward growth
    if (quote.forwardPE && quote.trailingPE && quote.forwardPE < quote.trailingPE * 0.85) {
        catalysts.push('Forward P/E suggests accelerating earnings growth ahead');
    }

    // Determine rating
    const avgScore = scoreCount > 0 ? scoreSum / scoreCount : 5;
    let rating, confidenceLevel;
    if (avgScore >= 8) { rating = 'Strong Buy'; confidenceLevel = 'High'; }
    else if (avgScore >= 6.5) { rating = 'Buy'; confidenceLevel = 'Medium'; }
    else if (avgScore >= 5) { rating = 'Hold'; confidenceLevel = 'Medium'; }
    else if (avgScore >= 3.5) { rating = 'Sell'; confidenceLevel = 'Medium'; }
    else { rating = 'Strong Sell'; confidenceLevel = 'High'; }

    // Target price
    let targetPrice = null;
    if (quote.price && quote.trailingPE) {
        const growthAdj = fd.revenueGrowth != null ? (1 + fd.revenueGrowth * 0.5) : 1;
        targetPrice = Math.round(quote.price * growthAdj * (avgScore / 6));
    }

    // Summary
    const name = quote.longName || quote.shortName || quote.symbol;
    const summaryParts = [];
    summaryParts.push(`${name} (${quote.symbol}) is currently trading at $${quote.price?.toFixed(2)}`);
    if (quote.marketCap) summaryParts[0] += ` with a market cap of $${(quote.marketCap / 1e9).toFixed(0)}B.`;
    if (bullCase.length > 0) summaryParts.push(`Key strengths include ${bullCase[0].toLowerCase()}.`);
    if (bearCase.length > 0) summaryParts.push(`However, investors should note ${bearCase[0].toLowerCase()}.`);
    summaryParts.push(`Our quantitative model rates the stock as "${rating}" based on ${scoreCount} fundamental factors.`);

    return {
        summary: summaryParts.join(' '),
        bullCase: bullCase.slice(0, 4),
        bearCase: bearCase.slice(0, 4),
        risks: risks.slice(0, 4),
        catalysts: catalysts.slice(0, 4),
        rating,
        confidenceLevel,
        targetPrice,
        timeHorizon: '12 months',
    };
}



// ─── Screener (cached) ───────────────────────────────────────
app.get('/api/screener', handleAsync(async (req, res) => {
    const cacheKey = 'screener_data';
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const SECTOR_STOCKS_UNIVERSE = {
        "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMZN", "CRM", "ADBE", "ORCL", "INTC", "CSCO", "IBM", "TXN", "QCOM", "AMD"],
        "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC", "C", "BLK", "SCHW", "AXP", "USB", "PNC", "TFC", "COF", "CME", "ICE"],
        "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY", "BMY", "AMGN", "DHR", "ISRG", "SYK", "MDT", "CVS"],
        "Consumer Cyclical": ["TSLA", "HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "TJX", "BKNG", "GM", "F", "YUM", "CMG", "MAR", "HLT"],
        "Communication Services": ["GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS", "CHTR", "SPOT", "EA", "TTWO", "OMC", "IPG"],
        "Consumer Defensive": ["PG", "KO", "PEP", "WMT", "COST", "CL", "MDLZ", "PM", "MO", "GIS", "K", "HNZ", "SYY", "ADM", "TSN"],
        "Energy": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "HAL", "BKR", "KMI", "WMB", "OKE", "TRGP"],
        "Industrials": ["UNP", "HON", "UPS", "BA", "CAT", "DE", "GE", "LMT", "RTX", "WM", "CSX", "NSC", "FDX", "NOC", "GD"],
        "Basic Materials": ["LIN", "APD", "SHW", "ECL", "DD", "NEM", "FCX", "NUE", "VMC", "MLM", "DOW", "LYB", "CTVA", "FMC", "ALB"],
        "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "SPG", "PSA", "O", "WELL", "DLR", "AVB", "EQR", "INVH", "AMH", "SUI", "ELS"],
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "ED", "WEC", "ES", "PEG", "EIX", "AWK", "WTRG"]
    };

    const NEW_SECTORS = {
        "Indexes": ["SPY", "DIA", "QQQ", "IWM", "VOO", "VTI", "IVV", "VUG", "VTV", "VNQ", "XLF", "XLV", "XLK"],
        "AI": ["NVDA", "MSFT", "GOOGL", "AMD", "TSM", "PLTR", "SMCI", "AVGO", "ARM", "CRWD", "HPE", "DELL", "IBM", "META", "AMZN"],
        "Penny Stocks": ["MVIS", "SENS", "ZOM", "CTRM", "SNDL", "GTE", "NAKD", "BNGO", "NCTY", "IDEX", "TNXP", "SOS", "XSPA", "IZEA", "OGEN"]
    };

    // Random selection function
    const getRandom = (arr, n) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    };

    const CATEGORIES_TO_FETCH = {};
    for (const [cat, pool] of Object.entries(NEW_SECTORS)) CATEGORIES_TO_FETCH[cat] = getRandom(pool, Math.min(12, pool.length));
    for (const [sec, pool] of Object.entries(SECTOR_STOCKS_UNIVERSE)) CATEGORIES_TO_FETCH[sec] = getRandom(pool, Math.min(12, pool.length));

    const allSymbols = new Set();
    Object.values(CATEGORIES_TO_FETCH).forEach(syms => syms.forEach(s => allSymbols.add(s)));

    const stockData = {};
    const fetchPromises = Array.from(allSymbols).map(async (sym) => {
        try {
            const [q, data] = await Promise.all([
                yahooFinance.quote(sym).catch(() => null),
                yahooFinance.quoteSummary(sym, { modules: ['financialData', 'defaultKeyStatistics'] }).catch(() => ({}))
            ]);

            if (!q || !q.regularMarketPrice || !q.fiftyTwoWeekHigh || !q.fiftyTwoWeekLow) return;

            const fd = data.financialData || {};
            const price = q.regularMarketPrice;
            const high52 = q.fiftyTwoWeekHigh;
            const low52 = q.fiftyTwoWeekLow;

            const pctFromHigh = ((price - high52) / high52) * 100;
            const pctFromLow = ((price - low52) / low52) * 100;
            const rangePos = high52 !== low52 ? ((price - low52) / (high52 - low52)) * 100 : 50;

            stockData[sym] = {
                symbol: q.symbol || sym,
                name: q.shortName || q.longName || sym,
                sector: q.sector || '',
                industry: q.industry || '',
                price: price,
                change: Number((q.regularMarketChangePercent || 0).toFixed(2)),
                marketCap: q.marketCap || data.defaultKeyStatistics?.totalAssets,
                fiftyTwoWeekHigh: high52,
                fiftyTwoWeekLow: low52,
                pctFromHigh: Number(pctFromHigh.toFixed(2)),
                pctFromLow: Number(pctFromLow.toFixed(2)),
                rangePosition: Number(rangePos.toFixed(1)),
                trailingPE: q.trailingPE,
                forwardPE: q.forwardPE,
                revenueGrowth: fd.revenueGrowth,
                profitMargins: fd.profitMargins,
                returnOnEquity: fd.returnOnEquity,
                dividendYield: q.trailingAnnualDividendYield || q.yield,
                beta: q.beta,
                recommendationKey: fd.recommendationKey || '',
                targetMeanPrice: fd.targetMeanPrice,
                earningsGrowth: fd.earningsGrowth,
                debtToEquity: fd.debtToEquity,
                freeCashflow: fd.freeCashflow
            };
        } catch (e) {
            // Ignore individual fetch errors
        }
    });

    await Promise.all(fetchPromises);

    const sectors = {};
    const order = ["Indexes", "AI", "Penny Stocks", ...Object.keys(SECTOR_STOCKS_UNIVERSE)];

    for (const categoryName of order) {
        const symbols = CATEGORIES_TO_FETCH[categoryName] || [];
        const stocks = symbols.map(s => stockData[s]).filter(Boolean);

        if (stocks.length > 0) {
            const nearHigh = [...stocks].sort((a, b) => b.pctFromHigh - a.pctFromHigh).slice(0, 5);
            const nearLow = [...stocks].sort((a, b) => a.pctFromLow - b.pctFromLow).slice(0, 5);

            for (const s of stocks) {
                let score = 0;
                const reasons = [];
                if (['buy', 'strong_buy'].includes(s.recommendationKey)) { score += 3; reasons.push("Strong Analyst Rating"); }
                if ((s.revenueGrowth || 0) > 0.1) { score += 2; reasons.push(">10% Revenue Growth"); }
                if ((s.profitMargins || 0) > 0.15) { score += 1; reasons.push(">15% Profit Margins"); }
                if ((s.returnOnEquity || 0) > 0.15) { score += 1; reasons.push(">15% ROE"); }
                s._topPickScore = score;
                s.topPickReason = reasons.length ? reasons.join(" • ") : "Solid Fundamentals";
            }

            const topPicks = [...stocks].sort((a, b) => b._topPickScore - a._topPickScore).slice(0, 8);
            sectors[categoryName] = { nearHigh, nearLow, topPicks, stockCount: stocks.length };
        }
    }

    const output = { sectors };
    cache.set(cacheKey, output, 300); // 5 min cache
    res.json(output);
}));

// ─── Search ──────────────────────────────────────────────────
app.get('/api/search/:query', handleAsync(async (req, res) => {
    const query = req.params.query;
    try {
        const results = await yahooFinance.search(query);
        const quotes = (results.quotes || [])
            .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
            .slice(0, 8)
            .map(q => ({
                symbol: q.symbol || '',
                name: q.shortname || q.longname || q.symbol || '',
                exchange: q.exchDisp || q.exchange || ''
            }));
        res.json(quotes);
    } catch (err) {
        console.error('Search error:', err.message);
        res.json([]);
    }
}));

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist')); // Serve static files from the 'dist' directory
    app.get('*', (req, res) => { // Catch-all for unhandled routes
        res.sendFile(join(__dirname, 'dist', 'index.html')); // Serve index.html
    });
}

app.listen(PORT, () => console.log(`\n🚀 Stock Analyzer API running on http://localhost:${PORT}\n`));
