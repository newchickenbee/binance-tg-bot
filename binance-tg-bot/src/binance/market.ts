import { publicRequest } from './client';

export interface Ticker24hr {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
}

interface PriceTicker {
    symbol: string;
    price: string;
    time: number;
}

interface PremiumIndex {
    symbol: string;
    markPrice: string;
    lastFundingRate: string;
    nextFundingTime: number;
    interestRate: string;
}

export async function getPrice(symbol: string): Promise<{ price: string; symbol: string }> {
    return publicRequest<PriceTicker>('/fapi/v2/ticker/price', { symbol });
}

export async function getFundingRate(symbol: string): Promise<{
    markPrice: string;
    fundingRate: string;
    nextFundingTime: number;
}> {
    const data = await publicRequest<PremiumIndex>('/fapi/v1/premiumIndex', { symbol });
    return {
        markPrice: data.markPrice,
        fundingRate: (parseFloat(data.lastFundingRate) * 100).toFixed(4),
        nextFundingTime: data.nextFundingTime,
    };
}

export interface ExchangeInfo {
    symbols: Array<{
        symbol: string;
        filters: Array<{
            filterType: string;
            stepSize?: string;
            notional?: string;
        }>;
    }>;
}

let exchangeInfoCache: ExchangeInfo | null = null;
let exchangeInfoFetchTime = 0;

export async function getExchangeInfo(): Promise<ExchangeInfo> {
    const now = Date.now();
    if (exchangeInfoCache && now - exchangeInfoFetchTime < 60 * 60 * 1000) {
        return exchangeInfoCache;
    }
    const data = await publicRequest<ExchangeInfo>('/fapi/v1/exchangeInfo');
    exchangeInfoCache = data;
    exchangeInfoFetchTime = now;
    return data;
}

export async function calcQuantityByUSDT(symbol: string, usdtAmount: number, price?: number): Promise<number> {
    // If price is not provided, fetch current market price
    const entryPrice = price || parseFloat((await getPrice(symbol)).price);
    
    const info = await getExchangeInfo();
    const symbolInfo = info.symbols.find(s => s.symbol === symbol.toUpperCase());
    
    if (symbolInfo) {
        // Check MIN_NOTIONAL
        const notionalFilter = symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL');
        if (notionalFilter && notionalFilter.notional) {
            const minNotional = parseFloat(notionalFilter.notional);
            if (usdtAmount < minNotional) {
                throw new Error(`${symbol} 最小下单金额为 ${minNotional} USDT (当前输入: ${usdtAmount} USDT)`);
            }
        }
    }

    const rawQuantity = usdtAmount / entryPrice;

    if (!symbolInfo) return rawQuantity;

    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    if (lotSizeFilter && lotSizeFilter.stepSize) {
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        let precision = 0;
        const stepSizeStr = lotSizeFilter.stepSize;
        if (stepSizeStr.includes('.')) {
            precision = stepSizeStr.split('.')[1].replace(/0+$/, '').length;
        }
        
        const discrete = Math.floor(rawQuantity / stepSize) * stepSize;
        return parseFloat(discrete.toFixed(precision));
    }
    return rawQuantity;
}

const klineCache: { date: string; data: Record<string, { open: number; high: number; low: number }> } = {
    date: '',
    data: {},
};

async function updateKlineCache(symbols: string[], today: string) {
    if (klineCache.date !== today || Object.keys(klineCache.data).length < symbols.length * 0.9) {
        const dataMap: Record<string, { open: number; high: number; low: number }> = {};
        const chunkSize = 50;
        for (let i = 0; i < symbols.length; i += chunkSize) {
            const chunk = symbols.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (symbol) => {
                try {
                    const data = await publicRequest<any[]>('/fapi/v1/klines', { symbol, interval: '1d', limit: '1' });
                    if (data && data[0]) {
                        dataMap[symbol] = {
                            open: parseFloat(data[0][1]),
                            high: parseFloat(data[0][2]),
                            low: parseFloat(data[0][3]),
                        };
                    }
                } catch (err) {
                    // ignore
                }
            }));
            await new Promise(r => setTimeout(r, 50));
        }
        klineCache.date = today;
        klineCache.data = dataMap;
    }
}

type SortDirection = 'desc' | 'asc';

async function getUsdtTickers24hr(limit: number, useUtc0: boolean, direction: SortDirection): Promise<Ticker24hr[]> {
    const sortMultiplier = direction === 'desc' ? -1 : 1;

    if (!useUtc0) {
        const data = await publicRequest<Ticker24hr[]>('/fapi/v1/ticker/24hr');
        return data
            .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
            .sort((a, b) => sortMultiplier * (parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)))
            .slice(0, limit);
    }

    const ticker24hrList = await publicRequest<Ticker24hr[]>('/fapi/v1/ticker/24hr');
    const validTickers = ticker24hrList.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));

    const symbols = validTickers.map(t => t.symbol);
    const today = new Date().toISOString().split('T')[0];

    await updateKlineCache(symbols, today);

    const tickersWithChange = validTickers.map(t => {
        const lastPrice = parseFloat(t.lastPrice);
        const kline = klineCache.data[t.symbol];
        let percent = 0;
        let change = 0;
        if (kline && kline.open > 0) {
            change = lastPrice - kline.open;
            percent = (change / kline.open) * 100;
        }
        return {
            symbol: t.symbol,
            lastPrice: t.lastPrice,
            priceChange: change.toString(),
            priceChangePercent: percent.toString(),
            volume: t.volume,
            quoteVolume: t.quoteVolume,
        };
    });

    return tickersWithChange
        .filter(t => klineCache.data[t.symbol] !== undefined)
        .sort((a, b) => sortMultiplier * (parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)))
        .slice(0, limit);
}

export async function getTopGainers(limit: number = 10, useUtc0: boolean = false): Promise<Ticker24hr[]> {
    return getUsdtTickers24hr(limit, useUtc0, 'desc');
}

export async function getTopLosers(limit: number = 10, useUtc0: boolean = false): Promise<Ticker24hr[]> {
    return getUsdtTickers24hr(limit, useUtc0, 'asc');
}

export interface AmplitudeTicker {
    symbol: string;
    amplitudePercent: string;
    lastPrice: string;
    highPrice: string;
    lowPrice: string;
    quoteVolume: string;
}

export async function getTopAmplitude(limit: number = 10, useUtc0: boolean = false): Promise<AmplitudeTicker[]> {
    if (!useUtc0) {
        const data = await publicRequest<any[]>('/fapi/v1/ticker/24hr');
        return data
            .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
            .map(t => {
                const high = parseFloat(t.highPrice);
                const low = parseFloat(t.lowPrice);
                const open = parseFloat(t.openPrice);
                const amplitude = open > 0 ? ((high - low) / open) * 100 : 0;
                return {
                    symbol: t.symbol,
                    amplitudePercent: amplitude.toString(),
                    lastPrice: t.lastPrice,
                    highPrice: t.highPrice,
                    lowPrice: t.lowPrice,
                    quoteVolume: t.quoteVolume,
                };
            })
            .sort((a, b) => parseFloat(b.amplitudePercent) - parseFloat(a.amplitudePercent))
            .slice(0, limit);
    }

    const ticker24hrList = await publicRequest<Ticker24hr[]>('/fapi/v1/ticker/24hr');
    const validTickers = ticker24hrList.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));
    const symbols = validTickers.map(t => t.symbol);
    const today = new Date().toISOString().split('T')[0];

    await updateKlineCache(symbols, today);

    const tickersWithAmplitude = validTickers.map(t => {
        const lastPrice = parseFloat(t.lastPrice);
        const kline = klineCache.data[t.symbol];
        let amplitude = 0;
        let high = lastPrice;
        let low = lastPrice;
        if (kline) {
            high = Math.max(kline.high, lastPrice);
            low = Math.min(kline.low, lastPrice);
            if (kline.open > 0) {
                amplitude = ((high - low) / kline.open) * 100;
            }
        }
        return {
            symbol: t.symbol,
            amplitudePercent: amplitude.toString(),
            lastPrice: t.lastPrice,
            highPrice: high.toString(),
            lowPrice: low.toString(),
            quoteVolume: t.quoteVolume,
        };
    });

    return tickersWithAmplitude
        .filter(t => klineCache.data[t.symbol] !== undefined)
        .sort((a, b) => parseFloat(b.amplitudePercent) - parseFloat(a.amplitudePercent))
        .slice(0, limit);
}

export async function getDailySummary(limit: number = 10): Promise<{ gainers: Ticker24hr[]; losers: Ticker24hr[] }> {
    const currentPricesList = await publicRequest<PriceTicker[]>('/fapi/v1/ticker/price');
    const validTickers = currentPricesList.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));
    const symbols = validTickers.map(t => t.symbol);

    const results: Ticker24hr[] = [];
    const chunkSize = 50;

    for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (symbol) => {
            try {
                // Fetch klines for the previous day. 
                // interval: '1d', limit: '2' gives [Yesterday, Today].
                // Yesterday's candle: data[0]. Open: data[0][1], Close: data[0][4]
                const data = await publicRequest<any[]>('/fapi/v1/klines', { symbol, interval: '1d', limit: '2' });
                if (data && data.length >= 2) {
                    const open = parseFloat(data[0][1]);
                    const close = parseFloat(data[0][4]); // Yesterday's close
                    const change = close - open;
                    const percent = (change / open) * 100;

                    const volume = data[0][5];
                    const quoteVolume = data[0][7];

                    results.push({
                        symbol,
                        lastPrice: close.toString(),
                        priceChange: change.toString(),
                        priceChangePercent: percent.toString(),
                        volume: volume.toString(),
                        quoteVolume: quoteVolume.toString(),
                    });
                }
            } catch (err) {
                // ignore
            }
        }));
        await new Promise(r => setTimeout(r, 50));
    }

    const gainers = [...results]
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, limit);

    const losers = [...results]
        .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
        .slice(0, limit);

    return { gainers, losers };
}
