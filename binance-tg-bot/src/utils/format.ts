const SIGNIFICANT_DIGITS_THRESHOLD = 0.001;

/**
 * Smart format for crypto prices — adapts decimal places to magnitude.
 */
export function formatPrice(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '0.00';

    const abs = Math.abs(num);
    if (abs >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (abs >= 1) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (abs >= SIGNIFICANT_DIGITS_THRESHOLD) return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return num.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

/**
 * Format USDT amount with $ prefix.
 */
export function formatUSDT(value: number | string): string {
    return `$${formatPrice(value)}`;
}

/**
 * PnL indicator emoji.
 */
export function pnlEmoji(value: number): string {
    if (value > 0) return '🟢';
    if (value < 0) return '🔴';
    return '⚪';
}

/**
 * Format percentage with sign.
 */
export function formatPct(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format timestamp to readable string.
 */
export function formatTime(ms: number): string {
    return new Date(ms).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}
