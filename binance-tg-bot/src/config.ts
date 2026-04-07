import 'dotenv/config';

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const BOT_TOKEN = requireEnv('BOT_TOKEN');
export const BINANCE_API_KEY = requireEnv('BINANCE_API_KEY');
export const BINANCE_API_SECRET = requireEnv('BINANCE_API_SECRET');

export const ALLOWED_USER_IDS = (process.env['ALLOWED_USER_IDS'] || '')
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));

const network = process.env['NETWORK'] || 'testnet';

const FUTURES_URLS: Record<string, string> = {
    mainnet: 'https://fapi.binance.com',
    testnet: 'https://testnet.binancefuture.com',
};

export const BASE_URL = FUTURES_URLS[network] || FUTURES_URLS['testnet'];
export const IS_TESTNET = network === 'testnet';
