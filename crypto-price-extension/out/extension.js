"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const api_1 = require("./api");
const utils_1 = require("./utils");
let priceStatusBarItem;
let toggleStatusBarItem;
let updateInterval;
let isUpdating = false;
function activate(context) {
    console.log('Crypto Price Monitor is now active!');
    // Create main price status bar item
    priceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    priceStatusBarItem.command = 'cryptoPrice.refresh';
    priceStatusBarItem.tooltip = 'Click to refresh crypto price';
    context.subscriptions.push(priceStatusBarItem);
    // Create toggle visibility status bar item
    toggleStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    toggleStatusBarItem.command = 'cryptoPrice.toggleVisibility';
    context.subscriptions.push(toggleStatusBarItem);
    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('cryptoPrice.refresh', () => {
        updatePrice();
    });
    context.subscriptions.push(refreshCommand);
    // Register toggle visibility command
    const toggleCommand = vscode.commands.registerCommand('cryptoPrice.toggleVisibility', async () => {
        const config = vscode.workspace.getConfiguration('cryptoPrice');
        const currentVisibility = config.get('visible');
        await config.update('visible', !currentVisibility, vscode.ConfigurationTarget.Global);
    });
    context.subscriptions.push(toggleCommand);
    // Initial update
    updatePrice();
    updateToggleButton();
    // Set up periodic updates
    startTimer();
    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cryptoPrice')) {
            updatePrice();
            updateToggleButton();
            startTimer();
        }
    }));
}
const MIN_REFRESH_INTERVAL_SECONDS = 5;
function startTimer() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    const config = vscode.workspace.getConfiguration('cryptoPrice');
    const userInterval = config.get('interval') || MIN_REFRESH_INTERVAL_SECONDS;
    const seconds = Math.max(userInterval, MIN_REFRESH_INTERVAL_SECONDS);
    updateInterval = setInterval(() => {
        updatePrice();
    }, seconds * 1000);
}
function updateToggleButton() {
    const config = vscode.workspace.getConfiguration('cryptoPrice');
    const showButton = config.get('showToggleButton') !== false;
    const isVisible = config.get('visible') !== false;
    if (!showButton) {
        toggleStatusBarItem.hide();
        return;
    }
    toggleStatusBarItem.text = isVisible ? '$(eye)' : '$(eye-closed)';
    toggleStatusBarItem.tooltip = isVisible ? 'Hide Crypto Price' : 'Show Crypto Price';
    toggleStatusBarItem.show();
}
async function updatePrice() {
    if (isUpdating) {
        return;
    }
    const config = vscode.workspace.getConfiguration('cryptoPrice');
    const isVisible = config.get('visible') !== false;
    if (!isVisible) {
        priceStatusBarItem.hide();
        return;
    }
    const symbol = config.get('symbol') || 'BTC-USDT';
    const hoverSymbols = config.get('hoverSymbols') || [];
    // Combine symbols to fetch (unique list)
    const allSymbols = Array.from(new Set([symbol, ...hoverSymbols]));
    isUpdating = true;
    try {
        // Only show loading on first paint, keep previous text otherwise
        if (priceStatusBarItem.text === '') {
            priceStatusBarItem.text = `$(sync~spin) Loading...`;
        }
        priceStatusBarItem.show();
        const prices = await (0, api_1.fetchPrices)(allSymbols);
        // Sort: Main symbol first, then hover symbols
        const displaySymbols = [symbol, ...hoverSymbols.filter(s => s !== symbol)];
        const getDisplayName = (sym) => {
            const map = {
                'SPX': 'S&P 500',
                'sh000001': '上证指数',
                'sz399001': '深证成指',
                'sz399006': '创业板指',
                'us.ixic': '纳斯达克',
                'us.dji': '道琼斯',
                'us.inx': '标普500'
            };
            return map[sym.toLowerCase()] || map[sym] || sym;
        };
        // Status bar: only show main symbol
        const mainData = prices.get(symbol);
        if (mainData) {
            const price = (0, utils_1.formatCryptoPrice)(mainData.last);
            const changeVal = parseFloat(mainData.changeUtc0);
            const icon = changeVal >= 0 ? '$(arrow-up)' : '$(arrow-down)';
            const prefix = (0, api_1.isStockSymbol)(symbol) ? '' : '$';
            const fundingStr = mainData.fundingRate ? ` | FR: ${parseFloat(mainData.fundingRate).toString()}%` : '';
            const amplitudeStr = mainData.amplitudeUtc0 && mainData.amplitudeUtc0 !== '0.00' ? ` | ↕ ${mainData.amplitudeUtc0}%` : '';
            priceStatusBarItem.text = `$(eye) ${getDisplayName(symbol)}: ${prefix}${price} ${icon} ${mainData.changeUtc0}%${amplitudeStr}${fundingStr}`;
            priceStatusBarItem.color = changeVal >= 0 ? '#34d399' : '#f87171';
        }
        else {
            priceStatusBarItem.text = `$(error) No data`;
            priceStatusBarItem.color = undefined;
        }
        // Build Tooltip with all symbols
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`### Market Watch List\n\n`);
        md.appendMarkdown(`| Symbol | Price | UTC0 Change | Amplitude | UTC0 Low | UTC0 High | Funding Rate |\n`);
        md.appendMarkdown(`|:---|:---|:---|:---|:---|:---|:---|\n`);
        displaySymbols.forEach((sym) => {
            const data = prices.get(sym);
            if (data) {
                const priceStr = (0, utils_1.formatCryptoPrice)(data.last);
                const chg = parseFloat(data.changeUtc0);
                const indicator = chg >= 0 ? '🟢' : '🔴';
                const displayName = getDisplayName(sym);
                const boldName = sym === symbol ? `**${displayName}**` : displayName;
                const prefix = (0, api_1.isStockSymbol)(sym) ? '' : '$';
                const amplitude = data.amplitudeUtc0 && data.amplitudeUtc0 !== '0.00' ? `${data.amplitudeUtc0}%` : '-';
                const lowUtc0 = data.lowUtc0 !== '0'
                    ? (0, utils_1.formatCryptoPrice)(data.lowUtc0)
                    : '-';
                const highUtc0 = data.highUtc0 !== '0'
                    ? (0, utils_1.formatCryptoPrice)(data.highUtc0)
                    : '-';
                const funding = data.fundingRate ? `${parseFloat(data.fundingRate).toString()}%` : '-';
                md.appendMarkdown(`| ${indicator} ${boldName} | ${prefix}${priceStr} | ${data.changeUtc0}% | ${amplitude} | ${prefix}${lowUtc0} | ${prefix}${highUtc0} | ${funding} |\n`);
            }
            else {
                md.appendMarkdown(`| ${sym} | Error | - | - | - | - |\n`);
            }
        });
        const utcTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        md.appendMarkdown(`\n---\n*Last updated: ${utcTime}*`);
        priceStatusBarItem.tooltip = md;
    }
    catch (error) {
        console.error('Failed to fetch crypto price:', error);
        // Only show error if we never had data
        if (priceStatusBarItem.text === '' || priceStatusBarItem.text.includes('Loading')) {
            priceStatusBarItem.text = `$(error) Offline`;
            priceStatusBarItem.color = undefined;
            priceStatusBarItem.tooltip = 'Network Error';
        }
    }
    finally {
        isUpdating = false;
    }
}
function deactivate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
}
//# sourceMappingURL=extension.js.map