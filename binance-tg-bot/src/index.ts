import { Bot } from 'grammy';
import { BOT_TOKEN, IS_TESTNET } from './config';
import { authMiddleware, errorHandler } from './bot/middleware';
import { registerCommands } from './bot/commands';
import { registerCallbacks } from './bot/callbacks';

const bot = new Bot(BOT_TOKEN);

// Middleware pipeline: error handler → auth → commands
bot.use(errorHandler);
bot.use(authMiddleware);

// Register all command and callback handlers
registerCommands(bot);
registerCallbacks(bot);

// Start the bot
const networkLabel = IS_TESTNET ? 'TESTNET' : 'MAINNET';
console.log(`🤖 Binance Futures TG Bot starting... [${networkLabel}]`);

bot.start({
    onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} is running on ${networkLabel}`);
    },
});
