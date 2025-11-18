# Options Visualizer

A modern, real-time options chain visualizer built with React, TypeScript, and powered by Alpaca Markets API. Visualize stock prices and options data with interactive heatmaps, live streaming updates, and a clean, minimalist interface.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue) ![React](https://img.shields.io/badge/React-19.2.0-blue) ![Node](https://img.shields.io/badge/Node-Express-green) ![License](https://img.shields.io/badge/license-ISC-lightgrey)

## Features

- **Real-Time Stock Data**: Live streaming stock price updates via WebSocket
- **Interactive Options Chain**: Visual heatmap of calls and puts across strikes and expirations
- **Modern UI**: Clean, minimalist design with smooth animations
- **Click for Details**: Click any option cell to view comprehensive contract details
- **Heatmap Visualization**:
  - Bid/Ask spread visualization
  - Implied Volatility heatmaps
  - Put/Call ratio analysis
  - Open Interest visualization
- **Live Data Indicator**: See when data is streaming in real-time vs. historical
- **Responsive Design**: Works across desktop and mobile devices

## Technology Stack

**Frontend:**
- **TypeScript 5.7.3** - Full type safety across the application
- React 19.2.0
- Vite 7.2.2 (build tool with esbuild)
- Recharts 3.4.1 (charting)
- TailwindCSS 3.4.18 (styling)
- Lucide React (icons)

**Backend:**
- **TypeScript 5.7.3** - Type-safe Node.js backend
- **tsx** - TypeScript execution for Node.js
- Node.js with Express 5.1.0
- WebSocket (ws 8.18.3)
- Alpaca Trade API 3.1.3
- Pino (structured logging)
- CORS enabled

## Prerequisites

- **Node.js** (v16 or higher recommended)
- **Alpaca Markets Account** - Get your API keys at [alpaca.markets](https://alpaca.markets)
  - Free tier available with IEX data feed
  - Paper trading account supported

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd options-visualizer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the root directory:
   ```env
   ALPACA_API_KEY=your_api_key_here
   ALPACA_API_SECRET=your_secret_key_here
   ALPACA_PAPER=true
   ALPACA_BASE_URL=https://api.alpaca.markets
   ```

   **Getting Alpaca API Keys:**
   - Sign up at [alpaca.markets](https://alpaca.markets)
   - Navigate to your dashboard
   - Generate API keys for paper trading
   - Copy the Key ID and Secret Key to your `.env` file

## Running the Application

### Development Mode

Start both the backend server and frontend dev server concurrently:

```bash
npm run dev
```

This will:
- Start the Express server on port 3001
- Start the Vite dev server (usually on port 5173)
- Open your browser automatically

### Individual Services

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

### Type Checking

Run TypeScript type checks:

```bash
npm run typecheck
```

This checks all TypeScript files for type errors without emitting any files. Useful for CI/CD pipelines.

### Testing

Run unit tests with Vitest:

```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once
npm run test:ui     # Run tests with UI
```

The project includes comprehensive unit tests for utility functions:
- `chartUtils.test.ts` - Chart calculations and visualization utilities (32 tests)
- `formatters.test.ts` - Data formatting functions (46 tests)
- `optionsUtils.test.ts` - Options contract parsing and analysis (24 tests)

All tests are written in TypeScript with full type safety.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. **Enter a stock symbol** (e.g., AAPL, MSFT, TSLA) in the search bar
2. **Click "Analyze"** to fetch data
3. **View the options chain** with color-coded heatmaps
4. **Click any option cell** to see detailed contract information
5. **Toggle heatmap views** to switch between different visualizations:
   - Bid/Ask spreads
   - Implied Volatility
   - Put/Call Ratio
   - Open Interest

## Project Structure

```
options-visualizer/
├── src/
│   ├── components/          # React components (TypeScript)
│   │   ├── ModernOptionsChart.tsx    # Main options visualization
│   │   ├── PriceChart.tsx           # Stock price chart
│   │   ├── OptionsGrid.tsx          # Options grid layout
│   │   ├── HeatmapToggle.tsx        # Heatmap view controls
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useOptionsData.ts
│   │   └── useCoveredCallMetrics.ts
│   ├── lib/                # Utility libraries
│   │   ├── formatters.ts
│   │   ├── chartUtils.ts
│   │   └── logger.ts
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── server/                 # Backend (TypeScript)
│   ├── index.ts            # Express + WebSocket server
│   ├── routes/             # API routes
│   ├── middleware/         # Express middleware
│   ├── api/                # API services
│   ├── types/              # Backend type definitions
│   └── utils/              # Backend utilities
├── tsconfig.json           # TypeScript config (frontend)
├── tsconfig.server.json    # TypeScript config (backend)
├── index.html              # HTML template
├── package.json
└── vite.config.ts          # Vite configuration
```

## API Endpoints

### REST API

- `GET /api/bars/:symbol` - Get historical stock price data
  - Query params: `timeframe`, `start`, `end`, `limit`
- `GET /api/quote/:symbol` - Get latest quote for a symbol
- `GET /api/options/:symbol` - Get options chain snapshots
- `GET /api/health` - Server health check and streaming status

### WebSocket API

Connect to `ws://localhost:3001` and send/receive JSON messages:

**Subscribe to symbol:**
```json
{
  "type": "subscribe",
  "symbol": "AAPL"
}
```

**Receive stock updates:**
```json
{
  "type": "stock_bar",
  "data": {
    "symbol": "AAPL",
    "time": "2024-01-01T12:00:00Z",
    "open": 150.0,
    "high": 151.0,
    "low": 149.5,
    "close": 150.5,
    "volume": 1000000
  }
}
```

**Receive options updates:**
```json
{
  "type": "options_snapshot",
  "data": { /* options chain data */ }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALPACA_API_KEY` | Your Alpaca API key | Required |
| `ALPACA_API_SECRET` | Your Alpaca secret key | Required |
| `ALPACA_PAPER` | Use paper trading account | `true` |
| `ALPACA_BASE_URL` | Alpaca API base URL | `https://api.alpaca.markets` |
| `LOG_LEVEL` | Backend logging level (`debug`, `info`, `warn`, `error`) | `info` |
| `NODE_ENV` | Environment mode (`development`, `production`) | `development` |

### Logging

The application uses structured logging with environment-aware configuration:

**Frontend Logging:**
- Uses a lightweight custom logger with log levels: DEBUG, INFO, WARN, ERROR
- In production (`vite build`): Only WARN and ERROR messages are logged
- In development: All log levels are active
- Logs are automatically suppressed in production to improve performance

**Backend Logging:**
- Uses [Pino](https://github.com/pinojs/pino) for fast, structured logging
- Log levels: `debug`, `info`, `warn`, `error`
- Development: Pretty-printed, human-readable logs with colors
- Production: JSON-formatted logs optimized for monitoring tools (e.g., CloudWatch, Datadog)
- Each HTTP request includes a unique Request ID for tracing
- All logs include contextual information (timestamp, request ID, error stacks, etc.)

**Configuring Log Level:**

Set the `LOG_LEVEL` environment variable in your `.env` file:
```env
LOG_LEVEL=info  # Options: debug, info, warn, error
```

- `debug`: Verbose debugging information (development only)
- `info`: General informational messages (default)
- `warn`: Warning messages and errors
- `error`: Only error messages

### Data Feed

The application uses Alpaca's IEX data feed, which is available on the free tier. Real-time streaming requires an active Alpaca account with streaming enabled. If streaming is unavailable, the app falls back to REST API polling.

## Development

### TypeScript

This project uses TypeScript throughout the codebase for type safety:

- **Strict mode enabled** - Catches errors at compile time
- **Full type coverage** - All components, hooks, and utilities are typed
- **Type definitions** - Located in `src/types/index.ts` and `server/types/index.ts`

**Type checking:**
```bash
npm run typecheck  # Check for type errors
```

**IDE Support:**
- VSCode: Built-in TypeScript support
- Other editors: May need TypeScript language server

For more details on the TypeScript migration, see [TS_MIGRATION.md](./TS_MIGRATION.md).

## Troubleshooting

**WebSocket connection fails:**
- Check that the server is running on port 3001
- Verify your Alpaca API credentials
- Ensure your Alpaca account has streaming permissions

**No options data showing:**
- Not all stocks have liquid options markets
- Try popular symbols like AAPL, SPY, QQQ, TSLA
- Options data is filtered to show expirations 2 weeks to 6 months out

**"Real-time streaming not available" message:**
- This is normal if streaming isn't enabled on your Alpaca account
- The app will continue to work with REST API data
- Historical data will still be displayed

**TypeScript errors:**
- Run `npm run typecheck` to see all type errors
- Most errors are caught at development time by your IDE
- See [TS_MIGRATION.md](./TS_MIGRATION.md) for type patterns and examples

## Future Enhancements

See [IDEAS.md](./IDEAS.md) for a comprehensive list of planned features including:
- Greeks visualization (Delta, Gamma, Theta, Vega)
- Unusual activity alerts
- Multi-symbol comparison
- Profit/Loss calculator
- Custom strategy builder
- And much more!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Acknowledgments

- Market data provided by [Alpaca Markets](https://alpaca.markets)
- Built with [React](https://react.dev) and [Vite](https://vitejs.dev)
- Charts powered by [Recharts](https://recharts.org)

---

**Note:** This application is for educational and informational purposes only. It is not financial advice. Always do your own research before making investment decisions.
