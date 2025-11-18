# CLAUDE.md - Development Context

This document provides AI assistants (like Claude) with comprehensive context about the Options Visualizer project to enable effective development assistance.

## Project Overview

**Options Visualizer** is a real-time financial data visualization tool that displays stock prices and options chains with interactive heatmaps. It combines REST API polling with WebSocket streaming to provide live market data updates.

**Primary Purpose:** Help traders and investors visualize options market data with intuitive heatmaps showing bid/ask spreads, implied volatility, put/call ratios, and open interest.

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React Client  │ ◄─────► │  Express Server  │ ◄─────► │  Alpaca API     │
│   (Port 5173)   │  HTTP   │   (Port 3001)    │  HTTP   │                 │
│                 │  WS     │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Tech Stack

**Frontend:**
- **TypeScript 5.7.3** - Type-safe JavaScript with full coverage
- **React 19.2.0** - UI framework
- **Vite 7.2.2** - Build tool and dev server with esbuild
- **Recharts 3.4.1** - Charting library for price charts
- **TailwindCSS 3.4.18** - Utility-first CSS framework
- **Lucide React** - Icon library
- **WebSocket API** - Real-time data streaming

**Backend:**
- **TypeScript 5.7.3** - Type-safe Node.js backend
- **tsx** - TypeScript execution for Node.js
- **Express 5.1.0** - Web server framework
- **ws 8.18.3** - WebSocket server implementation
- **@alpacahq/alpaca-trade-api** - Alpaca Markets SDK
- **Pino** - Structured logging
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## Key Components

### Frontend Components

#### `src/App.tsx`
**Main application component** - Orchestrates the entire UI (TypeScript)

**State Management:**
- `symbol` / `currentSymbol` - Stock ticker input and active symbol
- `historicalData` - Array of stock price bars (OHLCV)
- `optionsData` - Options chain snapshots from Alpaca
- `loading` / `error` - UI states
- `isStreaming` - WebSocket connection status
- `selectedCell` - Currently selected option contract for detail view

**Key Functions:**
- `fetchStockData()` - Fetches historical bars via REST API
- `connectWebSocket(symbol)` - Establishes WebSocket connection for live updates
- `handleCellSelect(cell)` - Manages option contract selection/deselection

**WebSocket Message Types:**
- `stock_bar` - Real-time price updates
- `options_snapshot` - Options chain data
- `error` - Error messages
- `subscribed` - Subscription confirmation

#### `src/components/ModernOptionsChart.tsx`
**Primary visualization component** - Renders options chain heatmaps (TypeScript)

**Features:**
- Displays options grid with strikes (rows) and expirations (columns)
- Color-coded heatmaps for multiple data types:
  - Bid/Ask spreads
  - Implied Volatility (IV)
  - Put/Call Ratio
  - Open Interest
- Interactive cell selection
- Highlights ITM (in-the-money) vs OTM (out-of-the-money) options
- Responsive layout with horizontal scrolling

**Data Processing:**
```typescript
// Groups options by strike price and expiration date
// Calculates P/C ratio for each strike
// Determines color intensity based on selected heatmap mode
// All data structures fully typed with TypeScript interfaces
```

#### `src/components/PriceChart.tsx`
Simple line chart displaying historical stock prices using Recharts.

#### `src/components/HeatmapToggle.tsx`
Toggle buttons to switch between different heatmap visualization modes.

### Type Definitions

#### `src/types/index.ts`
**Comprehensive TypeScript type definitions**

**Core Data Types:**
- `StockBar` - OHLCV bar data
- `OptionsData` - Options chain keyed by contract symbol
- `OptionSnapshot` - Individual option contract data
- `OptionGreeks` - Delta, Gamma, Theta, Vega
- `ParsedOptionContract` - Parsed contract with calculations
- `CoveredCallMetrics` - Covered call strategy metrics

**UI Types:**
- `HeatmapMode` - Visualization modes
- `OptionType` - Call/Put selection
- `ApiResponse<T>` - Generic API response wrapper
- WebSocket message types

### Backend Components

#### `server/index.ts`
**Express + WebSocket server** (TypeScript)

**REST Endpoints:**

1. `GET /api/bars/:symbol` - Historical stock data
   - Uses Alpaca `getBarsV2()` API
   - Supports timeframe, date range, and limit parameters
   - Returns OHLCV data in chronological order

2. `GET /api/quote/:symbol` - Latest quote
   - Fetches current bid/ask prices

3. `GET /api/options/:symbol` - Options chain
   - Fetches both calls and puts
   - Date range: 2 weeks to 6 months out
   - Uses Alpaca options snapshots API v1beta1

4. `GET /api/health` - Health check
   - Returns streaming status and connection state

**WebSocket Implementation:**

```javascript
// Single shared Alpaca data stream for all clients
let alpacaStream = null;
let streamConnected = false;

// Each client WebSocket maintains:
// - currentSymbol: Currently subscribed ticker
// - Subscription to Alpaca stream via alpacaStream.onStockBar()
```

**Streaming Graceful Degradation:**
- Attempts to connect to Alpaca streaming on startup
- If auth fails 3 times, disables streaming and uses REST API only
- Clients receive `error` message if streaming unavailable
- App continues to function with historical data

## Data Flow

### Initial Load Sequence

1. User enters stock symbol and clicks "Analyze"
2. `fetchStockData()` fires:
   - `GET /api/bars/:symbol` → Historical price data
   - `connectWebSocket(symbol)` → Establishes WS connection
3. WebSocket `subscribe` message sent to server
4. Server responds with:
   - `subscribed` confirmation
   - Initial `options_snapshot` with full options chain
5. Frontend renders:
   - Price chart with historical data
   - Options heatmap grid

### Real-Time Updates

```
Stock Price Update Flow:
Alpaca Stream → alpacaStream.onStockBar() → ws.send('stock_bar') → Client updates historicalData

Options Data Flow:
Client connects → Server fetches options via REST → ws.send('options_snapshot') → Client updates optionsData
```

**Note:** Options data is currently fetched once on subscribe (not streaming). Real-time options streaming could be added but is typically not needed due to lower update frequency.

## Styling Approach

**CSS Variables (defined in index.css):**
```css
--color-bg: Background color
--color-surface: Card/surface background
--color-border: Border color
--color-text-primary: Primary text
--color-text-secondary: Secondary text
--color-text-tertiary: Tertiary/muted text
--color-accent: Accent color (red/pink for highlights)
```

**Design Philosophy:**
- Minimalist, clean aesthetic
- Monospace fonts for data (Manrope)
- Subtle animations (fade-in, pulse for live indicator)
- High information density without clutter
- Terminal/Bloomberg-inspired look

## State Management

Currently uses **React useState hooks** with props drilling. No global state management library (Redux, Zustand, etc.).

**TypeScript Integration:**
- All state hooks are fully typed
- Interfaces defined for complex state objects
- Type-safe event handlers and callbacks

**Possible future enhancement:** Consider adding Zustand or Context API if state complexity increases.

## Error Handling

### Backend
- Try/catch blocks on all async API calls
- Graceful fallback when streaming unavailable
- CORS enabled for local development

### Frontend
- Error state display in UI
- WebSocket reconnection on close (manual via new subscription)
- Loading states during data fetches

## Development Workflow

### Running Locally

```bash
# Start both frontend and backend
npm run dev

# Or separately:
npm run server  # Backend on :3001
npm run client  # Frontend on :5173
```

### Environment Setup

Required `.env` variables:
```
ALPACA_API_KEY=pk_...
ALPACA_API_SECRET=sk_...
ALPACA_PAPER=true
```

Get keys from [alpaca.markets](https://alpaca.markets) (free tier available).

### Building for Production

```bash
npm run build    # Creates dist/ folder
npm run preview  # Preview production build
```

## API Integration Details

### Alpaca API Usage

**Stock Data:**
- Endpoint: `getBarsV2(symbol, options)`
- Feed: `iex` (free tier)
- Timeframe: Default `1Day` (can be customized)

**Options Data:**
- Endpoint: `https://data.alpaca.markets/v1beta1/options/snapshots/:symbol`
- Requires separate calls for `type=call` and `type=put`
- Returns snapshot data including:
  - `latestQuote` - Bid/ask prices and sizes
  - `latestTrade` - Last price and volume
  - `greeks` - Delta, Gamma, Theta, Vega (if available)
  - `impliedVolatility`

**Data Limitations:**
- Free tier has IEX data only (15-minute delay for some data)
- Options data availability varies by symbol
- Streaming requires active subscription

## Common Development Tasks

### Adding a New Heatmap Mode

1. Update `ModernOptionsChart.jsx`:
   - Add new mode to `heatmapMode` state options
   - Create calculation function (e.g., `calculateDeltaIntensity()`)
   - Update `getCellColor()` to handle new mode

2. Update `HeatmapToggle.jsx`:
   - Add toggle button for new mode

### Adding a New API Endpoint

1. Add route in `server/index.js`:
```javascript
app.get('/api/new-endpoint/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    // Fetch data from Alpaca
    res.json({ success: true, data: ... });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

2. Call from frontend:
```javascript
const response = await fetch(`/api/new-endpoint/${symbol}`);
const data = await response.json();
```

### Modifying Option Cell Appearance

Update `ModernOptionsChart.jsx` → `renderOptionsCell()` function:
- Change color calculations
- Adjust cell size, padding, borders
- Add overlays or indicators

## Known Issues & Limitations

1. **Streaming Authentication:** Some Alpaca accounts may not have streaming enabled. App gracefully falls back to REST API.

2. **Options Data Sparse for Some Symbols:** Not all stocks have active options markets. Try liquid names: SPY, QQQ, AAPL, TSLA.

3. **No Persistent Storage:** All data is in-memory. Page refresh clears state.

4. **Single Symbol at a Time:** No multi-symbol comparison yet.

5. **Mobile UX:** Grid scrolling on mobile could be improved.

## Future Features (from IDEAS.md)

**High Priority:**
- Greeks visualization (Delta, Gamma, Theta, Vega heatmaps)
- Volume/OI overlays
- Max Pain calculation
- Dark mode toggle
- ITM/OTM/ATM filters
- Strike range selector

**Medium Priority:**
- Unusual activity alerts
- Historical playback / scrubbing
- P/L calculator for strategies
- Watchlist / saved symbols
- Export to CSV/PNG

**Long Term:**
- Multi-symbol comparison
- Custom strategy builder (spreads, straddles, etc.)
- Portfolio tracking
- Backtesting engine

See full list in [IDEAS.md](./IDEAS.md).

## Testing Strategy

**Currently:** No automated tests

**Recommended Future Setup:**
- **Unit Tests:** Vitest for component testing
- **E2E Tests:** Playwright for integration testing
- **API Tests:** Jest for backend endpoint testing

## File Locations Reference

```
Key Files:
├── src/App.tsx                          # Main app logic (TypeScript)
├── src/types/index.ts                   # Type definitions
├── src/components/ModernOptionsChart.tsx # Primary visualization
├── server/index.ts                       # Backend server (TypeScript)
├── server/types/index.ts                 # Backend type definitions
├── package.json                          # Dependencies and scripts
├── tsconfig.json                         # TypeScript config (frontend)
├── tsconfig.server.json                  # TypeScript config (backend)
├── vite.config.ts                        # Vite configuration
├── tailwind.config.cjs                   # Tailwind configuration
├── TS_MIGRATION.md                       # TypeScript migration guide
└── IDEAS.md                              # Feature roadmap
```

## Debugging Tips

### WebSocket Issues
```javascript
// In browser console:
ws = new WebSocket('ws://localhost:3001');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL' }));
```

### Backend Logs
Server logs all WebSocket connections, subscriptions, and errors to console.

### Alpaca API Errors
Common issues:
- Invalid API keys → Check `.env` file
- Rate limiting → Free tier has request limits
- Invalid symbol → Use valid stock tickers

## Code Style

- **Language:** TypeScript with strict mode enabled
- **JavaScript:** ES2020+ with async/await
- **React:** Functional components with hooks (no class components)
- **Naming:** camelCase for variables, PascalCase for components and types
- **Formatting:** Consistent indentation (2 spaces)
- **Type Safety:** Explicit typing for complex structures, inference for simple ones

## Dependencies Explanation

**Why each major dependency:**
- `typescript` - Type safety and better developer experience
- `react` - UI framework
- `recharts` - Simple, React-native charting library
- `@alpacahq/alpaca-trade-api` - Official Alpaca SDK
- `ws` - Lightweight WebSocket server
- `express` - Minimal, flexible Node.js framework
- `vite` - Fast dev server with HMR and esbuild
- `tsx` - TypeScript execution for Node.js
- `pino` - Structured logging
- `tailwindcss` - Rapid UI development with utility classes

## TypeScript Development

### Running Type Checks

```bash
npm run typecheck  # Check all TypeScript files
```

### Key Type Patterns

**Component Props:**
```typescript
interface MyComponentProps {
  data: StockBar[]
  onSelect?: (cell: OptionCell) => void
}
```

**State Hooks:**
```typescript
const [data, setData] = useState<StockBar[]>([])
const [selected, setSelected] = useState<OptionCell | null>(null)
```

**Critical Pattern - Numeric Null Checks:**
```typescript
// ✅ Correct: Explicit null/undefined check
if (value === null || value === undefined) { ... }

// ❌ Wrong: Falsy check fails when value is 0
if (!value) { ... }
```

This is critical for financial data where 0 is a valid value (e.g., bid prices).

## Resources

- [Alpaca API Docs](https://alpaca.markets/docs/)
- [Alpaca Options API](https://alpaca.markets/docs/api-references/market-data-api/options-data/)
- [React Docs](https://react.dev)
- [Recharts Docs](https://recharts.org/)
- [TailwindCSS Docs](https://tailwindcss.com)

---

**Last Updated:** 2025-11-15

This document should be updated as the project evolves to maintain accurate AI assistance context.
