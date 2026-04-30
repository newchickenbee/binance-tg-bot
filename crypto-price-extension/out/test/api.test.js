"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../api");
// Mock the global fetch
global.fetch = jest.fn();
describe('fetchPrices', () => {
    beforeEach(() => {
        global.fetch.mockClear();
    });
    it('should fetch prices for multiple symbols', async () => {
        global.fetch.mockImplementation((url) => {
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
        const prices = await (0, api_1.fetchPrices)(symbols);
        expect(prices.size).toBe(1);
        expect(prices.get('BTC-USDT')).toBeDefined();
        expect(prices.get('BTC-USDT')?.last).toBe('95000');
    });
    it('should handle API errors gracefully', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));
        const symbols = ['ETH-USDT'];
        const prices = await (0, api_1.fetchPrices)(symbols);
        expect(prices.size).toBe(0);
    });
});
//# sourceMappingURL=api.test.js.map