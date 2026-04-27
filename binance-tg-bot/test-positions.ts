import { signedRequest } from './src/binance/client';

async function testPositions() {
    console.log('Fetching all positions from Binance Futures...');
    try {
        const all: any[] = await signedRequest('GET', '/fapi/v2/positionRisk'); 
        
        console.log(`Total symbols returned: ${all.length}`);
        
        const xauPositions = all.filter(p => p.symbol.includes('XAU'));
        if (xauPositions.length > 0) {
            console.log('\n--- XAU Related Symbols Found ---');
            xauPositions.forEach(p => {
                console.log(JSON.stringify(p, null, 2));
            });
        } else {
            console.log('\n❌ No symbols containing "XAU" found in positionRisk response.');
        }

        const activePositions = all.filter(p => parseFloat(p.positionAmt) !== 0);
        console.log(`\nActive positions count: ${activePositions.length}`);
        const account: any = await signedRequest('GET', '/fapi/v2/account'); 
        console.log(`\n--- Account Info (v2) ---`);
        console.log(`Total Assets: ${account.assets ? account.assets.length : 'N/A'}`);
        console.log(`Total Wallet Balance: ${account.totalWalletBalance}`);
        console.log(`Available Balance: ${account.availableBalance}`);

    } catch (err) {
        console.error('Error fetching positions:', err);
    }
}

testPositions();
