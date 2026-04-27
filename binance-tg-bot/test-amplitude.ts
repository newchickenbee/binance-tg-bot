import { getTopAmplitude } from './src/binance/market';
import { formatPrice } from './src/utils/format';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function test() {
    console.log('Fetching Top 10 Amplitude (Volatility)...');
    try {
        const limit = 10;
        const topAmplitude = await getTopAmplitude(limit, true);

        console.log(`\n🌊 今日振幅前 ${limit} (UTC0):\n`);
        topAmplitude.forEach((a, i) => {
            const pct = parseFloat(a.amplitudePercent);
            console.log(`${i + 1}. ${a.symbol.padEnd(12)}: ${formatPrice(parseFloat(a.lastPrice)).padEnd(10)} (振幅: ${pct.toFixed(2)}%)`);
        });
    } catch (err: any) {
        console.error('Error fetching amplitude:', err.message);
    }
}

test();
