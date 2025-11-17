import { useMemo } from 'react'

/**
 * Custom hook to calculate covered call financial metrics
 * Extracts covered call calculation logic from App component
 *
 * @param {Object} cell - Option contract data
 * @param {number} userCostBasis - User's purchase price for the underlying stock
 * @returns {Object|null} Calculated metrics or null if no cell data
 */
export function useCoveredCallMetrics(cell, userCostBasis = null) {
  return useMemo(() => {
    if (!cell) return null

    // Validate required fields
    if (!cell.expDate || !cell.bid || !cell.currentPrice || !cell.strike) {
      console.warn('Missing required fields for covered call metrics:', cell)
      return null
    }

    const today = new Date()
    const expDate = new Date(cell.expDate)
    const daysToExpiration = Math.max(0, Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)))

    // For covered calls, you SELL the call, so use bid price (what you receive)
    const premium = cell.bid
    const currentPrice = cell.currentPrice
    const strike = cell.strike
    const basis = userCostBasis || currentPrice // Use user's cost basis if provided

    // Input validation to avoid division by zero and invalid calculations
    if (currentPrice <= 0) {
      console.warn('Invalid currentPrice:', currentPrice)
      return { daysToExpiration, premium }
    }

    if (daysToExpiration === 0) {
      console.warn('Option expires today, cannot calculate annualized returns')
      return { daysToExpiration, premium }
    }

    if (basis <= 0) {
      console.warn('Invalid cost basis:', basis)
      return { daysToExpiration, premium }
    }

    // Premium return based on current price (what someone buying today would get)
    const annualizedReturn = (premium / currentPrice) * (365 / daysToExpiration) * 100

    // Premium return based on YOUR cost basis (your actual income yield)
    const premiumReturnOnCost = (premium / basis) * (365 / daysToExpiration) * 100

    // Return if called - based on YOUR cost basis
    // Total gain = appreciation to strike + premium collected
    const returnIfCalled = ((strike - basis + premium) / basis) * (365 / daysToExpiration) * 100

    // Current unrealized position
    const currentPosition = ((currentPrice - basis) / basis) * 100
    const currentPositionAnnualized = currentPosition * (365 / daysToExpiration)

    // Total return if called (not annualized)
    const totalReturnIfCalled = ((strike - basis + premium) / basis) * 100

    // Downside protection
    const downsideProtection = premium
    const downsideProtectionPercent = (premium / currentPrice) * 100

    // Actual breakeven (stock price can drop this much before you lose money)
    const breakeven = basis - premium
    const breakevenPercent = ((currentPrice - breakeven) / currentPrice) * 100

    return {
      daysToExpiration,
      premium,
      annualizedReturn, // Premium yield at current price
      premiumReturnOnCost, // Premium yield on your cost basis
      returnIfCalled, // Annualized return if called away
      totalReturnIfCalled, // Total return % if called (not annualized)
      currentPosition, // Current unrealized gain/loss %
      currentPositionAnnualized, // Annualized based on time held
      downsideProtection,
      downsideProtectionPercent,
      breakeven, // Your actual breakeven price
      breakevenPercent, // % cushion from current price
      usingCostBasis: userCostBasis !== null && userCostBasis !== currentPrice
    }
  }, [cell, userCostBasis])
}
