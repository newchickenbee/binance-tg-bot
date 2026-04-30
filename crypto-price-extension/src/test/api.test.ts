
import { fetchPrices } from '../api';

// Mock the global fetch
global.fetch = jest.fn();

describe('fetchPrices', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    it('should fetch prices for multiple symbols', async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('binance.com') && url.includes('ticker')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        symbol: 'BTCUSDT',
                        lastPrice: '95000',
                        openPrice: '93000',
                        lowPrice: '92000',
                        highPrice: '96000',
                        quoteVolume: '100000000'
                    })
                });
            }
            if (url.includes('binance.com') && url.includes('klines')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        [1714291200000, '93000', '96000', '92000', '95000', '1000', 1714377599999, '100000000']
                    ])
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
            });
        });


        const symbols = ['BTC-USDT'];
        const prices = await fetchPrices(symbols);

        expect(prices.size).toBe(1);
        expect(prices.get('BTC-USDT')).toBeDefined();
        expect(prices.get('BTC-USDT')?.last).toBe('95000');
    });


    it('should handle API errors gracefully', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const symbols = ['ETH-USDT'];
        const prices = await fetchPrices(symbols);

        expect(prices.size).toBe(0);
    });
});
