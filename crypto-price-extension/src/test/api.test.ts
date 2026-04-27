
import { fetchPrices } from '../api';

// Mock the global fetch
global.fetch = jest.fn();

describe('fetchPrices', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
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

        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const symbols = ['BTC-USDT'];
        const prices = await fetchPrices(symbols);

        expect(prices.size).toBe(1);
        expect(prices.get('BTC-USDT')).toBeDefined();
        expect(prices.get('BTC-USDT')?.last).toBe('95000');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const symbols = ['ETH-USDT'];
        const prices = await fetchPrices(symbols);

        expect(prices.size).toBe(0);
    });
});
