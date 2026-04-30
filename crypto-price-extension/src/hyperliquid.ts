/* eslint-disable @typescript-eslint/no-explicit-any */
import { PriceData } from './api';

const HL_BASE_URL = 'https://api.hyperliquid.xyz/info';

function toHlCoin(symbol: string): string {
    return symbol.split('-')[0].toUpperCase();
}

/**
 * Fetch all prices from Hyperliquid and populate results for requested symbols.
 */
export async function fetchHyperliquidPrices(
    symbols: string[],
    results: Map<string, PriceData>
): Promise<void> {
    if (symbols.length === 0) return;

    try {
        const response = await fetch(HL_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        });

        if (!response.ok) {
            return;
        }

        const data: any = await response.json();
        if (!Array.isArray(data) || data.length < 2) {
            return;
        }

        const universe = data[0].universe;
        const assetCtxs = data[1];

        if (!Array.isArray(universe) || !Array.isArray(assetCtxs)) {
            return;
        }

        // Create a fast lookup map for all requested symbols
        const requestedCoins = new Map<string, string>(); // HL Coin -> Original Symbol
        for (const symbol of symbols) {
            requestedCoins.set(toHlCoin(symbol), symbol);
        }

        for (let i = 0; i < universe.length; i++) {
            const coinName = universe[i].name;
            const originalSymbol = requestedCoins.get(coinName);

            if (originalSymbol) {
                const ctx = assetCtxs[i];
                if (!ctx) continue;

                const last = parseFloat(ctx.markPx);
                const open24h = parseFloat(ctx.prevDayPx);
                const change24h = open24h ? ((last - open24h) / open24h * 100).toFixed(2) : '0.00';
                
                // For Hyperliquid we might not easily have UTC0 candle, so fallback to 24h changes
                const changeUtc0 = change24h; 

                // We also might not have 24h high/low natively on this endpoint without fetching candles.
                // We'll leave them as '0' for now.
                const high24h = '0';
                const low24h = '0';
                const amplitudeUtc0 = '0.00';
                
                let fundingRate: string | undefined;
                if (ctx.funding) {
                    fundingRate = (parseFloat(ctx.funding) * 100).toFixed(4);
                }

                results.set(originalSymbol, {
                    instId: `${coinName}-PERP`,
                    last: last.toString(),
                    open24h: ctx.prevDayPx,
                    change24h,
                    changeUtc0,
                    low24h,
                    high24h,
                    lowUtc0: '0',
                    highUtc0: '0',
                    amplitudeUtc0,
                    fundingRate,
                    openInterest: ctx.openInterest ? (parseFloat(ctx.openInterest) * last).toString() : undefined,
                });
            }
        }
    } catch (error) {
        console.error(`[Hyperliquid] Failed to fetch prices:`, error);
    }
}
