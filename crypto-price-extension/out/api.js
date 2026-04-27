"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStockSymbol = isStockSymbol;
exports.fetchPrices = fetchPrices;
/* eslint-disable @typescript-eslint/no-explicit-any */
const binance_1 = require("./binance");
const hyperliquid_1 = require("./hyperliquid");
const INDEX_SYMBOLS = ['SPX'];
function isStockSymbol(symbol) {
    return /^(sh|sz|us\.)/i.test(symbol);
}
/**
 * Derive the base pair from a symbol.
 * 'ETH-USDT' → 'ETH-USDT', 'BTC' → 'BTC-USDT'
 */
function toBasePair(symbol) {
    return symbol.includes('-') ? symbol : `${symbol}-USDT`;
}
function isIndexSymbol(symbol) {
    return INDEX_SYMBOLS.includes(symbol);
}
/**
 * Fetch UTC 0 daily candle (high/low) for a given instrument.
 * Uses bar=1Dutc to get the current day's candle anchored at UTC 0.
 */
async function fetchDailyCandleUtc0(instId) {
    const url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1Dutc&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.code !== '0' || !data.data?.length) {
            return null;
        }
        // Candle format: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
        const HIGH_INDEX = 2;
        const LOW_INDEX = 3;
        const candle = data.data[0];
        return { high: candle[HIGH_INDEX], low: candle[LOW_INDEX] };
    }
    catch (error) {
        console.error(`Failed to fetch UTC0 candle for ${instId}:`, error);
        return null;
    }
}
/**
 * Try fetching ticker from a specific endpoint.
 * Returns parsed JSON or null on failure.
 */
async function tryFetchTicker(url) {
    try {
        const res = await (await fetch(url)).json();
        if (res.code === '0' && res.data?.length) {
            return res.data[0];
        }
    }
    catch { /* swallow */ }
    return null;
}
const MAX_SYMBOLS_PER_BATCH = 3;
const BATCH_DELAY_MS = 500;
/**
 * Resolve ticker for a symbol with automatic market fallback.
 * Priority: Spot → SWAP → Index.
 * Returns the resolved ticker object and the instId used for candle queries.
 */
async function resolveTicker(symbol) {
    if (isIndexSymbol(symbol)) {
        const ticker = await tryFetchTicker(`https://www.okx.com/api/v5/market/index-tickers?instId=${toBasePair(symbol)}`);
        return ticker ? { ticker, candleInstId: '', isIndex: true } : null;
    }
    const basePair = toBasePair(symbol);
    const swapId = `${basePair}-SWAP`;
    // Try spot first
    const spotTicker = await tryFetchTicker(`https://www.okx.com/api/v5/market/ticker?instId=${basePair}`);
    if (spotTicker) {
        return { ticker: spotTicker, candleInstId: basePair, isIndex: false };
    }
    // Fallback to SWAP contract
    const swapTicker = await tryFetchTicker(`https://www.okx.com/api/v5/market/ticker?instId=${swapId}`);
    if (swapTicker) {
        return { ticker: swapTicker, candleInstId: swapId, isIndex: false };
    }
    return null;
}
async function fetchSingleSymbol(symbol, results) {
    try {
        const resolved = await resolveTicker(symbol);
        if (!resolved) {
            return;
        }
        const { ticker, candleInstId, isIndex } = resolved;
        // Fetch UTC 0 candle for non-index instruments
        const candleUtc0 = (!isIndex && candleInstId)
            ? await fetchDailyCandleUtc0(candleInstId)
            : null;
        // Fetch funding rate (try for SWAP even if spot ticker)
        let fundingRate;
        if (!isIndex && candleInstId) {
            const basePair = candleInstId.replace('-SWAP', '');
            try {
                const frRes = await (await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${basePair}-SWAP`)).json();
                if (frRes.code === '0' && frRes.data?.length > 0) {
                    const frData = frRes.data[0];
                    if (frData.fundingRate) {
                        fundingRate = (parseFloat(frData.fundingRate) * 100).toFixed(4);
                    }
                }
            }
            catch { /* ignore */ }
        }
        const lastPrice = ticker.last || ticker.idxPx;
        if (!lastPrice) {
            return;
        }
        const last = parseFloat(lastPrice);
        const open24h = parseFloat(ticker.open24h);
        const openUtc0 = parseFloat(ticker.sodUtc0);
        const change24h = open24h ? ((last - open24h) / open24h * 100).toFixed(2) : '0.00';
        const changeUtc0 = openUtc0 ? ((last - openUtc0) / openUtc0 * 100).toFixed(2) : '0.00';
        const lowUtc0Num = parseFloat(candleUtc0?.low || '0');
        const highUtc0Num = parseFloat(candleUtc0?.high || '0');
        const amplitudeUtc0 = (openUtc0 && highUtc0Num > 0 && lowUtc0Num > 0)
            ? (Math.abs(highUtc0Num - lowUtc0Num) / openUtc0 * 100).toFixed(2)
            : '0.00';
        results.set(symbol, {
            instId: ticker.instId,
            last: last.toString(),
            open24h: ticker.open24h || '0',
            change24h,
            changeUtc0,
            low24h: ticker.low24h || '0',
            high24h: ticker.high24h || '0',
            lowUtc0: candleUtc0?.low || '0',
            highUtc0: candleUtc0?.high || '0',
            amplitudeUtc0,
            fundingRate,
        });
    }
    catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
    }
}
async function fetchPrices(symbols) {
    const results = new Map();
    const stockSymbols = symbols.filter(isStockSymbol);
    const cryptoSymbols = symbols.filter(s => !isStockSymbol(s));
    // Fetch stocks via Tencent API (independent of crypto data source)
    if (stockSymbols.length > 0) {
        try {
            const query = stockSymbols.map(s => {
                if (/^us\./i.test(s)) {
                    return 'us.' + s.substring(3).toUpperCase();
                }
                return s.toLowerCase();
            }).join(',');
            const url = `https://qt.gtimg.cn/q=${query}`;
            const response = await fetch(url);
            // Tencent API returns GBK-encoded text
            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder('gbk');
            const data = decoder.decode(buffer);
            const lines = data.split('\n');
            for (const line of lines) {
                const match = line.match(/^v_(.*?)="(.*)";\s*$/);
                if (!match)
                    continue;
                const matchSymbol = match[1];
                const originalSymbol = stockSymbols.find(s => s.toLowerCase() === matchSymbol.toLowerCase()) || matchSymbol;
                const parts = match[2].split('~');
                if (parts.length < 35)
                    continue;
                // Tencent field layout (0-indexed after regex strips prefix):
                // parts[3]  = current price
                // parts[4]  = yesterday close
                // parts[32] = change percentage
                // parts[33] = today high
                // parts[34] = today low
                const PRICE_INDEX = 3;
                const PREV_CLOSE_INDEX = 4;
                const CHANGE_PCT_INDEX = 32;
                const HIGH_INDEX = 33;
                const LOW_INDEX = 34;
                const price = parseFloat(parts[PRICE_INDEX]).toString();
                const changePct = parseFloat(parts[CHANGE_PCT_INDEX]).toFixed(2);
                const high = parseFloat(parts[HIGH_INDEX]).toString();
                const low = parseFloat(parts[LOW_INDEX]).toString();
                const prevClose = parseFloat(parts[PREV_CLOSE_INDEX]);
                const highNum = parseFloat(high);
                const lowNum = parseFloat(low);
                const amplitudeUtc0 = prevClose ? (Math.abs(highNum - lowNum) / prevClose * 100).toFixed(2) : '0.00';
                results.set(originalSymbol, {
                    instId: originalSymbol,
                    last: price,
                    open24h: parts[PREV_CLOSE_INDEX],
                    change24h: changePct,
                    changeUtc0: changePct,
                    low24h: low,
                    high24h: high,
                    lowUtc0: low,
                    highUtc0: high,
                    amplitudeUtc0,
                });
            }
        }
        catch (error) {
            console.error(`Failed to fetch stock prices:`, error);
        }
    }
    // Fetch crypto: OKX first, then Binance fallback for missing symbols
    if (cryptoSymbols.length > 0) {
        // Step 1: Try OKX for all crypto symbols
        for (let i = 0; i < cryptoSymbols.length; i += MAX_SYMBOLS_PER_BATCH) {
            const batch = cryptoSymbols.slice(i, i + MAX_SYMBOLS_PER_BATCH);
            await Promise.all(batch.map(sym => fetchSingleSymbol(sym, results)));
            const hasMoreBatches = i + MAX_SYMBOLS_PER_BATCH < cryptoSymbols.length;
            if (hasMoreBatches) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
        // Step 2: Fallback to Binance for symbols OKX couldn't resolve
        let missingSymbols = cryptoSymbols.filter(sym => !results.has(sym));
        if (missingSymbols.length > 0) {
            console.log(`[Fallback] OKX missed ${missingSymbols.length} symbol(s), trying Binance: ${missingSymbols.join(', ')}`);
            await (0, binance_1.fetchBinancePrices)(missingSymbols, results);
        }
        // Step 3: Fallback to Hyperliquid for symbols Binance couldn't resolve
        missingSymbols = cryptoSymbols.filter(sym => !results.has(sym));
        if (missingSymbols.length > 0) {
            console.log(`[Fallback] Binance missed ${missingSymbols.length} symbol(s), trying Hyperliquid: ${missingSymbols.join(', ')}`);
            await (0, hyperliquid_1.fetchHyperliquidPrices)(missingSymbols, results);
        }
    }
    return results;
}
//# sourceMappingURL=api.js.map