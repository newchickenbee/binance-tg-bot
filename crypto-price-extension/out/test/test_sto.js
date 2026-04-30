"use strict";
// @ts-nocheck
/**

 * Quick diagnostic script to trace STO symbol resolution across all 3 exchanges.
 * Run with: npx ts-node src/test/test_sto.ts
 */
async function testOkx(symbol) {
    const basePair = symbol.includes('-') ? symbol : `${symbol}-USDT`;
    const swapId = `${basePair}-SWAP`;
    console.log(`\n=== OKX ===`);
    console.log(`  basePair: ${basePair}`);
    console.log(`  swapId:   ${swapId}`);
    // Spot
    const spotUrl = `https://www.okx.com/api/v5/market/ticker?instId=${basePair}`;
    console.log(`  [Spot] ${spotUrl}`);
    try {
        const res = await (await fetch(spotUrl)).json();
        console.log(`  [Spot] code=${res.code}, data.length=${res.data?.length || 0}`);
        if (res.code === '0' && res.data?.length) {
            console.log(`  [Spot] ✅ Found! last=${res.data[0].last}`);
            return;
        }
        console.log(`  [Spot] ❌ Not found. msg=${res.msg}`);
    }
    catch (e) {
        console.log(`  [Spot] ❌ Error: ${e.message}`);
    }
    // SWAP
    const swapUrl = `https://www.okx.com/api/v5/market/ticker?instId=${swapId}`;
    console.log(`  [SWAP] ${swapUrl}`);
    try {
        const res = await (await fetch(swapUrl)).json();
        console.log(`  [SWAP] code=${res.code}, data.length=${res.data?.length || 0}`);
        if (res.code === '0' && res.data?.length) {
            console.log(`  [SWAP] ✅ Found! last=${res.data[0].last}`);
            return;
        }
        console.log(`  [SWAP] ❌ Not found. msg=${res.msg}`);
    }
    catch (e) {
        console.log(`  [SWAP] ❌ Error: ${e.message}`);
    }
}
async function testBinance(symbol) {
    const binanceSymbol = symbol.includes('-') ? symbol.replace('-', '') : `${symbol}USDT`;
    console.log(`\n=== Binance ===`);
    console.log(`  binanceSymbol: ${binanceSymbol}`);
    // Spot
    const spotUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
    console.log(`  [Spot] ${spotUrl}`);
    try {
        const res = await fetch(spotUrl);
        if (res.ok) {
            const data = await res.json();
            console.log(`  [Spot] ✅ Found! lastPrice=${data.lastPrice}`);
            return;
        }
        const err = await res.json();
        console.log(`  [Spot] ❌ HTTP ${res.status}. msg=${err.msg}`);
    }
    catch (e) {
        console.log(`  [Spot] ❌ Error: ${e.message}`);
    }
    // Futures
    const futuresUrl = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${binanceSymbol}`;
    console.log(`  [Futures] ${futuresUrl}`);
    try {
        const res = await fetch(futuresUrl);
        if (res.ok) {
            const data = await res.json();
            console.log(`  [Futures] ✅ Found! lastPrice=${data.lastPrice}`);
            return;
        }
        const err = await res.json();
        console.log(`  [Futures] ❌ HTTP ${res.status}. msg=${err.msg}`);
    }
    catch (e) {
        console.log(`  [Futures] ❌ Error: ${e.message}`);
    }
}
async function testHyperliquid(symbol) {
    const coin = symbol.split('-')[0].toUpperCase();
    console.log(`\n=== Hyperliquid ===`);
    console.log(`  coin: ${coin}`);
    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        });
        if (!res.ok) {
            console.log(`  ❌ HTTP ${res.status}`);
            return;
        }
        const data = await res.json();
        const universe = data[0]?.universe;
        if (!Array.isArray(universe)) {
            console.log(`  ❌ Invalid response structure`);
            return;
        }
        const idx = universe.findIndex((u) => u.name === coin);
        if (idx >= 0) {
            const ctx = data[1][idx];
            console.log(`  ✅ Found! markPx=${ctx.markPx}, funding=${ctx.funding}`);
        }
        else {
            // Show available coins that start with 'S' for reference
            const sCoin = universe.filter((u) => u.name.startsWith('S')).map((u) => u.name);
            console.log(`  ❌ "${coin}" not found.`);
            console.log(`  Available S* coins: ${sCoin.join(', ')}`);
        }
    }
    catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
    }
}
async function main() {
    const symbol = process.argv[2] || 'STO';
    console.log(`🔍 Testing symbol: "${symbol}"\n`);
    await testOkx(symbol);
    await testBinance(symbol);
    await testHyperliquid(symbol);
    console.log('\n--- Done ---');
}
main();
//# sourceMappingURL=test_sto.js.map