import { useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook to manage WebSocket connections for real-time data streaming
 * Extracts WebSocket business logic from App component
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onStockBar - Callback for stock bar updates
 * @param {Function} options.onOptionsSnapshot - Callback for options snapshot updates
 * @param {Function} options.onError - Callback for error messages
 * @param {Function} options.onSubscribed - Callback for subscription confirmation
 * @param {Function} options.setIsStreaming - Function to update streaming state
 * @returns {Object} WebSocket control functions
 */
export function useWebSocket({
  onStockBar,
  onOptionsSnapshot,
  onError,
  onSubscribed,
  setIsStreaming
}) {
  const wsRef = useRef(null)

  /**
   * Connect to WebSocket server and subscribe to a symbol
   * @param {string} symbol - Stock symbol to subscribe to
   */
  const connectWebSocket = useCallback((symbol) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket('ws://localhost:3001')

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsStreaming(true)
      // Subscribe to symbol
      ws.send(JSON.stringify({ type: 'subscribe', symbol }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      switch (message.type) {
        case 'stock_bar':
          if (onStockBar) {
            onStockBar(message.data)
          }
          break

        case 'options_snapshot':
          if (onOptionsSnapshot) {
            onOptionsSnapshot(message.data)
          }
          break

        case 'error':
          console.error('WebSocket error:', message.error)
          if (onError) {
            onError(message.error)
          }
          break

        case 'subscribed':
          console.log(`Subscribed to ${message.symbol}`)
          if (onSubscribed) {
            onSubscribed(message.symbol)
          }
          break

        default:
          console.warn('Unknown message type:', message.type)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsStreaming(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsStreaming(false)
    }

    wsRef.current = ws
  }, [onStockBar, onOptionsSnapshot, onError, onSubscribed, setIsStreaming])

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    connectWebSocket,
    disconnect,
    isConnected: wsRef.current !== null
  }
}
