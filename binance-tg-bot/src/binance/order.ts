import { signedRequest } from './client';

export interface OrderParams {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    quantity?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    closePosition?: boolean;
    reduceOnly?: boolean;
}

export interface OrderResult {
    orderId: number;
    symbol: string;
    status: string;
    clientOrderId: string;
    price: string;
    avgPrice: string;
    origQty: string;
    executedQty: string;
    type: string;
    side: string;
    stopPrice: string;
    time: number;
}

export interface OpenOrder {
    orderId: number;
    symbol: string;
    price: string;
    origQty: string;
    executedQty: string;
    type: string;
    side: string;
    stopPrice: string;
    time: number;
    status: string;
}

export async function placeOrder(params: OrderParams): Promise<OrderResult> {
    const reqParams: Record<string, string | number | boolean> = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
    };

    if (params.quantity !== undefined) {
        reqParams['quantity'] = params.quantity;
    }
    if (params.price !== undefined) {
        reqParams['price'] = params.price;
    }
    if (params.stopPrice !== undefined) {
        reqParams['stopPrice'] = params.stopPrice;
    }
    if (params.timeInForce) {
        reqParams['timeInForce'] = params.timeInForce;
    }
    if (params.closePosition !== undefined) {
        reqParams['closePosition'] = params.closePosition;
    }
    if (params.reduceOnly !== undefined) {
        reqParams['reduceOnly'] = params.reduceOnly;
    }

    return signedRequest<OrderResult>('POST', '/fapi/v1/order', reqParams);
}

export async function cancelOrder(symbol: string, orderId: number): Promise<OrderResult> {
    return signedRequest<OrderResult>('DELETE', '/fapi/v1/order', { symbol, orderId });
}

export async function cancelAllOrders(symbol: string): Promise<{ code: number; msg: string }> {
    return signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol });
}

export async function getOpenOrders(symbol?: string): Promise<OpenOrder[]> {
    const params: Record<string, string> = {};
    if (symbol) {
        params['symbol'] = symbol;
    }
    return signedRequest<OpenOrder[]>('GET', '/fapi/v1/openOrders', params);
}
