/**
 * Server-side Options Parser Utilities
 *
 * Pure functions for parsing and validating options contract symbols on the backend.
 * These utilities can be shared across server routes and WebSocket handlers.
 *
 * Note: This is CommonJS format for Node.js compatibility
 */

const logger = require('./logger');

/**
 * Regular expression for validating and parsing OCC option contract symbols
 * Groups: [symbol, dateYYMMDD, C/P, strikePriceInteger]
 */
const OCC_CONTRACT_REGEX = /^([A-Z]+)(\d{6})([CP])(\d{8})$/;

/**
 * Parse an OCC options contract symbol into its components
 *
 * @param {string} contractSymbol - OCC contract symbol (e.g., "AAPL251219C00150000")
 * @returns {Object|null} Parsed contract data or null if invalid
 * @returns {string} return.symbol - Underlying stock symbol
 * @returns {Date} return.expirationDate - Expiration date
 * @returns {string} return.optionType - 'C' for call, 'P' for put
 * @returns {number} return.strike - Strike price as decimal
 * @returns {string} return.contractSymbol - Original contract symbol
 *
 * @example
 * parseContractSymbol('AAPL251219C00150000')
 * // Returns: {
 * //   symbol: 'AAPL',
 * //   expirationDate: Date(2025-12-19),
 * //   optionType: 'C',
 * //   strike: 150.00,
 * //   contractSymbol: 'AAPL251219C00150000'
 * // }
 */
function parseContractSymbol(contractSymbol) {
  if (!contractSymbol || typeof contractSymbol !== 'string') {
    return null;
  }

  const match = contractSymbol.match(OCC_CONTRACT_REGEX);
  if (!match) {
    return null;
  }

  const [, symbol, dateStr, optionType, strikeStr] = match;

  try {
    // Parse expiration date (YYMMDD format)
    const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10);
    const day = parseInt(dateStr.substring(4, 6), 10);

    // Validate date components
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const expirationDate = new Date(year, month - 1, day); // month is 0-indexed in Date

    // Validate date is valid (catches invalid dates like Feb 31)
    if (isNaN(expirationDate.getTime())) {
      return null;
    }

    // Parse strike price (8 digits, last 3 are decimals)
    const strike = parseInt(strikeStr, 10) / 1000;

    // Validate strike is positive
    if (strike <= 0 || !isFinite(strike)) {
      return null;
    }

    return {
      symbol,
      expirationDate,
      optionType,
      strike,
      contractSymbol
    };
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack, contractSymbol }, 'Error parsing contract symbol');
    return null;
  }
}

/**
 * Validate if a string is a valid OCC contract symbol
 *
 * @param {string} contractSymbol - Contract symbol to validate
 * @returns {boolean} True if valid OCC contract symbol
 *
 * @example
 * isValidContractSymbol('AAPL251219C00150000') // true
 * isValidContractSymbol('INVALID') // false
 */
function isValidContractSymbol(contractSymbol) {
  return parseContractSymbol(contractSymbol) !== null;
}

/**
 * Extract the underlying symbol from a contract symbol
 *
 * @param {string} contractSymbol - OCC contract symbol
 * @returns {string|null} Underlying symbol or null if invalid
 *
 * @example
 * getUnderlyingSymbol('AAPL251219C00150000') // Returns 'AAPL'
 */
function getUnderlyingSymbol(contractSymbol) {
  const parsed = parseContractSymbol(contractSymbol);
  return parsed ? parsed.symbol : null;
}

/**
 * Format expiration date as ISO string (YYYY-MM-DD)
 *
 * @param {Date} date - Date object
 * @returns {string} ISO date string
 *
 * @example
 * formatExpirationDate(new Date(2025, 11, 19)) // Returns "2025-12-19"
 */
function formatExpirationDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().split('T')[0];
}

/**
 * Parse date range from query parameters
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Object with validated start and end dates
 *
 * @example
 * parseDateRange('2025-01-01', '2025-12-31')
 * // Returns: { start: Date(...), end: Date(...) }
 */
function parseDateRange(startDate, endDate) {
  let start = null;
  let end = null;

  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) {
      start = null;
    }
  }

  if (endDate) {
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      end = null;
    }
  }

  return { start, end };
}

/**
 * Filter options data by expiration date range
 *
 * @param {Object} optionsData - Options data object (keyed by contract symbol)
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Object} Filtered options data
 *
 * @example
 * filterByExpirationRange(optionsData, new Date('2025-01-01'), new Date('2025-12-31'))
 */
function filterByExpirationRange(optionsData, startDate, endDate) {
  if (!optionsData || typeof optionsData !== 'object') {
    return {};
  }

  const filtered = {};

  Object.entries(optionsData).forEach(([contractSymbol, data]) => {
    const parsed = parseContractSymbol(contractSymbol);
    if (!parsed) {
      return;
    }

    const { expirationDate } = parsed;

    // Check if expiration is within range
    const withinStart = !startDate || expirationDate >= startDate;
    const withinEnd = !endDate || expirationDate <= endDate;

    if (withinStart && withinEnd) {
      filtered[contractSymbol] = data;
    }
  });

  return filtered;
}

/**
 * Filter options data by strike price range
 *
 * @param {Object} optionsData - Options data object (keyed by contract symbol)
 * @param {number} minStrike - Minimum strike price (inclusive)
 * @param {number} maxStrike - Maximum strike price (inclusive)
 * @returns {Object} Filtered options data
 *
 * @example
 * filterByStrikeRange(optionsData, 100, 200)
 */
function filterByStrikeRange(optionsData, minStrike, maxStrike) {
  if (!optionsData || typeof optionsData !== 'object') {
    return {};
  }

  const filtered = {};

  Object.entries(optionsData).forEach(([contractSymbol, data]) => {
    const parsed = parseContractSymbol(contractSymbol);
    if (!parsed) {
      return;
    }

    const { strike } = parsed;

    // Check if strike is within range
    const aboveMin = minStrike === undefined || minStrike === null || strike >= minStrike;
    const belowMax = maxStrike === undefined || maxStrike === null || strike <= maxStrike;

    if (aboveMin && belowMax) {
      filtered[contractSymbol] = data;
    }
  });

  return filtered;
}

/**
 * Filter options by type (calls or puts)
 *
 * @param {Object} optionsData - Options data object (keyed by contract symbol)
 * @param {string} optionType - 'C' for calls, 'P' for puts
 * @returns {Object} Filtered options data
 *
 * @example
 * filterByOptionType(optionsData, 'C') // Returns only calls
 */
function filterByOptionType(optionsData, optionType) {
  if (!optionsData || typeof optionsData !== 'object') {
    return {};
  }

  if (optionType !== 'C' && optionType !== 'P') {
    return optionsData; // Return all if invalid type
  }

  const filtered = {};

  Object.entries(optionsData).forEach(([contractSymbol, data]) => {
    const parsed = parseContractSymbol(contractSymbol);
    if (!parsed) {
      return;
    }

    if (parsed.optionType === optionType) {
      filtered[contractSymbol] = data;
    }
  });

  return filtered;
}

/**
 * Group options data by expiration date
 *
 * @param {Object} optionsData - Options data object (keyed by contract symbol)
 * @returns {Object} Object mapping ISO date strings to arrays of options
 *
 * @example
 * groupByExpiration(optionsData)
 * // Returns: { '2025-12-19': [...], '2026-01-16': [...] }
 */
function groupByExpiration(optionsData) {
  if (!optionsData || typeof optionsData !== 'object') {
    return {};
  }

  const grouped = {};

  Object.entries(optionsData).forEach(([contractSymbol, data]) => {
    const parsed = parseContractSymbol(contractSymbol);
    if (!parsed) {
      return;
    }

    const expKey = formatExpirationDate(parsed.expirationDate);
    if (!grouped[expKey]) {
      grouped[expKey] = [];
    }

    grouped[expKey].push({
      contractSymbol,
      ...parsed,
      data
    });
  });

  return grouped;
}

/**
 * Group options data by strike price
 *
 * @param {Object} optionsData - Options data object (keyed by contract symbol)
 * @returns {Object} Object mapping strike prices to arrays of options
 *
 * @example
 * groupByStrike(optionsData)
 * // Returns: { '150': [...], '155': [...] }
 */
function groupByStrike(optionsData) {
  if (!optionsData || typeof optionsData !== 'object') {
    return {};
  }

  const grouped = {};

  Object.entries(optionsData).forEach(([contractSymbol, data]) => {
    const parsed = parseContractSymbol(contractSymbol);
    if (!parsed) {
      return;
    }

    const strikeKey = parsed.strike.toString();
    if (!grouped[strikeKey]) {
      grouped[strikeKey] = [];
    }

    grouped[strikeKey].push({
      contractSymbol,
      ...parsed,
      data
    });
  });

  return grouped;
}

/**
 * Validate options API response data
 *
 * @param {Object} data - Options data from API
 * @returns {boolean} True if data structure is valid
 */
function validateOptionsData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check if at least one contract exists
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return true; // Empty data is valid (no options available)
  }

  // Validate first contract has expected structure
  const firstContract = data[keys[0]];
  return firstContract &&
    typeof firstContract === 'object' &&
    (firstContract.latestQuote || firstContract.latestTrade);
}

// CommonJS exports for Node.js
module.exports = {
  OCC_CONTRACT_REGEX,
  parseContractSymbol,
  isValidContractSymbol,
  getUnderlyingSymbol,
  formatExpirationDate,
  parseDateRange,
  filterByExpirationRange,
  filterByStrikeRange,
  filterByOptionType,
  groupByExpiration,
  groupByStrike,
  validateOptionsData
};
