import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDailySummary } from '../binance/market';
import { ALLOWED_USER_IDS, IS_TESTNET } from '../config';
import { formatPrice } from '../utils/format';
import * as fs from 'fs/promises';
import path from 'path';

const NETWORK_BADGE = IS_TESTNET ? '🧪 TESTNET' : '🔴 MAINNET';
const STATS_FILE = path.join(__dirname, '../../data/stats.json');

async function saveStats(date: string, data: any) {
    let stats: Record<string, any> = {};
    try {
        const content = await fs.readFile(STATS_FILE, 'utf-8');
        stats = JSON.parse(content);
    } catch (err) {
        // File might not exist yet
    }
    stats[date] = data;
    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
}

export function setupScheduler(bot: Bot) {
    // Schedule task at 00:00:10 UTC every day
    cron.schedule('10 0 0 * * *', async () => {
        console.log('🕒 Running Daily Market Summary (UTC0)...');
        try {
            const limit = 10;
            const { gainers, losers } = await getDailySummary(limit);

            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];

            // 1. Save to local statistics file
            await saveStats(dateStr, { gainers, losers });

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

            // 2. Send to all allowed users
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
