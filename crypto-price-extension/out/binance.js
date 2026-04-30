"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBinancePrices = fetchBinancePrices;
const BINANCE_BASE_URL = 'https://api.binance.com';
/**
 * Convert unified symbol format to Binance format.
 * 'BTC-USDT' → 'BTCUSDT', 'ETH' → 'ETHUSDT'
 */
function toBinanceSymbol(symbol) {
    if (symbol.includes('-')) {
        return symbol.replace('-', '');
    }
    return `${symbol}USDT`;
}
/**
 * Fetch 24h ticker from Binance for a single symbol.
 * Endpoint: GET /api/v3/ticker/24hr?symbol=BTCUSDT (Spot) or /fapi/v1/ticker/24hr (Futures)
 */
async function fetchBinanceTicker(binanceSymbol, useFutures = false) {
    const baseUrl = useFutures ? 'https://fapi.binance.com/fapi/v1' : `${BINANCE_BASE_URL}/api/v3`;
    const url = `${baseUrl}/ticker/24hr?symbol=${binanceSymbol}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    }
    catch {
        return null;
    }
}
/**
 * Fetch current funding rate from Binance Futures.
 * Endpoint: GET /fapi/v1/premiumIndex?symbol=BTCUSDT
 */
async function fetchBinanceFundingRate(binanceSymbol) {
    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${binanceSymbol}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return undefined;
        }
        const data = await response.json();
        if (data.lastFundingRate) {
            return (parseFloat(data.lastFundingRate) * 100).toFixed(4);
        }
    }
    catch { /* ignore */ }
    return undefined;
}
/**
 * Fetch current open interest from Binance Futures.
 * Endpoint: GET /fapi/v1/openInterest?symbol=BTCUSDT
 */
async function fetchBinanceOpenInterest(binanceSymbol) {
    const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${binanceSymbol}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return undefined;
        }
        const data = await response.json();
        if (data.openInterest) {
            return data.openInterest;
        }
    }
    catch { /* ignore */ }
    return undefined;
}
/**
 * Fetch UTC0 daily candle (kline) from Binance.
 * Uses interval=1d which is anchored at UTC 00:00.
 * Returns open, high, low for UTC0 change/amplitude calculations.
 */
async function fetchBinanceDailyCandleUtc0(binanceSymbol, useFutures = false) {
    const baseUrl = useFutures ? 'https://fapi.binance.com/fapi/v1' : `${BINANCE_BASE_URL}/api/v3`;
    const url = `${baseUrl}/klines?symbol=${binanceSymbol}&interval=1d&limit=1`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }
        // Kline format: [openTime, open, high, low, close, volume, closeTime, ...]
        const OPEN_INDEX = 1;
        const HIGH_INDEX = 2;
        const LOW_INDEX = 3;
        const candle = data[0];
        return { open: candle[OPEN_INDEX], high: candle[HIGH_INDEX], low: candle[LOW_INDEX] };
    }
    catch {
        return null;
    }
}
/**
 * Fetch a single crypto symbol from Binance and populate results map.
 */
async function fetchBinanceSingleSymbol(symbol, results) {
    try {
        const binanceSymbol = toBinanceSymbol(symbol);
        let ticker = await fetchBinanceTicker(binanceSymbol, true); // Try futures first
        let useFutures = true;
        // If futures fails (e.g. symbol doesn't exist on futures), try spot
        if (!ticker || !ticker.lastPrice) {
            ticker = await fetchBinanceTicker(binanceSymbol, false);
            if (!ticker || !ticker.lastPrice) {
                return;
            }
            useFutures = false;
        }
        const last = parseFloat(ticker.lastPrice);
        const open24h = parseFloat(ticker.openPrice);
        const change24h = open24h ? ((last - open24h) / open24h * 100).toFixed(2) : '0.00';
        // Fetch UTC0 daily candle for open/high/low
        const candle = await fetchBinanceDailyCandleUtc0(binanceSymbol, useFutures);
        const openUtc0 = candle ? parseFloat(candle.open) : 0;
        const changeUtc0 = openUtc0 ? ((last - openUtc0) / openUtc0 * 100).toFixed(2) : change24h;
        const lowUtc0 = candle?.low || ticker.lowPrice;
        const highUtc0 = candle?.high || ticker.highPrice;
        const lowUtc0Num = parseFloat(lowUtc0);
        const highUtc0Num = parseFloat(highUtc0);
        const amplitudeUtc0 = (openUtc0 && highUtc0Num > 0 && lowUtc0Num > 0)
            ? (Math.abs(highUtc0Num - lowUtc0Num) / openUtc0 * 100).toFixed(2)
            : '0.00';
        // Fetch funding rate
        const fundingRate = await fetchBinanceFundingRate(binanceSymbol);
        // Fetch open interest if futures
        let openInterest;
        if (useFutures) {
            const oiQuantity = await fetchBinanceOpenInterest(binanceSymbol);
            if (oiQuantity) {
                openInterest = (parseFloat(oiQuantity) * last).toString();
            }
        }
        results.set(symbol, {
            instId: useFutures ? `${binanceSymbol}-PERP` : binanceSymbol,
            last: last.toString(),
            open24h: ticker.openPrice,
            change24h,
            changeUtc0,
            low24h: ticker.lowPrice,
            high24h: ticker.highPrice,
            lowUtc0,
            highUtc0,
            amplitudeUtc0,
            fundingRate,
            openInterest,
        });
    }
    catch (error) {
        console.error(`[Binance] Failed to fetch price for ${symbol}:`, error);
    }
}
const MAX_BINANCE_BATCH = 3;
const BINANCE_BATCH_DELAY_MS = 300;
/**
 * Fetch crypto prices from Binance for a list of symbols.
 * Only handles crypto symbols, not stocks.
 */
async function fetchBinancePrices(cryptoSymbols, results) {
    for (let i = 0; i < cryptoSymbols.length; i += MAX_BINANCE_BATCH) {
        const batch = cryptoSymbols.slice(i, i + MAX_BINANCE_BATCH);
        await Promise.all(batch.map(sym => fetchBinanceSingleSymbol(sym, results)));
        const hasMoreBatches = i + MAX_BINANCE_BATCH < cryptoSymbols.length;
        if (hasMoreBatches) {
            await new Promise(resolve => setTimeout(resolve, BINANCE_BATCH_DELAY_MS));
        }
    }
}
//# sourceMappingURL=binance.js.map