#!/usr/bin/env python3
"""
Yahoo Finance Data Fetcher
Provides stock data via simple CLI interface for the Node.js backend.
Usage: python3 fetch_data.py <action> <ticker> [extra_args...]
Actions: quote, financials, search, fair-value-data, history, peers, analyst
"""

import sys
import json
import yfinance as yf


def get_quote(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info

    if not info or info.get('trailingPegRatio') is None and info.get('regularMarketPrice') is None:
        fi = stock.fast_info
        if not fi:
            return {"error": f"Ticker '{ticker}' not found"}

    return {
        "symbol": info.get("symbol", ticker),
        "shortName": info.get("shortName", ""),
        "longName": info.get("longName", info.get("shortName", "")),
        "price": info.get("regularMarketPrice") or info.get("currentPrice"),
        "previousClose": info.get("regularMarketPreviousClose") or info.get("previousClose"),
        "change": None,
        "changePercent": None,
        "open": info.get("regularMarketOpen") or info.get("open"),
        "dayHigh": info.get("regularMarketDayHigh") or info.get("dayHigh"),
        "dayLow": info.get("regularMarketDayLow") or info.get("dayLow"),
        "volume": info.get("regularMarketVolume") or info.get("volume"),
        "avgVolume": info.get("averageDailyVolume3Month") or info.get("averageVolume"),
        "marketCap": info.get("marketCap"),
        "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
        "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
        "trailingPE": info.get("trailingPE"),
        "forwardPE": info.get("forwardPE"),
        "eps": info.get("trailingEps"),
        "forwardEps": info.get("forwardEps"),
        "dividendYield": info.get("trailingAnnualDividendYield"),
        "dividendRate": info.get("dividendRate"),
        "beta": info.get("beta"),
        "exchange": info.get("exchange", ""),
        "currency": info.get("currency", "USD"),
        "bookValue": info.get("bookValue"),
        "priceToBook": info.get("priceToBook"),
        "fiftyDayAverage": info.get("fiftyDayAverage"),
        "twoHundredDayAverage": info.get("twoHundredDayAverage"),
        "sharesOutstanding": info.get("sharesOutstanding"),
        "sector": info.get("sector", ""),
        "industry": info.get("industry", ""),
        "recommendationKey": info.get("recommendationKey", ""),
        "recommendationMean": info.get("recommendationMean"),
        "targetHighPrice": info.get("targetHighPrice"),
        "targetLowPrice": info.get("targetLowPrice"),
        "targetMeanPrice": info.get("targetMeanPrice"),
        "targetMedianPrice": info.get("targetMedianPrice"),
        "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
    }


def get_financials(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info

    financial_data = {
        "totalRevenue": info.get("totalRevenue"),
        "revenueGrowth": info.get("revenueGrowth"),
        "grossProfits": info.get("grossProfits"),
        "profitMargins": info.get("profitMargins"),
        "operatingMargins": info.get("operatingMargins"),
        "grossMargins": info.get("grossMargins"),
        "ebitda": info.get("ebitda"),
        "ebitdaMargins": info.get("ebitdaMargins"),
        "freeCashflow": info.get("freeCashflow"),
        "operatingCashflow": info.get("operatingCashflow"),
        "earningsGrowth": info.get("earningsGrowth"),
        "totalCash": info.get("totalCash"),
        "totalCashPerShare": info.get("totalCashPerShare"),
        "totalDebt": info.get("totalDebt"),
        "debtToEquity": info.get("debtToEquity"),
        "currentRatio": info.get("currentRatio"),
        "quickRatio": info.get("quickRatio"),
        "returnOnEquity": info.get("returnOnEquity"),
        "returnOnAssets": info.get("returnOnAssets"),
        "revenuePerShare": info.get("revenuePerShare"),
    }

    key_statistics = {
        "enterpriseValue": info.get("enterpriseValue"),
        "enterpriseToRevenue": info.get("enterpriseToRevenue"),
        "enterpriseToEbitda": info.get("enterpriseToEbitda"),
        "pegRatio": info.get("pegRatio") or info.get("trailingPegRatio"),
        "priceToSalesTrailing12Months": info.get("priceToSalesTrailing12Months"),
        "sharesOutstanding": info.get("sharesOutstanding"),
    }

    summary_detail = {
        "trailingPE": info.get("trailingPE"),
        "forwardPE": info.get("forwardPE"),
        "priceToBook": info.get("priceToBook"),
        "dividendYield": info.get("trailingAnnualDividendYield"),
        "payoutRatio": info.get("payoutRatio"),
    }

    # Annual income statements
    annual_income = []
    try:
        inc = stock.income_stmt
        if inc is not None and not inc.empty:
            for col in inc.columns[:4]:
                stmt = {"endDate": col.isoformat() if hasattr(col, 'isoformat') else str(col)}
                key_map = {
                    'TotalRevenue': 'totalRevenue',
                    'GrossProfit': 'grossProfit',
                    'OperatingIncome': 'operatingIncome',
                    'NetIncome': 'netIncome',
                    'EBITDA': 'ebitda',
                    'TotalExpenses': 'totalExpenses',
                    'CostOfRevenue': 'costOfRevenue',
                    'SellingGeneralAndAdministration': 'sga',
                    'ResearchAndDevelopment': 'rnd',
                    'BasicEPS': 'basicEps',
                    'DilutedEPS': 'dilutedEps',
                }
                for idx in inc.index:
                    key = str(idx).replace(' ', '')
                    mapped = key_map.get(key, None)
                    if mapped:
                        val = inc.loc[idx, col]
                        stmt[mapped] = float(val) if val == val else None
                annual_income.append(stmt)
    except Exception:
        pass

    # Quarterly income statements
    quarterly_income = []
    try:
        qinc = stock.quarterly_income_stmt
        if qinc is not None and not qinc.empty:
            for col in qinc.columns[:8]:
                stmt = {"endDate": col.isoformat() if hasattr(col, 'isoformat') else str(col)}
                key_map = {
                    'TotalRevenue': 'totalRevenue',
                    'GrossProfit': 'grossProfit',
                    'OperatingIncome': 'operatingIncome',
                    'NetIncome': 'netIncome',
                    'EBITDA': 'ebitda',
                    'BasicEPS': 'basicEps',
                    'DilutedEPS': 'dilutedEps',
                }
                for idx in qinc.index:
                    key = str(idx).replace(' ', '')
                    mapped = key_map.get(key, None)
                    if mapped:
                        val = qinc.loc[idx, col]
                        stmt[mapped] = float(val) if val == val else None
                quarterly_income.append(stmt)
    except Exception:
        pass

    # Cash flow statements (annual)
    cashflow_annual = []
    try:
        cf = stock.cashflow
        if cf is not None and not cf.empty:
            for col in cf.columns[:4]:
                stmt = {"endDate": col.isoformat() if hasattr(col, 'isoformat') else str(col)}
                key_map = {
                    'OperatingCashFlow': 'operatingCashFlow',
                    'FreeCashFlow': 'freeCashFlow',
                    'CapitalExpenditure': 'capitalExpenditure',
                    'EndCashPosition': 'endCashPosition',
                    'IssuanceOfDebt': 'issuanceOfDebt',
                    'RepaymentOfDebt': 'repaymentOfDebt',
                    'RepurchaseOfCapitalStock': 'shareRepurchase',
                    'CashDividendsPaid': 'dividendsPaid',
                    'CommonStockDividendPaid': 'dividendsPaid',
                }
                for idx in cf.index:
                    key = str(idx).replace(' ', '')
                    mapped = key_map.get(key, None)
                    if mapped and mapped not in stmt:
                        val = cf.loc[idx, col]
                        stmt[mapped] = float(val) if val == val else None
                cashflow_annual.append(stmt)
    except Exception:
        pass

    # Balance sheet (annual)
    balance_sheet = []
    try:
        bs = stock.balance_sheet
        if bs is not None and not bs.empty:
            for col in bs.columns[:4]:
                stmt = {"endDate": col.isoformat() if hasattr(col, 'isoformat') else str(col)}
                key_map = {
                    'TotalAssets': 'totalAssets',
                    'TotalLiabilitiesNetMinorityInterest': 'totalLiabilities',
                    'StockholdersEquity': 'totalEquity',
                    'TotalDebt': 'totalDebt',
                    'CashAndCashEquivalents': 'cashAndEquivalents',
                    'CashCashEquivalentsAndShortTermInvestments': 'cashAndShortTermInvestments',
                    'NetDebt': 'netDebt',
                    'CurrentAssets': 'currentAssets',
                    'CurrentLiabilities': 'currentLiabilities',
                    'LongTermDebt': 'longTermDebt',
                    'CommonStockEquity': 'commonEquity',
                }
                for idx in bs.index:
                    key = str(idx).replace(' ', '')
                    mapped = key_map.get(key, None)
                    if mapped and mapped not in stmt:
                        val = bs.loc[idx, col]
                        stmt[mapped] = float(val) if val == val else None
                balance_sheet.append(stmt)
    except Exception:
        pass

    return {
        "financialData": financial_data,
        "defaultKeyStatistics": key_statistics,
        "summaryDetail": summary_detail,
        "incomeStatement": annual_income,
        "quarterlyIncome": quarterly_income,
        "cashflowStatement": cashflow_annual,
        "balanceSheet": balance_sheet,
    }


def get_fair_value_data(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info

    return {
        "quote": {
            "symbol": info.get("symbol", ticker),
            "regularMarketPrice": info.get("regularMarketPrice") or info.get("currentPrice"),
            "epsTrailingTwelveMonths": info.get("trailingEps"),
            "epsForward": info.get("forwardEps"),
            "bookValue": info.get("bookValue"),
            "sharesOutstanding": info.get("sharesOutstanding"),
            "marketCap": info.get("marketCap"),
        },
        "financials": {
            "financialData": {
                "freeCashflow": info.get("freeCashflow"),
                "revenueGrowth": info.get("revenueGrowth"),
                "earningsGrowth": info.get("earningsGrowth"),
                "totalCash": info.get("totalCash"),
                "totalDebt": info.get("totalDebt"),
                "ebitda": info.get("ebitda"),
                "profitMargins": info.get("profitMargins"),
            },
            "defaultKeyStatistics": {
                "enterpriseValue": info.get("enterpriseValue"),
                "sharesOutstanding": info.get("sharesOutstanding"),
            },
        },
    }


def get_history(ticker, period="1y", interval="1d"):
    stock = yf.Ticker(ticker)
    df = stock.history(period=period, interval=interval)
    if df is None or df.empty:
        return []

    data = []
    for idx, row in df.iterrows():
        data.append({
            "time": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2) if row["Open"] == row["Open"] else None,
            "high": round(float(row["High"]), 2) if row["High"] == row["High"] else None,
            "low": round(float(row["Low"]), 2) if row["Low"] == row["Low"] else None,
            "close": round(float(row["Close"]), 2) if row["Close"] == row["Close"] else None,
            "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
        })
    return data


def get_analyst(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info

    result = {
        "recommendationKey": info.get("recommendationKey", ""),
        "recommendationMean": info.get("recommendationMean"),
        "targetHighPrice": info.get("targetHighPrice"),
        "targetLowPrice": info.get("targetLowPrice"),
        "targetMeanPrice": info.get("targetMeanPrice"),
        "targetMedianPrice": info.get("targetMedianPrice"),
        "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
        "recommendations": [],
    }

    # Get recommendation trend
    try:
        recs = stock.recommendations
        if recs is not None and not recs.empty:
            # Get the most recent period's breakdown
            latest = recs.iloc[:4]
            for _, row in latest.iterrows():
                rec = {}
                for col in recs.columns:
                    val = row[col]
                    if hasattr(val, 'isoformat'):
                        rec[col] = val.isoformat()
                    elif val == val:  # NaN check
                        rec[col] = int(val) if isinstance(val, (int, float)) and float(val) == int(val) else val
                    else:
                        rec[col] = None
                result["recommendations"].append(rec)
    except Exception:
        pass

    # EPS estimates (for forecast charts)
    result["epsHistory"] = []
    result["revenueHistory"] = []
    try:
        inc = stock.income_stmt
        if inc is not None and not inc.empty:
            for col in reversed(list(inc.columns[:4])):
                year = col.year if hasattr(col, 'year') else str(col)[:4]
                rev = None
                eps = None
                for idx in inc.index:
                    key = str(idx).replace(' ', '')
                    if key == 'TotalRevenue':
                        val = inc.loc[idx, col]
                        rev = float(val) if val == val else None
                    if key in ('DilutedEPS', 'BasicEPS'):
                        val = inc.loc[idx, col]
                        if eps is None:
                            eps = float(val) if val == val else None
                if rev is not None:
                    result["revenueHistory"].append({"year": str(year), "value": rev, "type": "actual"})
                if eps is not None:
                    result["epsHistory"].append({"year": str(year), "value": eps, "type": "actual"})
    except Exception:
        pass

    # Forward estimates
    forward_eps = info.get("forwardEps")
    if forward_eps:
        result["epsHistory"].append({"year": "Forward", "value": forward_eps, "type": "estimate"})

    return result


def get_peers(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info
    sector = info.get("sector", "")
    industry = info.get("industry", "")

    # Map of well-known sector peers
    SECTOR_PEERS = {
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
        "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "ED", "WEC"],
    }

    # Get peers from sector map, filtering out the current ticker
    peer_symbols = SECTOR_PEERS.get(sector, [])
    peer_symbols = [s for s in peer_symbols if s.upper() != ticker.upper()][:5]

    if not peer_symbols:
        return {"sector": sector, "industry": industry, "peers": []}

    peers = []
    for sym in peer_symbols:
        try:
            p = yf.Ticker(sym)
            pi = p.info
            peers.append({
                "symbol": pi.get("symbol", sym),
                "name": pi.get("shortName", sym),
                "price": pi.get("regularMarketPrice") or pi.get("currentPrice"),
                "marketCap": pi.get("marketCap"),
                "trailingPE": pi.get("trailingPE"),
                "forwardPE": pi.get("forwardPE"),
                "priceToBook": pi.get("priceToBook"),
                "dividendYield": pi.get("trailingAnnualDividendYield"),
                "revenueGrowth": pi.get("revenueGrowth"),
                "profitMargins": pi.get("profitMargins"),
                "returnOnEquity": pi.get("returnOnEquity"),
                "beta": pi.get("beta"),
            })
        except Exception:
            pass

    return {"sector": sector, "industry": industry, "peers": peers}


def search_tickers(query):
    try:
        from yfinance import Search
        results = Search(query)
        quotes = []
        for q in (results.quotes or [])[:8]:
            if q.get('quoteType') == 'EQUITY':
                quotes.append({
                    "symbol": q.get("symbol", ""),
                    "name": q.get("shortname") or q.get("longname") or q.get("symbol", ""),
                    "exchange": q.get("exchDisp") or q.get("exchange", ""),
                })
        return quotes
    except Exception:
        try:
            stock = yf.Ticker(query)
            info = stock.info
            if info and info.get("symbol"):
                return [{
                    "symbol": info["symbol"],
                    "name": info.get("shortName") or info.get("longName") or query,
                    "exchange": info.get("exchange", ""),
                }]
        except Exception:
            pass
        return []


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: fetch_data.py <action> <ticker> [args...]"}))
        sys.exit(1)

    action = sys.argv[1]
    ticker = sys.argv[2]

    try:
        if action == "quote":
            result = get_quote(ticker)
        elif action == "financials":
            result = get_financials(ticker)
        elif action == "fair-value-data":
            result = get_fair_value_data(ticker)
        elif action == "history":
            period = sys.argv[3] if len(sys.argv) > 3 else "1y"
            interval = sys.argv[4] if len(sys.argv) > 4 else "1d"
            result = get_history(ticker, period, interval)
        elif action == "analyst":
            result = get_analyst(ticker)
        elif action == "peers":
            result = get_peers(ticker)
        elif action == "search":
            result = search_tickers(ticker)
        else:
            result = {"error": f"Unknown action: {action}"}

        print(json.dumps(result, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
