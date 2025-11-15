Let's create a Javascript/Node/Tailwind/Shadcn based Options Visualizer.

Alpaca will be data provider:
SDK: https://github.com/alpacahq/alpaca-trade-api-js
Docs: https://docs.alpaca.markets/docs
Endpoint: https://paper-api.alpaca.markets/v2
Key: PKQ4Q3EUSU2CK4M89I9X

Data available:
- US Stocks & ETFs
- Crypto
- Real-time Data
- 5+ Years Historical Data
- Aggregate Bars
- Trades & Quotes

Features not available:
- All US Stock Exchanges
- 10,000 API Calls / Min
- Unlimited Symbol WebSocket Connection

UI:
A user should be able to enter a symbol, and have a historical graph of prices show. To the right end of that, since options are in the future, we should have a grid of the different options available.

Think of it like a table, where the X axis is time and the Y axis is price. There will be blocks making up the table that have different prices.

Tools available:
You can use playwright to visualize the site you created.

