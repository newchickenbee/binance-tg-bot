import { getTopGainers } from './src/binance/market';
import { formatPrice, formatVolume } from './src/utils/format';

async function test() {
    console.log('Fetching from MAINNET...');
    const topGainers = await getTopGainers(10, true);

    console.log('--- Real Binance Top 10 Gainers (UTC0) ---');
    topGainers.forEach((g, i) => {
        console.log(`${i + 1}. ${g.symbol}: ${formatPrice(parseFloat(g.lastPrice))} (Change: ${parseFloat(g.priceChangePercent).toFixed(2)}%) | Vol: ${formatVolume(g.quoteVolume)}`);
    });
}

test().catch(console.error);
