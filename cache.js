// Cache management module for Lead Generation Dashboard
// Handles localStorage caching with validation, versioning, and error handling

const CACHE_KEY_DATA = 'leadGen_data';
const CACHE_KEY_TIMESTAMP = 'leadGen_lastUpdated';
const CACHE_KEY_VERSION = 'leadGen_cacheVersion';
const CACHE_VERSION = '1.0.0'; // Increment when cache structure changes
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours max cache age

/**
 * Get cached data from localStorage
 * @returns {Object|null} Cached data object or null if not available/invalid
 */
export function getCachedData() {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY_DATA);
    const cachedTimestamp = localStorage.getItem(CACHE_KEY_TIMESTAMP);
    const cachedVersion = localStorage.getItem(CACHE_KEY_VERSION);

    console.debug('Cache check: Reading from localStorage', {
      hasData: !!cachedData,
      hasTimestamp: !!cachedTimestamp,
      hasVersion: !!cachedVersion,
      version: cachedVersion,
      timestamp: cachedTimestamp
    });

    // Check if cache exists
    if (!cachedData || !cachedTimestamp) {
      console.debug('Cache check: No cached data or timestamp found');
      return null;
    }

    // Check cache version compatibility
    // If version is null/undefined, it means old cache format without version - clear it
    // If version exists but doesn't match, also clear it
    if (!cachedVersion || cachedVersion !== CACHE_VERSION) {
      if (cachedVersion) {
        console.warn(`Cache version mismatch (cached: ${cachedVersion}, current: ${CACHE_VERSION}), clearing cache`);
      } else {
        console.warn(`Cache has no version (old format), clearing cache. Current version: ${CACHE_VERSION}`);
      }
      clearCache();
      return null;
    }
    
    console.debug('Cache check: Version OK, parsing data...');

    // Parse cached data
    let data;
    try {
      data = JSON.parse(cachedData);
    } catch (parseError) {
      console.error('Failed to parse cached data:', parseError);
      clearCache();
      return null;
    }

    // Validate cache structure
    if (!data || typeof data !== 'object' || !data.hasOwnProperty('data') || !data.hasOwnProperty('last_updated')) {
      console.warn('Invalid cache structure, clearing cache', {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasDataProp: data && data.hasOwnProperty('data'),
        hasLastUpdated: data && data.hasOwnProperty('last_updated')
      });
      clearCache();
      return null;
    }
    
    console.debug('Cache check: Structure valid');

    // Check cache age (fallback if timestamp comparison fails)
    // Only check if we can parse the timestamp correctly
    try {
      const timestampDate = new Date(cachedTimestamp);
      if (!isNaN(timestampDate.getTime())) {
        const cacheAge = Date.now() - timestampDate.getTime();
        if (cacheAge > CACHE_DURATION_MS) {
          console.warn('Cache expired (older than 24 hours), clearing cache');
          clearCache();
          return null;
        }
      }
    } catch (e) {
      // If timestamp parsing fails, don't invalidate cache - just log warning
      console.debug('Could not parse cache timestamp, but continuing with cache:', e);
    }

    console.debug('Cache check: All validations passed, returning cached data');
    
    return {
      data: data,
      last_updated: cachedTimestamp,
      cached_at: localStorage.getItem('leadGen_cachedAt') || cachedTimestamp
    };
  } catch (error) {
    console.error('Error reading from cache:', error);
    // If localStorage is disabled or quota exceeded, clear and return null
    if (error.name === 'QuotaExceededError' || error.name === 'SecurityError') {
      clearCache();
    }
    return null;
  }
}

/**
 * Save data to localStorage cache
 * @param {Object} jsonData - Data object with 'data' and 'last_updated' properties
 * @returns {boolean} True if cache was saved successfully, false otherwise
 */
export function setCachedData(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    console.error('Invalid data provided to setCachedData');
    return false;
  }

  if (!jsonData.hasOwnProperty('data') || !jsonData.hasOwnProperty('last_updated')) {
    console.error('Data missing required properties (data, last_updated)');
    return false;
  }

  try {
    // Check cache size before storing
    const dataString = JSON.stringify(jsonData);
    const sizeInBytes = new Blob([dataString]).size;

    if (sizeInBytes > MAX_CACHE_SIZE) {
      console.warn(`Cache size (${sizeInBytes} bytes) exceeds limit (${MAX_CACHE_SIZE} bytes), not caching`);
      return false;
    }

    // Store data
    localStorage.setItem(CACHE_KEY_DATA, dataString);
    localStorage.setItem(CACHE_KEY_TIMESTAMP, jsonData.last_updated || '');
    localStorage.setItem(CACHE_KEY_VERSION, CACHE_VERSION);
    localStorage.setItem('leadGen_cachedAt', new Date().toISOString());

    // Verify that cache was saved correctly
    const verifyVersion = localStorage.getItem(CACHE_KEY_VERSION);
    const verifyData = localStorage.getItem(CACHE_KEY_DATA);
    if (verifyVersion === CACHE_VERSION && verifyData) {
      console.log('Data cached successfully', {
        version: verifyVersion,
        timestamp: jsonData.last_updated,
        dataSize: dataString.length
      });
      return true;
    } else {
      console.error('Cache verification failed', {
        expectedVersion: CACHE_VERSION,
        actualVersion: verifyVersion,
        hasData: !!verifyData
      });
      return false;
    }
  } catch (error) {
    console.error('Error saving to cache:', error);
    
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, attempting to clear old cache');
      try {
        // Try to clear and retry
        clearCache();
        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(jsonData));
        localStorage.setItem(CACHE_KEY_TIMESTAMP, jsonData.last_updated || '');
        localStorage.setItem(CACHE_KEY_VERSION, CACHE_VERSION);
        localStorage.setItem('leadGen_cachedAt', new Date().toISOString());
        return true;
      } catch (retryError) {
        console.error('Failed to cache after clearing:', retryError);
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Check if cached data is still valid by comparing timestamps
 * @param {string} cachedTimestamp - Timestamp from cache
 * @param {string} serverTimestamp - Timestamp from server
 * @returns {boolean} True if cache is valid (timestamps match)
 */
export function isCacheValid(cachedTimestamp, serverTimestamp) {
  if (!cachedTimestamp || !serverTimestamp) {
    return false;
  }
  
  // Exact match means data hasn't changed
  if (cachedTimestamp === serverTimestamp) {
    return true;
  }
  
  // If timestamps don't match, cache is invalid
  return false;
}

/**
 * Clear all cached data
 */
export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY_DATA);
    localStorage.removeItem(CACHE_KEY_TIMESTAMP);
    localStorage.removeItem(CACHE_KEY_VERSION);
    localStorage.removeItem('leadGen_cachedAt');
    console.log('Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Get cache information (for debugging/UI)
 * @returns {Object|null} Cache info object or null
 */
export function getCacheInfo() {
  try {
    const cached = getCachedData();
    if (!cached) {
      return null;
    }

    const cachedAt = new Date(cached.cached_at);
    const now = new Date();
    const ageMs = now - cachedAt;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      last_updated: cached.last_updated,
      cached_at: cached.cached_at,
      age_hours: ageHours,
      age_minutes: ageMinutes,
      is_valid: true
    };
  } catch (error) {
    console.error('Error getting cache info:', error);
    return null;
  }
}

/**
 * Check if localStorage is available and working
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

