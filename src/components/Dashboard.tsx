'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardData } from '@/types';
import { ArrowUp, ArrowDown, Loader2, Eye, EyeOff } from 'lucide-react';
import { formatCryptoPrice } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const [isVisible, setIsVisible] = useState(true);
  const { data, error, isLoading } = useSWR<DashboardData>('/api/market/dashboard', fetcher, {
    refreshInterval: 10000, // 10s refresh
  });

  if (error) return <div className="p-8 text-center text-red-500">Failed to load market data. Please try again later.</div>;
  
  if (isLoading || !data) return (
    <div className="flex h-screen items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--foreground)]" />
        <p className="text-[var(--muted-foreground)]">Aggregating Exchange Data...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen">
      <header className="mb-8 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            aiTradeVersus
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">Real-time Derivatives Analytics (OKX)</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsVisible(!isVisible)}
            className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--accent)] transition-all text-[var(--foreground)]"
            title={isVisible ? "Hide Balances" : "Show Balances"}
          >
            {isVisible ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <div className="text-right">
             <div className="text-sm text-[var(--muted-foreground)]">Updated: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </header>
      
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-[var(--muted)] text-[var(--muted-foreground)] uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="px-6 py-4">Symbol</th>
              <th className="px-6 py-4 text-right">Price</th>
              <th className="px-6 py-4 text-right">24h Change</th>
              <th className="px-6 py-4 text-right">Funding Rate</th>
              <th className="px-6 py-4 text-right">Open Interest</th>
              <th className="px-6 py-4 text-right">Next Funding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.tickers.map((ticker) => {
              const funding = data.fundingRates[ticker.symbol];
              const oi = data.openInterests[ticker.symbol];
              const isPositive = ticker.change24h >= 0;
              const fundingRate = funding?.fundingRate || 0;
              const isHighFunding = Math.abs(fundingRate) > 0.0001; // Highlight if > 0.01%
              
              return (
                <tr key={ticker.symbol} className="hover:bg-[var(--accent)] transition-colors group">
                  <td className="px-6 py-4 font-medium">
                     <div className="flex items-center gap-2">
                         {/* Placeholder for Icon */}
                         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 border border-gray-700">
                             {ticker.symbol.substring(0,1)}
                         </div>
                         <div className="flex flex-col">
                             <span className="text-base text-white">{ticker.symbol.split('-')[0]}</span>
                             <span className="text-xs text-[var(--muted-foreground)]">Perpetual</span>
                         </div>
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-base text-[var(--foreground)]">
                    {isVisible ? `$${formatCryptoPrice(ticker.price)}` : '****'}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono text-sm font-medium ${isPositive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {isVisible ? (
                        <>
                          {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {Math.abs(ticker.change24h * 100).toFixed(2)}%
                        </>
                      ) : '****'}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono text-sm`}>
                     <div className={`inline-block px-2 py-1 rounded ${fundingRate > 0 ? 'bg-[var(--positive)]/10 text-[var(--positive)]' : (fundingRate < 0 ? 'bg-[var(--negative)]/10 text-[var(--negative)]' : 'text-gray-400')}`}>
                        {isVisible ? `${(fundingRate * 100).toFixed(4)}%` : '****'}
                     </div>
                  </td>
                   <td className="px-6 py-4 text-right font-mono text-[var(--foreground)]">
                    {isVisible ? (oi ? `$${(oi.oiUsd / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M` : '-') : '****'}
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--muted-foreground)] font-mono text-xs">
                    {funding ? (
                        <span className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">
                            {new Date(funding.nextFundingTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
