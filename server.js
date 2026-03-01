import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calculateFairValue } from './valuation.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ─── Python Bridge ───────────────────────────────────────────
const PYTHON = resolve(__dirname, '.venv/bin/python3');
const FETCH_SCRIPT = resolve(__dirname, 'fetch_data.py');

function fetchFromPython(action, ticker, ...extraArgs) {
    return new Promise((res, rej) => {
        execFile(PYTHON, [FETCH_SCRIPT, action, ticker, ...extraArgs], { timeout: 60000 }, (err, stdout, stderr) => {
            if (err) return rej(new Error(`Python error: ${stderr || err.message}`));
            try {
                const data = JSON.parse(stdout.trim());
                if (data.error) return rej(new Error(data.error));
                res(data);
            } catch (e) {
                rej(new Error(`JSON parse error: ${e.message}\nOutput: ${stdout.slice(0, 500)}`));
            }
        });
    });
}

// ─── Quote ───────────────────────────────────────────────────
app.get('/api/quote/:ticker', async (req, res) => {
    try {
        const quote = await fetchFromPython('quote', req.params.ticker.toUpperCase());
        if (quote.price != null && quote.previousClose != null) {
            quote.change = quote.price - quote.previousClose;
            quote.changePercent = (quote.change / quote.previousClose) * 100;
        }
        res.json(quote);
    } catch (err) {
        console.error('Quote error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Financials ──────────────────────────────────────────────
app.get('/api/financials/:ticker', async (req, res) => {
    try {
        res.json(await fetchFromPython('financials', req.params.ticker.toUpperCase()));
    } catch (err) {
        console.error('Financials error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Fair Value ──────────────────────────────────────────────
app.get('/api/fair-value/:ticker', async (req, res) => {
    try {
        const data = await fetchFromPython('fair-value-data', req.params.ticker.toUpperCase());
        res.json(calculateFairValue(data.quote, data.financials, null));
    } catch (err) {
        console.error('Fair value error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Price History ───────────────────────────────────────────
app.get('/api/history/:ticker', async (req, res) => {
    try {
        const { range = '1y', interval = '1d' } = req.query;
        const data = await fetchFromPython('history', req.params.ticker.toUpperCase(), range, interval);
        res.json(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error('History error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Analyst Ratings & Forecasts ─────────────────────────────
app.get('/api/analyst/:ticker', async (req, res) => {
    try {
        res.json(await fetchFromPython('analyst', req.params.ticker.toUpperCase()));
    } catch (err) {
        console.error('Analyst error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Peer Comparison ─────────────────────────────────────────
app.get('/api/peers/:ticker', async (req, res) => {
    try {
        res.json(await fetchFromPython('peers', req.params.ticker.toUpperCase()));
    } catch (err) {
        console.error('Peers error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── AI Analysis (Rule-Based + Optional Gemini) ─────────────
app.get('/api/ai-analysis/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();
        const quote = await fetchFromPython('quote', ticker);
        let fd = {};
        try { fd = (await fetchFromPython('financials', ticker)).financialData || {}; } catch { }

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

        res.json({ available: true, analysis });
    } catch (err) {
        console.error('AI error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

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
let screenerCache = { data: null, ts: 0 };
app.get('/api/screener', async (req, res) => {
    try {
        // Cache for 5 minutes since this is expensive
        if (screenerCache.data && Date.now() - screenerCache.ts < 300000) {
            return res.json(screenerCache.data);
        }
        const data = await new Promise((resolve, reject) => {
            execFile(PYTHON, [FETCH_SCRIPT, 'screener', '_'], { timeout: 120000 }, (err, stdout, stderr) => {
                if (err) return reject(new Error(stderr || err.message));
                try { resolve(JSON.parse(stdout.trim())); }
                catch (e) { reject(new Error('Invalid JSON from screener')); }
            });
        });
        screenerCache = { data, ts: Date.now() };
        res.json(data);
    } catch (err) {
        console.error('Screener error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Search ──────────────────────────────────────────────────
app.get('/api/search/:query', async (req, res) => {
    try {
        const results = await fetchFromPython('search', req.params.query);
        res.json(Array.isArray(results) ? results : []);
    } catch (err) {
        console.error('Search error:', err.message);
        res.json([]);
    }
});

app.listen(PORT, () => console.log(`\n🚀 Stock Analyzer API running on http://localhost:${PORT}\n`));
