import { signedRequest } from './client';

export interface FuturesBalance {
    asset: string;
    walletBalance: string;
    unrealizedProfit: string;
    marginBalance: string;
    availableBalance: string;
    crossUnPnl: string;
}

export interface AccountInfo {
    totalWalletBalance: string;
    totalUnrealizedProfit: string;
    totalMarginBalance: string;
    availableBalance: string;
    assets: FuturesBalance[];
}

export interface PositionInfo {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    liquidationPrice: string;
    leverage: string;
    marginType: string;
    positionSide: string;
    notional: string;
}

export async function getAccountInfo(): Promise<AccountInfo> {
    return signedRequest<AccountInfo>('GET', '/fapi/v3/account');
}

export async function getPositions(): Promise<PositionInfo[]> {
    const all = await signedRequest<PositionInfo[]>('GET', '/fapi/v3/positionRisk');
    return all.filter(p => parseFloat(p.positionAmt) !== 0);
}

export async function setLeverage(symbol: string, leverage: number): Promise<{ leverage: number; symbol: string }> {
    return signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage });
}

export async function setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<{ code: number; msg: string }> {
    return signedRequest('POST', '/fapi/v1/marginType', { symbol, marginType });
}
