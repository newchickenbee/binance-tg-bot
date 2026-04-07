import * as crypto from 'crypto';
import { BINANCE_API_KEY, BINANCE_API_SECRET, BASE_URL } from '../config';

function generateSignature(queryString: string): string {
    return crypto
        .createHmac('sha256', BINANCE_API_SECRET)
        .update(queryString)
        .digest('hex');
}

function buildQueryString(params: Record<string, string | number | boolean>): string {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
}

export interface BinanceError {
    code: number;
    msg: string;
}

/**
 * Make a signed request to Binance Futures API.
 * Automatically injects timestamp and HMAC signature.
 */
export async function signedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    params: Record<string, string | number | boolean> = {},
): Promise<T> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const queryString = buildQueryString(allParams);
    const signature = generateSignature(queryString);
    const signedQuery = `${queryString}&signature=${signature}`;

    const url = method === 'GET' || method === 'DELETE'
        ? `${BASE_URL}${path}?${signedQuery}`
        : `${BASE_URL}${path}`;

    const headers: Record<string, string> = {
        'X-MBX-APIKEY': BINANCE_API_KEY,
    };

    const options: RequestInit = { method, headers };

    if (method === 'POST' || method === 'PUT') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = signedQuery;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        const err = data as BinanceError;
        throw new Error(`Binance API Error [${err.code}]: ${err.msg}`);
    }

    return data as T;
}

/**
 * Make a public (unsigned) request to Binance Futures API.
 */
export async function publicRequest<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const queryString = buildQueryString(params);
    const url = queryString ? `${BASE_URL}${path}?${queryString}` : `${BASE_URL}${path}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        const err = data as BinanceError;
        throw new Error(`Binance API Error [${err.code}]: ${err.msg}`);
    }

    return data as T;
}
