#!/usr/bin/env python3
"""
Yahoo Finance Data Fetcher
Provides stock data via simple CLI interface for the Node.js backend.
Usage: python3 fetch_data.py <action> <ticker>
Actions: quote, financials, search, fair-value-data
"""

import sys
import json
import yfinance as yf


def get_quote(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info
    
    if not info or info.get('trailingPegRatio') is None and info.get('regularMarketPrice') is None:
        # Try fast_info as fallback
        fi = stock.fast_info
        if not fi:
            return {"error": f"Ticker '{ticker}' not found"}
    
    return {
        "symbol": info.get("symbol", ticker),
        "shortName": info.get("shortName", ""),
        "longName": info.get("longName", info.get("shortName", "")),
        "price": info.get("regularMarketPrice") or info.get("currentPrice"),
        "previousClose": info.get("regularMarketPreviousClose") or info.get("previousClose"),
        "change": None,  # Will be calculated client-side
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
        "dividendYield": info.get("dividendYield"),
        "dividendRate": info.get("dividendRate"),
        "beta": info.get("beta"),
        "exchange": info.get("exchange", ""),
        "currency": info.get("currency", "USD"),
        "bookValue": info.get("bookValue"),
        "priceToBook": info.get("priceToBook"),
        "fiftyDayAverage": info.get("fiftyDayAverage"),
        "twoHundredDayAverage": info.get("twoHundredDayAverage"),
        "sharesOutstanding": info.get("sharesOutstanding"),
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
        "ebitda": info.get("ebitda"),
        "freeCashflow": info.get("freeCashflow"),
        "operatingCashflow": info.get("operatingCashflow"),
        "earningsGrowth": info.get("earningsGrowth"),
        "totalCash": info.get("totalCash"),
        "totalDebt": info.get("totalDebt"),
        "debtToEquity": info.get("debtToEquity"),
        "currentRatio": info.get("currentRatio"),
        "returnOnEquity": info.get("returnOnEquity"),
        "returnOnAssets": info.get("returnOnAssets"),
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
        "dividendYield": info.get("dividendYield"),
        "payoutRatio": info.get("payoutRatio"),
    }

    # Get income statement history
    income_stmts = []
    try:
        inc = stock.income_stmt
        if inc is not None and not inc.empty:
            for col in inc.columns[:4]:  # Last 4 years
                stmt = {"endDate": col.isoformat() if hasattr(col, 'isoformat') else str(col)}
                for idx in inc.index:
                    val = inc.loc[idx, col]
                    key = str(idx).replace(' ', '')
                    # Map to standard keys
                    key_map = {
                        'TotalRevenue': 'totalRevenue',
                        'GrossProfit': 'grossProfit',
                        'OperatingIncome': 'operatingIncome',
                        'NetIncome': 'netIncome',
                        'EBITDA': 'ebitda',
                    }
                    mapped = key_map.get(key, None)
                    if mapped:
                        stmt[mapped] = float(val) if val == val else None  # NaN check
                income_stmts.append(stmt)
    except Exception:
        pass

    return {
        "financialData": financial_data,
        "defaultKeyStatistics": key_statistics,
        "summaryDetail": summary_detail,
        "incomeStatement": income_stmts,
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
        # Fallback: try simple lookup
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
        print(json.dumps({"error": "Usage: fetch_data.py <action> <ticker>"}))
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
