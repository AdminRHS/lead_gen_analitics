// Chart rendering optimization module
// Provides utilities for efficient chart rendering with caching and lazy loading

/**
 * Generate a simple hash for data comparison
 * @param {Array} rows - Data rows
 * @returns {string} Hash string
 */
export function getDataHash(rows) {
  if (!rows || rows.length === 0) return 'empty';
  // Simple hash based on length and first/last dates
  const firstDate = rows[0]?.Date || '';
  const lastDate = rows[rows.length - 1]?.Date || '';
  return `${rows.length}-${firstDate}-${lastDate}`;
}

/**
 * Check if data has changed and aggregation cache should be invalidated
 * @param {Array} filteredRows - Current filtered rows
 * @param {Object} cache - Aggregation cache object
 * @returns {boolean} True if cache should be invalidated
 */
export function shouldRecalculateAggregations(filteredRows, cache) {
  if (!cache || !cache.dataHash) return true;
  
  const newHash = getDataHash(filteredRows);
  if (cache.dataHash !== newHash) {
    return true; // Data changed, need to recalculate
  }
  
  // Also check if it's the same array reference (for performance)
  if (cache.lastFilteredRows === filteredRows) {
    return false; // Same data, use cache
  }
  
  return true; // Different reference, recalculate to be safe
}

/**
 * Update aggregation cache
 * @param {Object} cache - Cache object to update
 * @param {Array} filteredRows - Current filtered rows
 * @param {Object} aggregations - Aggregated data
 */
export function updateAggregationCache(cache, filteredRows, aggregations) {
  cache.dataHash = getDataHash(filteredRows);
  cache.lastFilteredRows = filteredRows;
  Object.assign(cache, aggregations);
}

/**
 * Update chart data instead of recreating
 * @param {Object} chart - Chart.js instance
 * @param {Array} labels - New labels
 * @param {Array} datasets - New datasets data
 * @returns {boolean} True if update was successful
 */
export function updateChartData(chart, labels, datasets) {
  if (!chart || !chart.data) return false;
  
  try {
    // Update labels
    if (labels && Array.isArray(labels)) {
      chart.data.labels = labels;
    }
    
    // Update datasets
    if (datasets && Array.isArray(datasets)) {
      datasets.forEach((dataset, index) => {
        if (chart.data.datasets[index]) {
          chart.data.datasets[index].data = dataset.data || dataset;
          if (dataset.label) {
            chart.data.datasets[index].label = dataset.label;
          }
        }
      });
    }
    
    // Update chart without animation
    chart.update('none');
    return true;
  } catch (error) {
    console.error('Error updating chart data:', error);
    return false;
  }
}

/**
 * Update paired bar chart data
 * @param {Object} chart - Chart.js instance
 * @param {Array} labels - New labels
 * @param {string} leftLabel - Left series label
 * @param {Array} leftData - Left series data
 * @param {string} rightLabel - Right series label
 * @param {Array} rightData - Right series data
 * @returns {boolean} True if update was successful
 */
export function updatePairedBarChart(chart, labels, leftLabel, leftData, rightLabel, rightData) {
  if (!chart || !chart.data) return false;
  
  try {
    chart.data.labels = labels;
    if (chart.data.datasets[0]) {
      chart.data.datasets[0].label = leftLabel;
      chart.data.datasets[0].data = leftData;
    }
    if (chart.data.datasets[1]) {
      chart.data.datasets[1].label = rightLabel;
      chart.data.datasets[1].data = rightData;
    }
    chart.update('none');
    return true;
  } catch (error) {
    console.error('Error updating paired bar chart:', error);
    return false;
  }
}

/**
 * Update single bar chart data
 * @param {Object} chart - Chart.js instance
 * @param {Array} labels - New labels
 * @param {string} label - Series label
 * @param {Array} data - Series data
 * @returns {boolean} True if update was successful
 */
export function updateSingleBarChart(chart, labels, label, data) {
  if (!chart || !chart.data) return false;
  
  try {
    chart.data.labels = labels;
    if (chart.data.datasets[0]) {
      chart.data.datasets[0].label = label;
      chart.data.datasets[0].data = data;
    }
    chart.update('none');
    return true;
  } catch (error) {
    console.error('Error updating single bar chart:', error);
    return false;
  }
}

/**
 * Debounce function for resize events
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Request animation frame wrapper for chart updates
 * @param {Function} callback - Function to execute in next frame
 * @returns {number} Request ID
 */
export function scheduleChartUpdate(callback) {
  return requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

/**
 * Batch chart updates using requestAnimationFrame
 * @param {Array<Function>} updateFunctions - Array of update functions
 */
export function batchChartUpdates(updateFunctions) {
  if (!updateFunctions || updateFunctions.length === 0) return;
  
  scheduleChartUpdate(() => {
    updateFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error in batch chart update:', error);
      }
    });
  });
}

