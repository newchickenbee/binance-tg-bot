import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDailySummary } from '../binance/market';
import { ALLOWED_USER_IDS, IS_TESTNET } from '../config';
import { formatPrice } from '../utils/format';

const NETWORK_BADGE = IS_TESTNET ? '🧪 TESTNET' : '🔴 MAINNET';

export function setupScheduler(bot: Bot) {
    // Schedule task at 00:00:10 UTC every day
    // We wait 10 seconds to ensure the daily candle on Binance has closed and the new one is available
    cron.schedule('10 0 0 * * *', async () => {
        console.log('🕒 Running Daily Market Summary (UTC0)...');
        try {
            const limit = 10;
            const { gainers, losers } = await getDailySummary(limit);

            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];

            const lines = [
                `📅 *每日收盘总结 (${dateStr})*`,
                `网络: ${NETWORK_BADGE}`,
                '',
                '📈 *涨幅前十*',
            ];

            gainers.forEach((g, i) => {
                const pct = parseFloat(g.priceChangePercent);
                lines.push(`${i + 1}. \`${g.symbol}\`: ${formatPrice(parseFloat(g.lastPrice))} (+${pct.toFixed(2)}%)`);
            });

            lines.push('', '📉 *跌幅前十*');

            losers.forEach((l, i) => {
                const pct = parseFloat(l.priceChangePercent);
                lines.push(`${i + 1}. \`${l.symbol}\`: ${formatPrice(parseFloat(l.lastPrice))} (${pct.toFixed(2)}%)`);
            });

            const message = lines.join('\n');

            // Send to all allowed users
            for (const userId of ALLOWED_USER_IDS) {
                try {
                    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
                } catch (err) {
                    console.error(`Failed to send daily summary to user ${userId}:`, err);
                }
            }
        } catch (err) {
            console.error('Error in daily summary scheduler:', err);
        }
    }, {
        timezone: 'UTC'
    });
}
