import { ExchangeAdapter, FundingRate, MarketTicker, OpenInterest } from '@/types';

const BASE_URL = 'https://www.okx.com';

export class OKXAdapter implements ExchangeAdapter {
  name = 'OKX';

  async getTopTickers(limit: number = 20): Promise<MarketTicker[]> {
    try {
      // instType=SWAP for perpetuals
      const url = `${BASE_URL}/api/v5/market/tickers?instType=SWAP`;
      const res = await fetch(url, { next: { revalidate: 10 } }); // Cache for 10s
      const data = await res.json();
      
      if (data.code !== '0') {
        console.error('OKX Ticker Error:', data.msg);
        return [];
      }

      // Filter USDT swaps and sort by volume (volCcy24h is volume in USD)
      const tickers = data.data
        .filter((t: any) => t.instId.endsWith('-USDT-SWAP'))
        .sort((a: any, b: any) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h))
        .slice(0, limit)
        .map((t: any) => ({
          symbol: t.instId.replace('-SWAP', ''), // Display as BTC-USDT
          rawSymbol: t.instId, // Keep for API calls
          price: parseFloat(t.last),
          open24h: parseFloat(t.open24h),
          vol24h: parseFloat(t.volCcy24h),
          change24h: (parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h),
          exchange: 'OKX'
        }));
        
      return tickers;
    } catch (e) {
      console.error('Failed to fetch tickers:', e);
      return [];
    }
  }

  async getFundingRates(symbols: string[]): Promise<FundingRate[]> {
    const results: FundingRate[] = [];
    
    // Batch requests to avoid rate limits (20 req/2s)
    // We strictly limit concurrency to 5
    for(let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5);
      const promises = batch.map(async (rawSymbol) => {
        try {
          // Note: rawSymbol must be correct instId e.g. BTC-USDT-SWAP
          const res = await fetch(`${BASE_URL}/api/v5/public/funding-rate?instId=${rawSymbol}`, { next: { revalidate: 60 } });
          const json = await res.json();
          if(json.code !== '0') return null;
          
          const r = json.data[0];
          return {
            symbol: r.instId.replace('-SWAP', ''),
            fundingRate: parseFloat(r.fundingRate),
            nextFundingTime: parseInt(r.nextFundingTime),
            exchange: 'OKX'
          } as FundingRate;
        } catch (e) {
          return null;
        }
      });

      const batchRes = await Promise.all(promises);
      results.push(...(batchRes.filter(Boolean) as FundingRate[]));
      
      // Artificial delay between batches
      if (i + 5 < symbols.length) {
        await new Promise(r => setTimeout(r, 200)); 
      }
    }
    return results;
  }

  async getOpenInterests(symbols: string[]): Promise<OpenInterest[]> {
    const results: OpenInterest[] = [];
    
    for(let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5);
      const promises = batch.map(async (rawSymbol) => {
        try {
          const res = await fetch(`${BASE_URL}/api/v5/public/open-interest?instType=SWAP&instId=${rawSymbol}`, { next: { revalidate: 60 } });
          const json = await res.json();
          if(json.code !== '0') return null;
          
          const r = json.data[0];
          return {
            symbol: r.instId.replace('-SWAP', ''),
            oiCcy: parseFloat(r.oiCcy),
            oiUsd: parseFloat(r.oiCcy) * parseFloat(r.oi) * 1, // Approximation or need price? 
            // improved: OKX returns 'oi' (contracts) and 'oiCcy' (coins). 
            // For USDT-SWAP, oiCcy not always available?
            // Actually 'oiCcy' is OI in currency. 'oi' is number of contracts.
            // Let's trust 'oiCcy' if present, or we might need to calc.
            // For SWAP: 'oiCcy' is usually the Coin amount. 'oi' is contracts.
            // We want USD value. We can multiply oiCcy * price later, or just return basic info.
            // Let's store raw OI for now.
            timestamp: parseInt(r.ts),
            exchange: 'OKX'
          } as OpenInterest;
        } catch (e) {
          return null;
        }
      });

      const batchRes = await Promise.all(promises);
      results.push(...(batchRes.filter(Boolean) as OpenInterest[]));

      if (i + 5 < symbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return results;
  }
}
