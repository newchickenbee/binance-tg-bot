import { Context, NextFunction } from 'grammy';
import { ALLOWED_USER_IDS } from '../config';

/**
 * Auth middleware — blocks unauthorized users.
 * If ALLOWED_USER_IDS is empty, allows all (dangerous, dev only).
 */
export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'unknown';
    const text = ctx.message?.text || 'non-text update';

    console.log(`[Bot] Incoming from ${username} (${userId}): ${text}`);

    if (!userId) {
        return;
    }

    if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
        await ctx.reply('⛔ Unauthorized. This bot is private.');
        return;
    }

    await next();
}

/**
 * Error handler middleware — catches all exceptions and sends friendly message.
 */
export async function errorHandler(ctx: Context, next: NextFunction): Promise<void> {
    try {
        await next();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Bot Error] ${message}`, error);
        await ctx.reply(`❌ Error: ${message}`);
    }
}
