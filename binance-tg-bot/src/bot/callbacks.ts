import { Bot } from 'grammy';
import { placeOrder } from '../binance/order';
import { getPositions } from '../binance/account';
import { formatUSDT } from '../utils/format';

/**
 * Register inline keyboard callback handlers.
 * Handles order confirmations and cancellations.
 */
export function registerCallbacks(bot: Bot): void {

    // Cancel button — just delete the confirmation message
    bot.callbackQuery('cancel_order', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.answerCallbackQuery({ text: '已取消' });
    });

    // Confirm long: confirm_long_{SYMBOL}_{QTY}_{PRICE|market}
    bot.callbackQuery(/^confirm_long_(.+)_(.+)_(.+)$/, async (ctx) => {
        const [symbol, qtyStr, priceStr] = ctx.match.slice(1);
        const quantity = parseFloat(qtyStr);
        const isMarket = priceStr === 'market';

        await ctx.answerCallbackQuery({ text: '下单中...' });
        await ctx.deleteMessage();

        const result = await placeOrder({
            symbol: symbol.toUpperCase(),
            side: 'BUY',
            type: isMarket ? 'MARKET' : 'LIMIT',
            quantity,
            price: isMarket ? undefined : parseFloat(priceStr),
            timeInForce: isMarket ? undefined : 'GTC',
        });

        await ctx.reply(
            `✅ *做多成功*\n\n` +
            `币对: ${result.symbol}\n` +
            `订单ID: \`${result.orderId}\`\n` +
            `数量: ${result.origQty}\n` +
            `类型: ${result.type}\n` +
            `状态: ${result.status}`,
            { parse_mode: 'Markdown' },
        );
    });

    // Confirm short: confirm_short_{SYMBOL}_{QTY}_{PRICE|market}
    bot.callbackQuery(/^confirm_short_(.+)_(.+)_(.+)$/, async (ctx) => {
        const [symbol, qtyStr, priceStr] = ctx.match.slice(1);
        const quantity = parseFloat(qtyStr);
        const isMarket = priceStr === 'market';

        await ctx.answerCallbackQuery({ text: '下单中...' });
        await ctx.deleteMessage();

        const result = await placeOrder({
            symbol: symbol.toUpperCase(),
            side: 'SELL',
            type: isMarket ? 'MARKET' : 'LIMIT',
            quantity,
            price: isMarket ? undefined : parseFloat(priceStr),
            timeInForce: isMarket ? undefined : 'GTC',
        });

        await ctx.reply(
            `✅ *做空成功*\n\n` +
            `币对: ${result.symbol}\n` +
            `订单ID: \`${result.orderId}\`\n` +
            `数量: ${result.origQty}\n` +
            `类型: ${result.type}\n` +
            `状态: ${result.status}`,
            { parse_mode: 'Markdown' },
        );
    });

    // Confirm close: confirm_close_{SYMBOL}
    bot.callbackQuery(/^confirm_close_(.+)$/, async (ctx) => {
        const symbol = ctx.match[1].toUpperCase();

        await ctx.answerCallbackQuery({ text: '平仓中...' });
        await ctx.deleteMessage();

        // Find the current position to determine direction and quantity
        const positions = await getPositions();
        const position = positions.find(p => p.symbol === symbol);

        if (!position) {
            await ctx.reply(`❌ 未找到 ${symbol} 的持仓`);
            return;
        }

        const amt = parseFloat(position.positionAmt);
        const closeSide = amt > 0 ? 'SELL' : 'BUY';
        const closeQty = Math.abs(amt);

        const result = await placeOrder({
            symbol,
            side: closeSide,
            type: 'MARKET',
            quantity: closeQty,
            reduceOnly: true,
        });

        await ctx.reply(
            `✅ *平仓成功*\n\n` +
            `币对: ${result.symbol}\n` +
            `订单ID: \`${result.orderId}\`\n` +
            `平仓数量: ${result.origQty}\n` +
            `方向: ${closeSide}\n` +
            `状态: ${result.status}`,
            { parse_mode: 'Markdown' },
        );
    });
}
