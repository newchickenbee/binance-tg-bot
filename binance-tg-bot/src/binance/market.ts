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

const openPriceCache: { date: string; prices: Record<string, number> } = {
    date: '',
    prices: {},
};

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

    const currentPricesList = await publicRequest<PriceTicker[]>('/fapi/v1/ticker/price');
    const validTickers = currentPricesList.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));

    const symbols = validTickers.map(t => t.symbol);
    const today = new Date().toISOString().split('T')[0];

    if (openPriceCache.date !== today || Object.keys(openPriceCache.prices).length < symbols.length * 0.9) {
        const prices: Record<string, number> = {};
        const chunkSize = 50;
        for (let i = 0; i < symbols.length; i += chunkSize) {
            const chunk = symbols.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (symbol) => {
                try {
                    const data = await publicRequest<any[]>('/fapi/v1/klines', { symbol, interval: '1d', limit: '1' });
                    if (data && data[0]) {
                        prices[symbol] = parseFloat(data[0][1]);
                    }
                } catch (err) {
                    // ignore
                }
            }));
            await new Promise(r => setTimeout(r, 50));
        }
        openPriceCache.date = today;
        openPriceCache.prices = prices;
    }

    const tickersWithChange = validTickers.map(t => {
        const lastPrice = parseFloat(t.price);
        const openPrice = openPriceCache.prices[t.symbol];
        let percent = 0;
        let change = 0;
        if (openPrice && openPrice > 0) {
            change = lastPrice - openPrice;
            percent = (change / openPrice) * 100;
        }
        return {
            symbol: t.symbol,
            lastPrice: t.price,
            priceChange: change.toString(),
            priceChangePercent: percent.toString(),
            volume: '0',
            quoteVolume: '0',
        };
    });

    return tickersWithChange
        .filter(t => openPriceCache.prices[t.symbol] !== undefined)
        .sort((a, b) => sortMultiplier * (parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)))
        .slice(0, limit);
}

export async function getTopGainers(limit: number = 10, useUtc0: boolean = false): Promise<Ticker24hr[]> {
    return getUsdtTickers24hr(limit, useUtc0, 'desc');
}

export async function getTopLosers(limit: number = 10, useUtc0: boolean = false): Promise<Ticker24hr[]> {
    return getUsdtTickers24hr(limit, useUtc0, 'asc');
}
