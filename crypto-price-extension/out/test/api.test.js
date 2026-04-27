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
        const mockResponse = {
            code: '0',
            data: [{
                    instId: 'BTC-USDT-SWAP',
                    last: '95000',
                    open24h: '93000',
                    low24h: '92000',
                    high24h: '96000'
                }]
        };
        global.fetch.mockResolvedValue({
            json: jest.fn().mockResolvedValue(mockResponse)
        });
        const symbols = ['BTC-USDT'];
        const prices = await (0, api_1.fetchPrices)(symbols);
        expect(prices.size).toBe(1);
        expect(prices.get('BTC-USDT')).toBeDefined();
        expect(prices.get('BTC-USDT')?.last).toBe('95000');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    it('should handle API errors gracefully', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));
        const symbols = ['ETH-USDT'];
        const prices = await (0, api_1.fetchPrices)(symbols);
        expect(prices.size).toBe(0);
    });
});
//# sourceMappingURL=api.test.js.map