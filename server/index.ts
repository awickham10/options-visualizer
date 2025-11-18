import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Import logger and middleware
import logger from './utils/logger'
import requestIdMiddleware from './middleware/requestId'
import httpLoggerMiddleware from './middleware/httpLogger'

// Import routes
import stocksRouter from './routes/stocks'
import optionsRouter from './routes/options'

dotenv.config()

// Initialize Express app
const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(requestIdMiddleware)
app.use(httpLoggerMiddleware)

// Mount routes
app.use('/api', stocksRouter)
app.use('/api', optionsRouter)

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
