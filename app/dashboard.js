import { parseDdMmYyyyToDate, toIsoDateInputValue, validateData } from '../utils.js';
import { getCachedData, setCachedData, isCacheValid, isLocalStorageAvailable } from '../cache.js';
import { state } from './state.js';
import { t, registerStatusUIUpdater } from './i18nSupport.js';
import { renderAll } from './renderers.js';
import { setupModals } from './modals.js';
import { setupExportButtons } from './exports.js';

registerStatusUIUpdater(updateStatusUI);

let summaryLoadPromise = null;

function updateStatusUI(updateEl, json, fromCache = false) {
  if (!updateEl || !json) return;
  state.lastStatusPayload = { json, fromCache };
  const statusText = `${t('common.lastUpdated')}: ${json.last_updated || t('common.unknown')}`;
  const indicatorClass = fromCache ? 'cache-indicator' : 'cache-indicator server';
  const indicatorText = fromCache ? t('common.cacheFromCache') : t('common.cacheFromServer');
  const refreshTitle = t('common.refreshTooltip');
  updateEl.innerHTML = `<span>${statusText}</span><span class="${indicatorClass}">${indicatorText}</span><button class="refresh-btn" id="refreshDataBtn" title="${refreshTitle}">🔄</button>`;
  const refreshBtnEl = document.getElementById('refreshDataBtn');
  if (refreshBtnEl && !refreshBtnEl.dataset.bound) {
    refreshBtnEl.addEventListener('click', handleManualRefresh);
    refreshBtnEl.dataset.bound = 'true';
  }
}

async function fetchDataFromServer() {
  const res = await fetch('data.json');
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  validateData(json);
  return json;
}

async function fetchSummaryFromServer() {
  const res = await fetch('summary.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function rerenderWithLastFilter() {
  const rowsForRender =
    Array.isArray(state.lastFilteredRows) && state.lastFilteredRows.length > 0
      ? state.lastFilteredRows
      : state.rows;
  if (rowsForRender && rowsForRender.length) {
    renderAll(rowsForRender);
  }
}

async function hydrateSummary(force = false) {
  if (!force) {
    if (state.serverSummary) {
      return state.serverSummary;
    }
    if (summaryLoadPromise) {
      return summaryLoadPromise;
    }
  }

  const loader = (async () => {
    try {
      const summary = await fetchSummaryFromServer();
      state.serverSummary = summary;
      rerenderWithLastFilter();
      return summary;
    } catch (error) {
      if (force) {
        state.serverSummary = null;
      }
      console.info('[summary] Not available:', error?.message || error);
      return null;
    }
  })();

  if (!force) {
    summaryLoadPromise = loader;
  }
  const result = await loader;
  if (!force) {
    summaryLoadPromise = null;
  }
  return result;
}

function processDashboardData(json) {
  if (!json || !json.data) {
    console.error('Invalid data structure in processDashboardData:', json);
    return;
  }
  state.rows = json.data || [];
  if (!state.rows.length) return;
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  const datesList = state.rows
    .map((r) => parseDdMmYyyyToDate(r.Date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const minDate = datesList[0] || new Date();
  state.minDate = minDate;
  state.maxDate = datesList[datesList.length - 1] || new Date();

  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl && toEl) {
    fromEl.value = toIsoDateInputValue(minDate);
    toEl.value = toIsoDateInputValue(state.maxDate);
  }
}

function resetFilters() {
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  const datesList = state.rows
    .map((r) => parseDdMmYyyyToDate(r.Date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const minDate = datesList[0] || new Date();
  const maxDate = datesList[datesList.length - 1] || new Date();
  if (fromEl && toEl) {
    fromEl.value = toIsoDateInputValue(minDate);
    toEl.value = toIsoDateInputValue(maxDate);
  }
  renderAll(state.rows);
}

export function applyCurrentFilter() {
  if (!state.rows || state.rows.length === 0) {
    alert(t('alerts.noDataLoaded'));
    return;
  }
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (!fromEl || !toEl) return;
  const from = new Date(fromEl.value);
  const to = new Date(toEl.value);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    alert(t('alerts.invalidDates'));
    return;
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  const filtered = state.rows.filter((r) => {
    const d = parseDdMmYyyyToDate(r.Date);
    return d && d >= from && d <= to;
  });
  renderAll(filtered);
}

async function handleManualRefresh() {
  const updateEl = document.getElementById('update');
  const refreshBtn = document.getElementById('refreshDataBtn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⏳';
  }
  try {
    const json = await fetchDataFromServer();
    if (isLocalStorageAvailable()) {
      setCachedData(json);
    }
    processDashboardData(json);
    await initializeDashboardWithData(json);
    await hydrateSummary(true);
    updateStatusUI(updateEl, json, false);
  } catch (error) {
    console.error('Error refreshing data:', error);
    if (refreshBtn) {
      refreshBtn.textContent = '❌';
      setTimeout(() => {
        refreshBtn.textContent = '🔄';
        refreshBtn.disabled = false;
      }, 2000);
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
    }
  }
}

async function updateDataInBackground() {
  try {
    const json = await fetchDataFromServer();
    const cached = getCachedData();
    if (!cached || !isCacheValid(cached.last_updated, json.last_updated)) {
      if (isLocalStorageAvailable()) {
        setCachedData(json);
      }
      processDashboardData(json);
      await initializeDashboardWithData(json);
      await hydrateSummary(true);
      const updateEl = document.getElementById('update');
      if (updateEl) {
        updateStatusUI(updateEl, json, false);
      }
    }
  } catch (error) {
    console.debug('Background update failed:', error);
  }
}

async function initializeDashboardWithData(json) {
  state.rows = json.data;
  setupModals();
  setupExportButtons();
  if (!state.rerenderAll) {
    state.rerenderAll = renderAll;
    window._rerenderAll = renderAll;
  }

  const resetBtn = document.getElementById('resetFilter');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', resetFilters);
    resetBtn.dataset.bound = 'true';
  }

  renderAll(state.rows);
  hydrateSummary(false);
}

export async function initDashboard() {
  const updateEl = document.getElementById('update');
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available, caching disabled');
  }

  let json;
  if (isLocalStorageAvailable()) {
    const cached = getCachedData();
    if (cached && cached.data) {
      json = cached.data;
      updateStatusUI(updateEl, json, true);
      processDashboardData(json);
      await initializeDashboardWithData(json);
      setTimeout(updateDataInBackground, 1000);
      return;
    }
  }

  updateEl.innerHTML = '<span class="spinner"></span>' + t('common.loading');
  try {
    json = await fetchDataFromServer();
    if (isLocalStorageAvailable()) {
      setCachedData(json);
    }
    updateStatusUI(updateEl, json, false);
    processDashboardData(json);
    await initializeDashboardWithData(json);
    await hydrateSummary(true);
  } catch (error) {
    console.error('Error fetching data from server:', error);
    if (isLocalStorageAvailable()) {
      const cached = getCachedData();
      if (cached && cached.data) {
        json = cached.data;
        updateStatusUI(updateEl, json, true);
        processDashboardData(json);
        await initializeDashboardWithData(json);
        const warningDiv = document.createElement('div');
        warningDiv.className = 'error-message';
        warningDiv.style.background = '#fff3cd';
        warningDiv.style.borderColor = '#ffc107';
        warningDiv.innerHTML = `
          <strong>${t('errors.cacheFallbackTitle')}</strong><br>
          ${t('errors.cacheFallbackMessage')}<br>
          <small>${t('errors.cacheFallbackHint')}</small>
        `;
        document.body.insertBefore(warningDiv, document.querySelector('.controls'));
        return;
      }
    }

    updateEl.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <strong>${t('errors.dataLoadTitle')}</strong><br>
      ${error.message}<br>
      <small>${t('errors.dataLoadDescription')}</small>
    `;
    document.body.insertBefore(errorDiv, document.querySelector('.controls'));
    document.querySelector('.controls')?.setAttribute('style', 'display:none');
    document.querySelector('.tabs')?.setAttribute('style', 'display:none');
    document.querySelector('.tabpanels')?.setAttribute('style', 'display:none');
    updateEl.textContent = t('errors.dataLoadShort');
    updateEl.style.color = '#d32f2f';
  }
}
