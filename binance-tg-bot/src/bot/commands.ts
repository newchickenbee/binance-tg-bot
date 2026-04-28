import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { IS_TESTNET } from '../config';
import { getAccountInfo, getPositions, setLeverage, setMarginType } from '../binance/account';
import { placeOrder, cancelOrder, cancelAllOrders, getOpenOrders } from '../binance/order';
import { getPrice, getFundingRate, getTopGainers, getTopLosers, getTopAmplitude, calcQuantityByUSDT } from '../binance/market';
import { formatPrice, formatUSDT, pnlEmoji, formatPct, formatTime } from '../utils/format';

const NETWORK_BADGE = IS_TESTNET ? '🧪 TESTNET' : '🔴 MAINNET';

/**
 * Main persistent menu keyboard
 */
const MAIN_MENU = new Keyboard()
    .text('💰 账户余额').text('📊 当前持仓').row()
    .text('📈 涨幅榜').text('📉 跌幅榜').text('🌊 振幅榜').row()
    .text('📋 我的挂单').text('❓ 帮助').row()
    .resized();

export function registerCommands(bot: Bot): void {
    bot.command('start', async (ctx) => {
        const welcome = [
            `🤖 *Binance Futures Bot* (${NETWORK_BADGE})`,
            '',
            '已为你加载主菜单，点击下方按钮即可快速查询。',
            '',
            '📊 *查询命令*',
            '/balance — 账户余额',
            '/positions — 当前持仓',
            '/gainers — 涨幅榜',
            '/losers — 跌幅榜',
            '/amplitude — 振幅榜',
            '/orders — 当前挂单',
            '',
            '📈 *交易命令*',
            '/long `BTCUSDT` `0.01` (或 `100u`) — 做多',
            '/short `BTCUSDT` `100u` — 做空',
            '/close `BTCUSDT` — 市价平仓',
        ];
        await ctx.reply(welcome.join('\n'), { 
            parse_mode: 'Markdown',
            reply_markup: MAIN_MENU
        });
    });

    bot.hears(['❓ 帮助', '/help'], async (ctx) => {
        await ctx.reply('发送 /start 重新唤起主菜单');
    });

    // ─── Account Commands ───

    bot.hears(['💰 账户余额', '/balance'], async (ctx) => {
        const account = await getAccountInfo();
        const usdt = account.assets?.find(a => a.asset === 'USDT');
        const lines = [
            `💰 *账户概览* (${NETWORK_BADGE})`,
            '',
            `总权益: ${formatUSDT(account.totalMarginBalance)}`,
            `钱包余额: ${formatUSDT(account.totalWalletBalance)}`,
            `未实现盈亏: ${formatUSDT(account.totalUnrealizedProfit)}`,
            `可用余额: ${formatUSDT(account.availableBalance)}`,
        ];
        if (usdt) {
            lines.push('', `USDT 余额: ${formatUSDT(usdt.walletBalance)}`);
        }
        await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    });

    bot.hears(['📊 当前持仓', '/positions'], async (ctx) => {
        const positions = await getPositions();
        if (positions.length === 0) {
            await ctx.reply('📭 当前无持仓');
            return;
        }

        const lines = [`📊 *当前持仓* (${NETWORK_BADGE})\n`];
        for (const p of positions) {
            const amt = parseFloat(p.positionAmt);
            const pnl = parseFloat(p.unRealizedProfit);
            const entry = parseFloat(p.entryPrice);
            const mark = parseFloat(p.markPrice);
            const pnlPct = entry > 0 ? (pnl / (Math.abs(amt) * entry)) * 100 : 0;
            const direction = amt > 0 ? '🟢 LONG' : '🔴 SHORT';

            lines.push(
                `*${p.symbol}* ${direction}`,
                `  数量: ${p.positionAmt} | 杠杆: ${p.leverage}x`,
                `  入场: ${formatPrice(entry)} → 标记: ${formatPrice(mark)}`,
                `  盈亏: ${pnlEmoji(pnl)} ${formatUSDT(pnl)} (${formatPct(pnlPct)})`,
                `  强平价: ${formatPrice(p.liquidationPrice)}`,
                `  持仓价值: ${formatUSDT(p.notional)}`,
                '',
            );
        }
        await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    });

    // ─── Market Commands ───

    bot.command('price', async (ctx) => {
        const symbol = ctx.match?.toUpperCase();
        if (!symbol) {
            await ctx.reply('用法: /price BTCUSDT');
            return;
        }
        const data = await getPrice(symbol);
        await ctx.reply(`💲 *${symbol}*: ${formatUSDT(data.price)}`, { parse_mode: 'Markdown' });
    });

    bot.command('funding', async (ctx) => {
        const symbol = ctx.match?.toUpperCase();
        if (!symbol) {
            await ctx.reply('用法: /funding BTCUSDT');
            return;
        }
        const data = await getFundingRate(symbol);
        const nextTime = formatTime(data.nextFundingTime);
        const lines = [
            `📊 *${symbol} 资金费率*`,
            `标记价: ${formatUSDT(data.markPrice)}`,
            `费率: ${data.fundingRate}%`,
            `下次收取: ${nextTime}`,
        ];
        await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    });

    bot.hears(['📈 涨幅榜', '/gainers'], async (ctx) => {
        try {
            const limit = 10;
            // First time of the day this is called, it may take 1-2 seconds to cache UTC0 open prices
            const topGainers = await getTopGainers(limit, true);

            const lines = [`📈 *今日涨幅前 ${limit} (UTC0)* (${NETWORK_BADGE})\n`];
            for (let i = 0; i < topGainers.length; i++) {
                const g = topGainers[i];
                const pct = parseFloat(g.priceChangePercent);
                const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
                lines.push(`*${i + 1}.* \`${g.symbol}\`: ${formatPrice(parseFloat(g.lastPrice))} (${pctStr})`);
            }

            await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
        } catch (err: any) {
            await ctx.reply(`❌ 获取涨幅榜失败: ${err.message}`);
        }
    });

    bot.hears(['📉 跌幅榜', '/losers'], async (ctx) => {
        try {
            const limit = 10;
            const topLosers = await getTopLosers(limit, true);

            const lines = [`📉 *今日跌幅前 ${limit} (UTC0)* (${NETWORK_BADGE})\n`];
            for (let i = 0; i < topLosers.length; i++) {
                const t = topLosers[i];
                const pct = parseFloat(t.priceChangePercent);
                const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
                lines.push(`*${i + 1}.* \`${t.symbol}\`: ${formatPrice(parseFloat(t.lastPrice))} (${pctStr})`);
            }

            await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
        } catch (err: any) {
            await ctx.reply(`❌ 获取跌幅榜失败: ${err.message}`);
        }
    });

    bot.hears(['🌊 振幅榜', '/amplitude'], async (ctx) => {
        try {
            const limit = 10;
            const topAmplitude = await getTopAmplitude(limit, true);

            const lines = [`🌊 *今日振幅前 ${limit} (UTC0)* (${NETWORK_BADGE})\n`];
            for (let i = 0; i < topAmplitude.length; i++) {
                const a = topAmplitude[i];
                const pct = parseFloat(a.amplitudePercent);
                lines.push(`*${i + 1}.* \`${a.symbol}\`: ${formatPrice(parseFloat(a.lastPrice))} (振幅: ${pct.toFixed(2)}%)`);
            }

            await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
        } catch (err: any) {
            await ctx.reply(`❌ 获取振幅榜失败: ${err.message}`);
        }
    });

    // ─── Trading Commands ───

    bot.command('long', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /long BTCUSDT 0.01 [限价] 或者 /long BTCUSDT 100u [限价]');
            return;
        }
        const [symbol, qtyStr, priceStr] = args;
        const isLimit = priceStr !== undefined;

        let quantity: number;
        let displayQty: string;
        try {
            if (qtyStr.toLowerCase().endsWith('u')) {
                const usdtAmount = parseFloat(qtyStr.replace(/u/i, ''));
                const limitPrice = isLimit ? parseFloat(priceStr!) : undefined;
                quantity = await calcQuantityByUSDT(symbol, usdtAmount, limitPrice);
                displayQty = `${usdtAmount}U ≈ ${quantity}`;
            } else {
                quantity = parseFloat(qtyStr);
                displayQty = quantity.toString();
            }
        } catch (err: any) {
            await ctx.reply(`❌ 数量计算失败: ${err.message}`);
            return;
        }

        const confirmId = `confirm_long_${symbol}_${quantity}_${priceStr || 'market'}`;

        const keyboard = new InlineKeyboard()
            .text('✅ 确认下单', confirmId)
            .text('❌ 取消', 'cancel_order');

        const typeLabel = isLimit ? `限价 ${formatUSDT(priceStr!)}` : '市价';
        await ctx.reply(
            `🟢 *确认做多?*\n\n币对: ${symbol!.toUpperCase()}\n数量: ${displayQty}\n类型: ${typeLabel}`,
            { parse_mode: 'Markdown', reply_markup: keyboard },
        );
    });

    bot.command('short', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /short BTCUSDT 0.01 [限价] 或者 /short BTCUSDT 100u [限价]');
            return;
        }
        const [symbol, qtyStr, priceStr] = args;
        const isLimit = priceStr !== undefined;

        let quantity: number;
        let displayQty: string;
        try {
            if (qtyStr.toLowerCase().endsWith('u')) {
                const usdtAmount = parseFloat(qtyStr.replace(/u/i, ''));
                const limitPrice = isLimit ? parseFloat(priceStr!) : undefined;
                quantity = await calcQuantityByUSDT(symbol, usdtAmount, limitPrice);
                displayQty = `${usdtAmount}U ≈ ${quantity}`;
            } else {
                quantity = parseFloat(qtyStr);
                displayQty = quantity.toString();
            }
        } catch (err: any) {
            await ctx.reply(`❌ 数量计算失败: ${err.message}`);
            return;
        }

        const confirmId = `confirm_short_${symbol}_${quantity}_${priceStr || 'market'}`;

        const keyboard = new InlineKeyboard()
            .text('✅ 确认下单', confirmId)
            .text('❌ 取消', 'cancel_order');

        const typeLabel = isLimit ? `限价 ${formatUSDT(priceStr!)}` : '市价';
        await ctx.reply(
            `🔴 *确认做空?*\n\n币对: ${symbol!.toUpperCase()}\n数量: ${displayQty}\n类型: ${typeLabel}`,
            { parse_mode: 'Markdown', reply_markup: keyboard },
        );
    });

    bot.command('close', async (ctx) => {
        const symbol = ctx.match?.toUpperCase();
        if (!symbol) {
            await ctx.reply('用法: /close BTCUSDT');
            return;
        }

        const keyboard = new InlineKeyboard()
            .text('✅ 确认平仓', `confirm_close_${symbol}`)
            .text('❌ 取消', 'cancel_order');

        await ctx.reply(`⚠️ *确认市价平仓 ${symbol}?*`, { parse_mode: 'Markdown', reply_markup: keyboard });
    });

    bot.command('tp', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /tp BTCUSDT 70000');
            return;
        }
        const [symbol, priceStr] = args;
        const stopPrice = parseFloat(priceStr);
        const result = await placeOrder({
            symbol: symbol!.toUpperCase(),
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            stopPrice,
            closePosition: true,
        });
        await ctx.reply(`✅ 止盈已设置\n订单ID: ${result.orderId}\n触发价: ${formatUSDT(stopPrice)}`);
    });

    bot.command('sl', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /sl BTCUSDT 55000');
            return;
        }
        const [symbol, priceStr] = args;
        const stopPrice = parseFloat(priceStr);
        const result = await placeOrder({
            symbol: symbol!.toUpperCase(),
            side: 'SELL',
            type: 'STOP_MARKET',
            stopPrice,
            closePosition: true,
        });
        await ctx.reply(`✅ 止损已设置\n订单ID: ${result.orderId}\n触发价: ${formatUSDT(stopPrice)}`);
    });

    // ─── Order Management ───

    bot.hears(['📋 我的挂单', '/orders'], async (ctx) => {
        const match = ctx.match;
        const symbol = (typeof match === 'string' && !['📋 我的挂单', '/orders'].includes(match)) ? match.toUpperCase() : undefined;
        const orders = await getOpenOrders(symbol);
        if (orders.length === 0) {
            await ctx.reply('📭 当前无挂单');
            return;
        }

        const lines = ['📋 *当前挂单*\n'];
        for (const o of orders) {
            lines.push(
                `*${o.symbol}* ${o.side} ${o.type}`,
                `  ID: \`${o.orderId}\``,
                `  价格: ${formatUSDT(o.price)} | 数量: ${o.origQty}`,
                `  状态: ${o.status}`,
                '',
            );
        }
        await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    });

    bot.command('cancel', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /cancel BTCUSDT 12345');
            return;
        }
        const [symbol, orderIdStr] = args;
        const result = await cancelOrder(symbol!.toUpperCase(), parseInt(orderIdStr, 10));
        await ctx.reply(`✅ 订单已撤销: ${result.orderId}`);
    });

    bot.command('cancelall', async (ctx) => {
        const symbol = ctx.match?.toUpperCase();
        if (!symbol) {
            await ctx.reply('用法: /cancelall BTCUSDT');
            return;
        }
        await cancelAllOrders(symbol);
        await ctx.reply(`✅ 已撤销 ${symbol} 全部挂单`);
    });

    // ─── Settings ───

    bot.command('leverage', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /leverage BTCUSDT 10');
            return;
        }
        const [symbol, levStr] = args;
        const result = await setLeverage(symbol!.toUpperCase(), parseInt(levStr, 10));
        await ctx.reply(`✅ ${result.symbol} 杠杆已设为 ${result.leverage}x`);
    });

    bot.command('margin', async (ctx) => {
        const args = (ctx.match || '').split(/\s+/);
        if (args.length < 2) {
            await ctx.reply('用法: /margin BTCUSDT cross|isolated');
            return;
        }
        const [symbol, mode] = args;
        const marginType = mode!.toUpperCase() === 'CROSS' ? 'CROSSED' : 'ISOLATED';
        await setMarginType(symbol!.toUpperCase(), marginType);
        await ctx.reply(`✅ ${symbol!.toUpperCase()} 保证金模式: ${marginType}`);
    });
}
