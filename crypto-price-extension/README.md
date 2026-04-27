# Crypto Price Monitor for VS Code

A lightweight VS Code extension that displays real-time cryptocurrency prices in your status bar.

## Features

- Real-time price tracking from OKX.
- Customizable symbol (e.g., BTC-USDT, ETH-USDT).
- Adjustable update interval.
- Color-coded price changes (Green for up, Red for down).
- Tooltip with 24h high/low and last update time.

## Configuration

You can configure the following settings in VS Code:

- `cryptoPrice.symbol`: The symbol to track (Default: `BTC-USDT`).
- `cryptoPrice.interval`: Update interval in seconds (Default: `30`).

## How to Run (Development)

1. Open the `crypto-price-extension` folder in VS Code.
2. Run `npm install` in your terminal.
3. Press `F5` to start a new Extension Development Host window.
4. You should see the crypto price in the bottom-right status bar.
