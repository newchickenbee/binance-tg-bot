import { NextResponse } from 'next/server';
import { OKXAdapter } from '@/lib/exchanges/okx';
import { DashboardData } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const adapter = new OKXAdapter();

  try {
    // 1. Get Top Tickers
    // Limit to 15 to be safe with rate limits (15 tickers -> 3 batches of 5 for details)
    const tickers = await adapter.getTopTickers(15);
    const symbols = tickers.map(t => t.rawSymbol!).filter(Boolean);
    
    // 2. Fetch details in parallel
    const [fundingRatesArr, oiArr] = await Promise.all([
      adapter.getFundingRates(symbols),
      adapter.getOpenInterests(symbols)
    ]);

    // 3. Transform to map for easier lookup
    const fundingRates = fundingRatesArr.reduce((acc, curr) => {
      acc[curr.symbol] = curr;
      return acc;
    }, {} as Record<string, any>);

    const openInterests = oiArr.reduce((acc, curr) => {
      acc[curr.symbol] = curr;
      return acc;
    }, {} as Record<string, any>);

    const data: DashboardData = {
      tickers,
      fundingRates,
      openInterests
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
