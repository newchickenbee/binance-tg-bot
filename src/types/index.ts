export interface MarketTicker {
  symbol: string;      // Unified: BTC-USDT
  price: number;
  open24h: number;
  vol24h: number;      // In USD usually
  change24h: number;   // Percentage
  exchange: string;    // 'OKX' | 'Binance'
  rawSymbol?: string;  // Internal ID (e.g. BTC-USDT-SWAP)
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;      // 0.0001 = 0.01%
  nextFundingTime: number;  // Timestamp
  predictedRate?: number;
  exchange: string;
}

export interface OpenInterest {
  symbol: string;
  oiCcy: number; // OI in Coin
  oiUsd: number; // OI in USD
  timestamp: number;
  exchange: string;
}

export interface ExchangeAdapter {
  name: string;
  getFundingRates(symbols: string[]): Promise<FundingRate[]>;
  getOpenInterests(symbols: string[]): Promise<OpenInterest[]>;
  getTopTickers(limit: number): Promise<MarketTicker[]>;
}

export interface DashboardData {
  tickers: MarketTicker[];
  fundingRates: Record<string, FundingRate>;
  openInterests: Record<string, OpenInterest>;
}
