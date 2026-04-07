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

const openPriceCache: { date: string; prices: Record<string, number> } = {
    date: '',
    prices: {},
};

export async function getTopGainers(limit: number = 10, useUtc0: boolean = false): Promise<Ticker24hr[]> {
    if (!useUtc0) {
        const data = await publicRequest<Ticker24hr[]>('/fapi/v1/ticker/24hr');
        return data
            .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
            .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
            .slice(0, limit);
    } else {
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
                // Wait briefly to avoid hitting rate limits
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
            .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
            .slice(0, limit);
    }
}
