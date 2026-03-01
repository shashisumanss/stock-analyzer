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

function fetchFromPython(action, ticker) {
    return new Promise((resolve, reject) => {
        execFile(PYTHON, [FETCH_SCRIPT, action, ticker], { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`Python error: ${stderr || err.message}`));
                return;
            }
            try {
                const data = JSON.parse(stdout.trim());
                if (data.error) {
                    reject(new Error(data.error));
                    return;
                }
                resolve(data);
            } catch (e) {
                reject(new Error(`JSON parse error: ${e.message}\nOutput: ${stdout.slice(0, 500)}`));
            }
        });
    });
}

// ─── Quote endpoint ──────────────────────────────────────────
app.get('/api/quote/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const quote = await fetchFromPython('quote', ticker.toUpperCase());

        // Calculate change from previous close
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

// ─── Financials endpoint ─────────────────────────────────────
app.get('/api/financials/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const data = await fetchFromPython('financials', ticker.toUpperCase());
        res.json(data);
    } catch (err) {
        console.error('Financials error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Fair value calculation endpoint ─────────────────────────
app.get('/api/fair-value/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const data = await fetchFromPython('fair-value-data', ticker.toUpperCase());

        const fairValue = calculateFairValue(data.quote, data.financials, null);
        res.json(fairValue);
    } catch (err) {
        console.error('Fair value error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── AI analysis endpoint (Gemini) ───────────────────────────
app.get('/api/ai-analysis/:ticker', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            return res.status(200).json({
                available: false,
                message: 'Gemini API key not configured. Set GEMINI_API_KEY in .env file.',
            });
        }

        const { ticker } = req.params;
        const quote = await fetchFromPython('quote', ticker.toUpperCase());

        let financialData = {};
        try {
            const fData = await fetchFromPython('financials', ticker.toUpperCase());
            financialData = fData.financialData || {};
        } catch { /* optional */ }

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are a senior equity research analyst. Analyze this stock and provide a structured investment analysis.

Stock: ${quote.symbol} (${quote.longName || quote.shortName})
Current Price: $${quote.price}
Market Cap: $${quote.marketCap ? (quote.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
P/E Ratio: ${quote.trailingPE?.toFixed(2) || 'N/A'}
Forward P/E: ${quote.forwardPE?.toFixed(2) || 'N/A'}
EPS (TTM): $${quote.eps?.toFixed(2) || 'N/A'}
Dividend Yield: ${quote.dividendYield ? (quote.dividendYield * 100).toFixed(2) + '%' : 'None'}
Beta: ${quote.beta?.toFixed(2) || 'N/A'}
52-Week Range: $${quote.fiftyTwoWeekLow} - $${quote.fiftyTwoWeekHigh}
Revenue Growth: ${financialData.revenueGrowth ? (financialData.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
Profit Margin: ${financialData.profitMargins ? (financialData.profitMargins * 100).toFixed(1) + '%' : 'N/A'}
ROE: ${financialData.returnOnEquity ? (financialData.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}
Debt to Equity: ${financialData.debtToEquity?.toFixed(1) || 'N/A'}
Free Cash Flow: $${financialData.freeCashflow ? (financialData.freeCashflow / 1e9).toFixed(2) + 'B' : 'N/A'}

Provide your analysis in this exact JSON format (no markdown, pure JSON):
{
  "summary": "2-3 sentence executive summary of the investment thesis",
  "bullCase": ["point 1", "point 2", "point 3"],
  "bearCase": ["point 1", "point 2", "point 3"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "catalysts": ["catalyst 1", "catalyst 2"],
  "rating": "Strong Buy | Buy | Hold | Sell | Strong Sell",
  "confidenceLevel": "High | Medium | Low",
  "targetPrice": numeric_value_or_null,
  "timeHorizon": "12 months"
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let analysis;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            analysis = JSON.parse(jsonMatch[0]);
        } catch {
            analysis = { summary: text, bullCase: [], bearCase: [], risks: [], catalysts: [], rating: 'N/A', confidenceLevel: 'N/A' };
        }

        res.json({ available: true, analysis });
    } catch (err) {
        console.error('AI analysis error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Search / autocomplete endpoint ──────────────────────────
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const results = await fetchFromPython('search', query);
        res.json(Array.isArray(results) ? results : []);
    } catch (err) {
        console.error('Search error:', err.message);
        res.status(200).json([]);
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Stock Analyzer API running on http://localhost:${PORT}\n`);
});
