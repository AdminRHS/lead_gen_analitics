import { translations, localeMap } from '../i18n/index.js';
import { renderPairedBarChart, renderSingleBarChart, renderConversionRateChart } from '../charts.js';
import { parseDdMmYyyyToDate, toIsoDateInputValue, validateData, destroyIfExists, getIsoWeekInfo } from '../utils.js';
import { buildAggregates, buildCountryAggregates, buildWeeklyAggregates, buildMonthlyAggregates, buildLeaderboardAggregates, buildSourceAggregates } from '../aggregates.js';
import { getCachedData, setCachedData, isCacheValid, clearCache, getCacheInfo, isLocalStorageAvailable } from '../cache.js';
import {
  getDataHash,
  shouldRecalculateAggregations,
  updateAggregationCache,
  updatePairedBarChart,
  updateSingleBarChart,
  debounce,
  scheduleChartUpdate,
  batchChartUpdates
} from '../chartOptimizer.js';

const LANGUAGE_STORAGE_KEY = 'leadGenDashboardLang';
const supportedLanguages = ['en', 'uk', 'ru', 'de'];
const languageDisplayNames = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  de: 'Deutsch'
};
let currentLanguage = 'en';
const storedLanguagePreference = getStoredLanguagePreference();
if (storedLanguagePreference) {
  currentLanguage = storedLanguagePreference;
}

function getStoredLanguagePreference() {
  if (!isLocalStorageAvailable()) return null;
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return supportedLanguages.includes(stored) ? stored : null;
  } catch (error) {
    console.warn('Unable to read stored language preference:', error);
    return null;
  }
}

function getTranslationValue(locale, keyPath) {
  if (!locale || !keyPath) return null;
  return keyPath.split('.').reduce((acc, segment) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, segment)) {
      return acc[segment];
    }
    return null;
  }, locale);
}

function t(keyPath) {
  const localeValue = getTranslationValue(translations[currentLanguage], keyPath);
  if (localeValue !== null && localeValue !== undefined) return localeValue;
  const fallbackValue = getTranslationValue(translations.en, keyPath);
  return fallbackValue !== null && fallbackValue !== undefined ? fallbackValue : keyPath;
}

let lastStatusPayload = null;

function updateLoadingText() {
  if (lastStatusPayload) return;
  const updateEl = document.getElementById('update');
  if (updateEl) {
    updateEl.textContent = t('common.loading');
  }
}

function formatLocaleDateTime(date) {
  return date.toLocaleString(localeMap[currentLanguage] || 'en-US');
}

function getActiveTabLabel(activeTabId) {
  if (!activeTabId) return t('common.title');
  const tabKey = activeTabId.replace('tab-', '');
  const translationMap = {
    funnel: 'tabs.funnel',
    country: 'tabs.countries',
    weekly: 'tabs.weekly',
    monthly: 'tabs.monthly',
    leaderboard: 'tabs.leaderboard',
    source: 'tabs.source'
  };
  const key = translationMap[tabKey];
  return key ? t(key) : t('common.title');
}

function applyTranslations() {
  const translatableElements = document.querySelectorAll('[data-i18n]');
  translatableElements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const translation = t(key);
    if (translation === null || translation === undefined) return;
    if (attr) {
      el.setAttribute(attr, translation);
    } else {
      el.textContent = translation;
    }
  });

  updateThemeToggleButton();
  updateLanguageSelector();
  updateLoadingText();

  if (lastStatusPayload) {
    const updateEl = document.getElementById('update');
    if (updateEl) {
      updateStatusUI(updateEl, lastStatusPayload.json, lastStatusPayload.fromCache);
    }
  }

  if (typeof rerenderAll === 'function' && rows && rows.length > 0) {
    const sourceRows = lastFilteredRows.length > 0 ? lastFilteredRows : rows;
    rerenderAll(sourceRows);
  }
}

function initLanguageSelector() {
  const select = document.getElementById('languageSelect');
  if (!select) return;
  select.innerHTML = '';
  supportedLanguages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = languageDisplayNames[lang] || lang.toUpperCase();
    select.appendChild(option);
  });
  select.value = currentLanguage;
  select.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });
}

function updateLanguageSelector() {
  const select = document.getElementById('languageSelect');
  if (!select) return;
  select.value = currentLanguage;
}

function setLanguage(lang) {
  const normalized = supportedLanguages.includes(lang) ? lang : 'en';
  currentLanguage = normalized;
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('Unable to store language preference:', error);
    }
  }
  applyTranslations();
}

function initializeLanguage() {
  initLanguageSelector();
  applyTranslations();
}

const DAY_SUMMARY_METRICS = [
  { key: 'Created', labelKey: 'table.created' },
  { key: 'SentRequests', labelKey: 'table.sentRequests' },
  { key: 'Connected', labelKey: 'table.connected' },
  { key: 'PositiveReplies', labelKey: 'table.positiveReplies' },
  { key: 'Events', labelKey: 'table.events' }
];
const metricTranslationMap = {
  Created: 'table.created',
  'Sent Requests': 'table.sentRequests',
  SentRequests: 'table.sentRequests',
  Connected: 'table.connected',
  Replies: 'table.replies',
  'Total replies': 'table.replies',
  'Total Replies': 'table.replies',
  'Positive Replies': 'table.positiveReplies',
  PositiveReplies: 'table.positiveReplies',
  Events: 'table.events',
  'Events Created': 'table.events',
  'Conversion Rate (%)': 'charts.labels.conversionRatePercent'
};

function getMetricLabel(metric) {
  const translationKey = metricTranslationMap[metric];
  return translationKey ? t(translationKey) : metric;
}

let chartRefs = {
  createdFound: null,
  sentConnected: null,
  connectedReplies: null,
  repliesPositive: null,
  positiveEvents: null,
  countryCreatedFound: null,
  countrySentConnected: null,
  countryConnectedReplies: null,
  countryRepliesPositive: null,
  countryPositiveEvents: null,
  countryConnected: null,
  countryReplies: null,
  countryPositive: null,
  countryEvents: null,
  weekCreatedFound: null,
  weekSentConnected: null,
  weekConnectedReplies: null,
  weekRepliesPositive: null,
  weekPositiveEvents: null,
  monthCreatedFound: null,
  monthSentConnected: null,
  monthConnectedReplies: null,
  monthRepliesPositive: null,
  monthPositiveEvents: null
};
chartRefs.lbCreated = null;
chartRefs.lbSent = null;
chartRefs.lbPositive = null;
chartRefs.lbEvents = null;
chartRefs.monthConversionRate = null;
chartRefs.countryConversionRate = null;
chartRefs.lbConversionRate = null;
chartRefs.countryMonthlyPaired = null;
chartRefs.leadMonthlyPaired = null;
chartRefs.sourceConversionRate = null;
chartRefs.sourceCreatedToSent = null;
chartRefs.sourceSentToConnected = null;
chartRefs.sourceConnectedToReplies = null;
chartRefs.sourceRepliesToPositive = null;
chartRefs.sourcePositiveToEvents = null;
let lastFilteredRows = [];
let rerenderAll = null;
let currentDayData = null;
let rows = [];
const THEME_STORAGE_KEY = 'leadGenDashboardTheme';
let currentTheme = 'light';
let userHasExplicitTheme = false;
const prefersDarkSchemeQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;
let maxDate = new Date();

const aggregationCache = {
  dataHash: null,
  lastFilteredRows: null,
  funnel: null,
  country: null,
  weekly: null,
  monthly: null,
  leaderboard: null,
  source: null
};

const renderedTabs = {
  funnel: false,
  country: false,
  weekly: false,
  monthly: false,
  leaderboard: false,
  source: false
};

const chartElements = {};

function updateThemeToggleButton(theme = currentTheme) {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;
  const isDark = theme === 'dark';
  const label = isDark ? t('common.themeLight') : t('common.themeDark');
  toggleBtn.textContent = `${isDark ? '☀️ ' : '🌙 '}${label}`;
  toggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
}

function updateChartTheme(isDarkModeEnabled) {
  if (!window.Chart) return;
  const textColor = isDarkModeEnabled ? '#e2e8f0' : '#1b1f2f';
  const gridColor = isDarkModeEnabled ? 'rgba(148,163,184,0.3)' : 'rgba(0,0,0,0.08)';
  window.Chart.defaults.color = textColor;
  window.Chart.defaults.borderColor = gridColor;
  window.Chart.defaults.scale = window.Chart.defaults.scale || {};
  window.Chart.defaults.scale.grid = window.Chart.defaults.scale.grid || {};
  window.Chart.defaults.scale.grid.color = gridColor;
  window.Chart.defaults.scale.border = window.Chart.defaults.scale.border || {};
  window.Chart.defaults.scale.border.color = gridColor;
  window.Chart.defaults.scale.ticks = window.Chart.defaults.scale.ticks || {};
  window.Chart.defaults.scale.ticks.color = textColor;
  window.Chart.defaults.plugins = window.Chart.defaults.plugins || {};
  window.Chart.defaults.plugins.legend = window.Chart.defaults.plugins.legend || {};
  window.Chart.defaults.plugins.legend.labels = window.Chart.defaults.plugins.legend.labels || {};
  window.Chart.defaults.plugins.legend.labels.color = textColor;
}

function destroyAllCharts() {
  Object.keys(chartRefs).forEach((key) => {
    if (chartRefs[key]) {
      destroyIfExists(chartRefs[key]);
      chartRefs[key] = null;
    }
  });
}

function resetRenderedTabs() {
  Object.keys(renderedTabs).forEach((key) => {
    renderedTabs[key] = false;
  });
}

function refreshChartsForTheme() {
  if (!rows || rows.length === 0 || typeof rerenderAll !== 'function') return;
  destroyAllCharts();
  resetRenderedTabs();
  const sourceRows = lastFilteredRows.length > 0 ? lastFilteredRows : rows;
  rerenderAll(sourceRows);
}

function getStoredThemePreference() {
  if (!isLocalStorageAvailable()) return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      userHasExplicitTheme = true;
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read stored theme preference:', error);
  }
  return null;
}

function getInitialThemePreference() {
  const stored = getStoredThemePreference();
  if (stored) {
    return stored;
  }
  return prefersDarkSchemeQuery && prefersDarkSchemeQuery.matches ? 'dark' : 'light';
}

function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  currentTheme = normalized;
  document.body.classList.toggle('dark-theme', normalized === 'dark');
  document.documentElement.style.setProperty('color-scheme', normalized === 'dark' ? 'dark' : 'light');
  updateThemeToggleButton(normalized);
  updateChartTheme(normalized === 'dark');
  refreshChartsForTheme();

  if (persist && isLocalStorageAvailable()) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
      userHasExplicitTheme = true;
    } catch (error) {
      console.warn('Unable to persist theme preference:', error);
    }
  }
}

function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
  updateThemeToggleButton();
}

function setupSystemThemeListener() {
  if (!prefersDarkSchemeQuery) return;
  const handleChange = (event) => {
    if (isLocalStorageAvailable()) {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          return;
        }
      } catch (error) {
        console.warn('Unable to read stored theme preference during change event:', error);
      }
    }
    if (userHasExplicitTheme) return;
    applyTheme(event.matches ? 'dark' : 'light', { persist: false });
  };

  if (typeof prefersDarkSchemeQuery.addEventListener === 'function') {
    prefersDarkSchemeQuery.addEventListener('change', handleChange);
  } else if (typeof prefersDarkSchemeQuery.addListener === 'function') {
    prefersDarkSchemeQuery.addListener(handleChange);
  }
}

function initializeTheme() {
  const initialTheme = getInitialThemePreference();
  applyTheme(initialTheme, { persist: false });
  updateThemeToggleButton(initialTheme);
  setupSystemThemeListener();
}

// ===== Modal helpers =====
let openModalCount = 0;

function showModalOverlay(overlay) {
  if (!overlay || overlay.classList.contains('visible')) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  });
  openModalCount += 1;
  document.body.style.overflow = 'hidden';
}

function hideModalOverlay(overlay) {
  if (!overlay) return;
  const handleTransitionEnd = (event) => {
    if (event.target !== overlay) return;
    overlay.style.display = 'none';
    overlay.removeEventListener('transitionend', handleTransitionEnd);
  };
  overlay.addEventListener('transitionend', handleTransitionEnd);
  overlay.classList.remove('visible');
  setTimeout(() => {
    overlay.removeEventListener('transitionend', handleTransitionEnd);
    if (!overlay.classList.contains('visible')) {
      overlay.style.display = 'none';
    }
  }, 400);

  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.overflow = '';
  }
}

function applyCurrentFilter() {
  if (!rows || rows.length === 0) {
    alert(t('alerts.noDataLoaded'));
    return;
  }

  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');

  if (!fromEl || !toEl) {
    console.error('Date inputs not found');
    return;
  }

  const from = new Date(fromEl.value);
  const to = new Date(toEl.value);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    alert(t('alerts.invalidDates'));
    return;
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const filtered = rows.filter(r => {
    const d = parseDdMmYyyyToDate(r.Date);
    return d && d >= from && d <= to;
  });

  renderAll(filtered);
}

async function fetchDataFromServer() {
  const res = await fetch("data.json");

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
  }

  let json;
  try {
    json = await res.json();
  } catch (parseError) {
    throw new Error(`Failed to parse JSON: ${parseError.message}`);
  }

  validateData(json);

  return json;
}

function updateStatusUI(updateEl, json, fromCache = false) {
  if (!updateEl || !json) return;
  lastStatusPayload = { json, fromCache };
  const statusText = `${t('common.lastUpdated')}: ${json.last_updated || t('common.unknown')}`;
  const indicatorClass = fromCache ? 'cache-indicator' : 'cache-indicator server';
  const indicatorText = fromCache ? t('common.cacheFromCache') : t('common.cacheFromServer');
  const refreshTitle = t('common.refreshTooltip');
  updateEl.innerHTML = `<span>${statusText}</span><span class="${indicatorClass}">${indicatorText}</span><button class="refresh-btn" id="refreshDataBtn" title="${refreshTitle}">🔄</button>`;
  const refreshBtnEl = document.getElementById('refreshDataBtn');
  if (refreshBtnEl) {
    refreshBtnEl.addEventListener('click', handleManualRefresh);
  }
}

async function handleManualRefresh() {
  const updateEl = document.getElementById("update");
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
    if (typeof rows === 'undefined') {
      rows = [];
    }
    processDashboardData(json);
    await initializeDashboardWithData(json);
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
      if (typeof rows === 'undefined') {
        rows = [];
      }
      processDashboardData(json);
      await initializeDashboardWithData(json);
      const updateEl = document.getElementById("update");
      if (updateEl) {
        updateStatusUI(updateEl, json, false);
      }
    }
  } catch (error) {
    console.debug('Background update failed:', error);
  }
}

function processDashboardData(json) {
  if (!json || !json.data) {
    console.error('Invalid data structure in processDashboardData:', json);
    return;
  }

  rows = json.data || [];

  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  if (!rows || rows.length === 0) {
    console.warn('No rows data available in processDashboardData');
    return;
  }

  const datesList = rows
    .map(r => parseDdMmYyyyToDate(r.Date))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const minDate = datesList[0] || new Date();
  maxDate = datesList[datesList.length - 1] || new Date();

  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl && toEl) {
    fromEl.value = toIsoDateInputValue(minDate);
    toEl.value = toIsoDateInputValue(maxDate);
  }
}

function getChartElement(id) {
  if (!chartElements[id]) {
    chartElements[id] = document.getElementById(id);
  }
  return chartElements[id];
}

function renderOrUpdateChart(chartRef, elementId, renderFn, updateFn, ...args) {
  const element = getChartElement(elementId);
  if (!element) {
    console.warn(`Chart element not found: ${elementId}`);
    return null;
  }

  if (chartRef && chartRef.data) {
    if (updateFn && updateFn(chartRef, ...args)) {
      return chartRef;
    } else {
      destroyIfExists(chartRef);
    }
  }

  return renderFn(element, ...args);
}

function renderFunnelCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.funnel) {
    const agg = buildAggregates(filteredRows);
    aggregationCache.funnel = agg;
    updateAggregationCache(aggregationCache, filteredRows, { funnel: agg });
  }
  const agg = aggregationCache.funnel;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    chartRefs.createdFound = renderOrUpdateChart(
      chartRefs.createdFound,
      'chartCreatedToFound',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, createdLabel, agg.created, sentLabel, agg.sent
    );

    chartRefs.sentConnected = renderOrUpdateChart(
      chartRefs.sentConnected,
      'chartSentToConnected',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, sentLabel, agg.sent, connectedLabel, agg.connected
    );

    chartRefs.connectedReplies = renderOrUpdateChart(
      chartRefs.connectedReplies,
      'chartConnectedToReplies',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, connectedLabel, agg.connected, repliesLabel, agg.replies
    );

    chartRefs.repliesPositive = renderOrUpdateChart(
      chartRefs.repliesPositive,
      'chartRepliesToPositive',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, repliesLabel, agg.replies, positiveLabel, agg.positive
    );

    chartRefs.positiveEvents = renderOrUpdateChart(
      chartRefs.positiveEvents,
      'chartPositiveToEvents',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, positiveLabel, agg.positive, eventsLabel, agg.events
    );
  });
}

function renderCountryCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.country) {
    const countryAgg = buildCountryAggregates(filteredRows);
    aggregationCache.country = countryAgg;
    updateAggregationCache(aggregationCache, filteredRows, { country: countryAgg });
  }
  const countryAgg = aggregationCache.country;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');
    chartRefs.countryConversionRate = renderOrUpdateChart(
      chartRefs.countryConversionRate,
      'chartCountryConversionRate',
      (el, labels, label, data, color) => {
        const chart = renderConversionRateChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      null,
      countryAgg.countries, conversionRateLabel, countryAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );

    chartRefs.countryCreatedFound = renderOrUpdateChart(
      chartRefs.countryCreatedFound,
      'chartCountryCreatedToFound',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => {
        const chart = renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      updatePairedBarChart,
      countryAgg.countries, createdLabel, countryAgg.created, sentLabel, countryAgg.sent
    );

    chartRefs.countrySentConnected = renderOrUpdateChart(
      chartRefs.countrySentConnected,
      'chartCountrySentToConnected',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => {
        const chart = renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      updatePairedBarChart,
      countryAgg.countries, sentLabel, countryAgg.sent, connectedLabel, countryAgg.connected
    );

    chartRefs.countryConnectedReplies = renderOrUpdateChart(
      chartRefs.countryConnectedReplies,
      'chartCountryConnectedToReplies',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => {
        const chart = renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      updatePairedBarChart,
      countryAgg.countries, connectedLabel, countryAgg.connected, repliesLabel, countryAgg.replies
    );

    chartRefs.countryRepliesPositive = renderOrUpdateChart(
      chartRefs.countryRepliesPositive,
      'chartCountryRepliesToPositive',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => {
        const chart = renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      updatePairedBarChart,
      countryAgg.countries, repliesLabel, countryAgg.replies, positiveLabel, countryAgg.positive
    );

    chartRefs.countryPositiveEvents = renderOrUpdateChart(
      chartRefs.countryPositiveEvents,
      'chartCountryPositiveToEvents',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => {
        const chart = renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const country = labels[idx];
              openCountryInsight(country, filteredRows);
            }
          };
        }
        return chart;
      },
      updatePairedBarChart,
      countryAgg.countries, positiveLabel, countryAgg.positive, eventsLabel, countryAgg.events
    );
  });
}

function renderWeeklyCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.weekly) {
    const weekAgg = buildWeeklyAggregates(filteredRows);
    aggregationCache.weekly = weekAgg;
    updateAggregationCache(aggregationCache, filteredRows, { weekly: weekAgg });
  }
  const weekAgg = aggregationCache.weekly;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    chartRefs.weekCreatedFound = renderOrUpdateChart(
      chartRefs.weekCreatedFound, 'chartWeekCreatedToFound', renderPairedBarChart, updatePairedBarChart,
      weekAgg.weeks, createdLabel, weekAgg.created, sentLabel, weekAgg.sent
    );
    chartRefs.weekSentConnected = renderOrUpdateChart(
      chartRefs.weekSentConnected, 'chartWeekSentToConnected', renderPairedBarChart, updatePairedBarChart,
      weekAgg.weeks, sentLabel, weekAgg.sent, connectedLabel, weekAgg.connected
    );
    chartRefs.weekConnectedReplies = renderOrUpdateChart(
      chartRefs.weekConnectedReplies, 'chartWeekConnectedToReplies', renderPairedBarChart, updatePairedBarChart,
      weekAgg.weeks, connectedLabel, weekAgg.connected, repliesLabel, weekAgg.replies
    );
    chartRefs.weekRepliesPositive = renderOrUpdateChart(
      chartRefs.weekRepliesPositive, 'chartWeekRepliesToPositive', renderPairedBarChart, updatePairedBarChart,
      weekAgg.weeks, repliesLabel, weekAgg.replies, positiveLabel, weekAgg.positive
    );
    chartRefs.weekPositiveEvents = renderOrUpdateChart(
      chartRefs.weekPositiveEvents, 'chartWeekPositiveToEvents', renderPairedBarChart, updatePairedBarChart,
      weekAgg.weeks, positiveLabel, weekAgg.positive, eventsLabel, weekAgg.events
    );
  });
}

function renderMonthlyCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.monthly) {
    const monthAgg = buildMonthlyAggregates(filteredRows);
    aggregationCache.monthly = monthAgg;
    updateAggregationCache(aggregationCache, filteredRows, { monthly: monthAgg });
  }
  const monthAgg = aggregationCache.monthly;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');
    chartRefs.month

    chartRefs.monthConversionRate = renderOrUpdateChart(
      chartRefs.monthConversionRate, 'chartMonthConversionRate', renderConversionRateChart, null,
      monthAgg.months, conversionRateLabel, monthAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );
    chartRefs.monthCreatedFound = renderOrUpdateChart(
      chartRefs.monthCreatedFound, 'chartMonthCreatedToFound', renderPairedBarChart, updatePairedBarChart,
      monthAgg.months, createdLabel, monthAgg.created, sentLabel, monthAgg.sent
    );
    chartRefs.monthSentConnected = renderOrUpdateChart(
      chartRefs.monthSentConnected, 'chartMonthSentToConnected', renderPairedBarChart, updatePairedBarChart,
      monthAgg.months, sentLabel, monthAgg.sent, connectedLabel, monthAgg.connected
    );
    chartRefs.monthConnectedReplies = renderOrUpdateChart(
      chartRefs.monthConnectedReplies, 'chartMonthConnectedToReplies', renderPairedBarChart, updatePairedBarChart,
      monthAgg.months, connectedLabel, monthAgg.connected, repliesLabel, monthAgg.replies
    );
    chartRefs.monthRepliesPositive = renderOrUpdateChart(
      chartRefs.monthRepliesPositive, 'chartMonthRepliesToPositive', renderPairedBarChart, updatePairedBarChart,
      monthAgg.months, repliesLabel, monthAgg.replies, positiveLabel, monthAgg.positive
    );
    chartRefs.monthPositiveEvents = renderOrUpdateChart(
      chartRefs.monthPositiveEvents, 'chartMonthPositiveToEvents', renderPairedBarChart, updatePairedBarChart,
      monthAgg.months, positiveLabel, monthAgg.positive, eventsLabel, monthAgg.events
    );
  });
}

function renderLeaderboardCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.leaderboard) {
    const lbAgg = buildLeaderboardAggregates(filteredRows);
    aggregationCache.leaderboard = lbAgg;
    updateAggregationCache(aggregationCache, filteredRows, { leaderboard: lbAgg });
  }
  const lbAgg = aggregationCache.leaderboard;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events Created');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');
    chartRefs.lbConversionRate = renderOrUpdateChart(
      chartRefs.lbConversionRate,
      'chartLbConversionRate',
      (el, labels, label, data, color) => {
        const chart = renderConversionRateChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const name = labels[idx];
              openLeadInsight(name, filteredRows);
            }
          };
        }
        return chart;
      },
      null,
      lbAgg.names, conversionRateLabel, lbAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );

    chartRefs.lbCreated = renderOrUpdateChart(
      chartRefs.lbCreated,
      'chartLbCreated',
      (el, labels, label, data, color) => {
        const chart = renderSingleBarChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const name = labels[idx];
              openLeadInsight(name, filteredRows);
            }
          };
        }
        return chart;
      },
      updateSingleBarChart,
      lbAgg.names, createdLabel, lbAgg.created, 'rgba(54,162,235,0.6)'
    );

    chartRefs.lbSent = renderOrUpdateChart(
      chartRefs.lbSent,
      'chartLbSent',
      (el, labels, label, data, color) => {
        const chart = renderSingleBarChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const name = labels[idx];
              openLeadInsight(name, filteredRows);
            }
          };
        }
        return chart;
      },
      updateSingleBarChart,
      lbAgg.names, sentLabel, lbAgg.sent, 'rgba(153,102,255,0.6)'
    );

    chartRefs.lbPositive = renderOrUpdateChart(
      chartRefs.lbPositive,
      'chartLbPositive',
      (el, labels, label, data, color) => {
        const chart = renderSingleBarChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const name = labels[idx];
              openLeadInsight(name, filteredRows);
            }
          };
        }
        return chart;
      },
      updateSingleBarChart,
      lbAgg.names, positiveLabel, lbAgg.positive, 'rgba(75,192,192,0.6)'
    );

    chartRefs.lbEvents = renderOrUpdateChart(
      chartRefs.lbEvents,
      'chartLbEvents',
      (el, labels, label, data, color) => {
        const chart = renderSingleBarChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt, activeEls) => {
            const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const name = labels[idx];
              openLeadInsight(name, filteredRows);
            }
          };
        }
        return chart;
      },
      updateSingleBarChart,
      lbAgg.names, eventsLabel, lbAgg.events, 'rgba(255,206,86,0.6)'
    );
  });
}

function renderSourceCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, aggregationCache) || !aggregationCache.source) {
    const sourceAgg = buildSourceAggregates(filteredRows);
    aggregationCache.source = sourceAgg;
    updateAggregationCache(aggregationCache, filteredRows, { source: sourceAgg });
  }
  const sourceAgg = aggregationCache.source;

  scheduleChartUpdate(() => {
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Total replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    chartRefs.sourceConversionRate = renderOrUpdateChart(
      chartRefs.sourceConversionRate, 'chartSourceConversionRate', renderConversionRateChart, null,
      sourceAgg.sources, conversionRateLabel, sourceAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );
    chartRefs.sourceCreatedToSent = renderOrUpdateChart(
      chartRefs.sourceCreatedToSent, 'chartSourceCreatedToSent', renderPairedBarChart, updatePairedBarChart,
      sourceAgg.sources, createdLabel, sourceAgg.created, sentLabel, sourceAgg.sentRequests
    );
    chartRefs.sourceSentToConnected = renderOrUpdateChart(
      chartRefs.sourceSentToConnected, 'chartSourceSentToConnected', renderPairedBarChart, updatePairedBarChart,
      sourceAgg.sources, sentLabel, sourceAgg.sentRequests, connectedLabel, sourceAgg.connected
    );
    chartRefs.sourceConnectedToReplies = renderOrUpdateChart(
      chartRefs.sourceConnectedToReplies, 'chartSourceConnectedToReplies', renderPairedBarChart, updatePairedBarChart,
      sourceAgg.sources, connectedLabel, sourceAgg.connected, repliesLabel, sourceAgg.totalReplies
    );
    chartRefs.sourceRepliesToPositive = renderOrUpdateChart(
      chartRefs.sourceRepliesToPositive, 'chartSourceRepliesToPositive', renderPairedBarChart, updatePairedBarChart,
      sourceAgg.sources, repliesLabel, sourceAgg.totalReplies, positiveLabel, sourceAgg.positiveReplies
    );
    chartRefs.sourcePositiveToEvents = renderOrUpdateChart(
      chartRefs.sourcePositiveToEvents, 'chartSourcePositiveToEvents', renderPairedBarChart, updatePairedBarChart,
      sourceAgg.sources, positiveLabel, sourceAgg.positiveReplies, eventsLabel, sourceAgg.events
    );
  });
}
function renderAll(filteredRows) {
  lastFilteredRows = filteredRows;
  const activeTab = document.querySelector('.tabpanel.active')?.id;

  if (activeTab === 'tab-funnel' || !activeTab) {
    renderFunnelCharts(filteredRows);
    renderedTabs.funnel = true;
  }
  if (activeTab === 'tab-country') {
    renderCountryCharts(filteredRows);
    renderedTabs.country = true;
  }
  if (activeTab === 'tab-weekly') {
    renderWeeklyCharts(filteredRows);
    renderedTabs.weekly = true;
  }
  if (activeTab === 'tab-monthly') {
    renderMonthlyCharts(filteredRows);
    renderedTabs.monthly = true;
  }
  if (activeTab === 'tab-leaderboard') {
    renderLeaderboardCharts(filteredRows);
    renderedTabs.leaderboard = true;
  }
  if (activeTab === 'tab-source') {
    renderSourceCharts(filteredRows);
    renderedTabs.source = true;
  }
}

async function initDashboard() {
  const updateEl = document.getElementById("update");

  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available, caching disabled');
  }

  let json;
  let fromCache = false;

  if (isLocalStorageAvailable()) {
    const cached = getCachedData();

    if (cached && cached.data) {
      console.log('Using cached data:', {
        last_updated: cached.last_updated,
        cached_at: cached.cached_at
      });

      json = cached.data;
      fromCache = true;
      updateStatusUI(updateEl, json, true);

      if (typeof rows === 'undefined') {
        rows = [];
      }
      processDashboardData(json);

      setTimeout(() => {
        updateDataInBackground();
      }, 1000);

      await initializeDashboardWithData(json);
      return;
    } else {
      console.log('No valid cache found, will fetch from server');
    }
  }

  updateEl.innerHTML = '<span class="spinner"></span>Завантаження даних...';

  try {
    json = await fetchDataFromServer();

    if (isLocalStorageAvailable()) {
      const cached = setCachedData(json);
      if (cached) {
        console.log('Data saved to cache successfully');
      } else {
        console.warn('Failed to save data to cache');
      }
    }

    updateStatusUI(updateEl, json, false);
    if (typeof rows === 'undefined') {
      rows = [];
    }
    processDashboardData(json);
    await initializeDashboardWithData(json);

  } catch (error) {
    console.error('Error fetching data from server:', error);

    if (isLocalStorageAvailable()) {
      const cached = getCachedData();
      if (cached && cached.data) {
        console.log('Using cached data as fallback');
        json = cached.data;
        fromCache = true;
        updateStatusUI(updateEl, json, true);
        if (typeof rows === 'undefined') {
          rows = [];
        }
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

    const controls = document.querySelector('.controls');
    const tabs = document.querySelector('.tabs');
    const tabpanels = document.querySelector('.tabpanels');
    if (controls) controls.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (tabpanels) tabpanels.style.display = 'none';

    updateEl.textContent = t('errors.dataLoadShort');
    updateEl.style.color = '#d32f2f';
  }
}
async function initializeDashboardWithData(json) {
  rows = json.data;

  const overlay = document.getElementById('dayModalOverlay');
  const openBtn = document.getElementById('openDaySummary');
  const closeBtn = document.getElementById('closeDayModal');
  const doneBtn = document.getElementById('doneDay');
  const dayPicker = document.getElementById('dayPicker');
  const exportBtn = document.getElementById('exportDayCsv');

  const countryOverlay = document.getElementById('countryModalOverlay');
  const closeCountryBtn = document.getElementById('closeCountryModal');
  const doneCountryBtn = document.getElementById('doneCountry');
  function openCountryModal() {
    showModalOverlay(countryOverlay);
  }
  function closeCountryModal() {
    hideModalOverlay(countryOverlay);
  }
  closeCountryBtn.addEventListener('click', closeCountryModal);
  doneCountryBtn.addEventListener('click', closeCountryModal);
  countryOverlay.addEventListener('click', (e) => { if (e.target === countryOverlay) closeCountryModal(); });

  const leadOverlay = document.getElementById('leadModalOverlay');
  const closeLeadBtn = document.getElementById('closeLeadModal');
  const doneLeadBtn = document.getElementById('doneLead');
  function openLeadModal() {
    showModalOverlay(leadOverlay);
  }
  function closeLeadModal() {
    hideModalOverlay(leadOverlay);
  }
  closeLeadBtn.addEventListener('click', closeLeadModal);
  doneLeadBtn.addEventListener('click', closeLeadModal);
  leadOverlay.addEventListener('click', (e) => { if (e.target === leadOverlay) closeLeadModal(); });

  function openModal() {
    showModalOverlay(overlay);
  }
  function closeModal() {
    hideModalOverlay(overlay);
  }
  openBtn.addEventListener('click', () => {
    dayPicker.value = toIsoDateInputValue(maxDate);
    renderDaySummary(new Date(dayPicker.value));
    const sortSelect = document.getElementById('sortColumn');
    if (sortSelect) {
      if (!sortSelect.__bound) {
        sortSelect.addEventListener('change', () => {
          const col = sortSelect.value || 'Created';
          sortDayData(col);
        });
        sortSelect.__bound = true;
      }
      sortDayData(sortSelect.value || 'Created');
    }
    openModal();
  });
  closeBtn.addEventListener('click', closeModal);
  doneBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  dayPicker.addEventListener('change', () => {
    const d = new Date(dayPicker.value);
    renderDaySummary(d);
    const sortSelect = document.getElementById('sortColumn');
    if (sortSelect) sortDayData(sortSelect.value || 'Created');
  });

  exportBtn.addEventListener('click', () => {
    const d = new Date(dayPicker.value);
    const dataForDay = getRowsForDay(d);
    const csv = buildCsvForDay(dataForDay);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-summary-${toIsoDateInputValue(d)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const exportDayExcelBtn = document.getElementById('exportDayExcel');
  if (exportDayExcelBtn) {
    exportDayExcelBtn.addEventListener('click', () => {
      try {
        if (!window.XLSX) {
          alert(t('alerts.excelLibraryMissing'));
          return;
        }

        const d = new Date(dayPicker.value);
        const dataForDay = getRowsForDay(d);

        if (!dataForDay || dataForDay.length === 0) {
          alert(t('alerts.noDataForDay'));
          return;
        }

        const wb = XLSX.utils.book_new();

        const byName = {};
        for (const r of dataForDay) {
          const name = r.Name || 'Unknown';
          if (!byName[name]) {
            byName[name] = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };
          }
          byName[name].Created += Number(r["Created"] || 0);
          byName[name].SentRequests += Number(r["Sent Requests"] || 0);
          byName[name].Connected += Number(r["Connected"] || 0);
          byName[name].PositiveReplies += Number(r["Positive Replies"] || 0);
          byName[name].Events += Number(r["Events Created"] || 0);
        }

        const tableData = Object.keys(byName).map(name => ({
          Name: name,
          Created: byName[name].Created,
          'Sent Requests': byName[name].SentRequests,
          Connected: byName[name].Connected,
          'Positive Replies': byName[name].PositiveReplies,
          Events: byName[name].Events
        }));

        const sortSelect = document.getElementById('sortColumn');
        const sortCol = sortSelect ? sortSelect.value : 'Created';
        const sortMap = {
          'Created': 'Created',
          'SentRequests': 'Sent Requests',
          'Connected': 'Connected',
          'PositiveReplies': 'Positive Replies',
          'Events': 'Events'
        };
        const sortKey = sortMap[sortCol] || 'Created';
        tableData.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

        const totals = tableData.reduce((acc, row) => {
          acc.Created += row.Created;
          acc['Sent Requests'] += row['Sent Requests'];
          acc.Connected += row.Connected;
          acc['Positive Replies'] += row['Positive Replies'];
          acc.Events += row.Events;
          return acc;
        }, { Created: 0, 'Sent Requests': 0, Connected: 0, 'Positive Replies': 0, Events: 0 });

        tableData.push({
          Name: 'TOTAL',
          Created: totals.Created,
          'Sent Requests': totals['Sent Requests'],
          Connected: totals.Connected,
          'Positive Replies': totals['Positive Replies'],
          Events: totals.Events
        });

        const ws = XLSX.utils.json_to_sheet(tableData);
        XLSX.utils.book_append_sheet(wb, ws, 'Day Summary');
        const wsRaw = XLSX.utils.json_to_sheet(dataForDay);
        XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');

        const filename = `day-summary-${toIsoDateInputValue(d)}.xlsx`;
        XLSX.writeFile(wb, filename);

        console.log('Day Summary Excel export completed:', filename);
      } catch (error) {
        console.error('Error exporting day summary to Excel:', error);
        alert(t('alerts.exportExcelError') + error.message);
      }
    });
  }

  const exportDayPDFBtn = document.getElementById('exportDayPDF');
  if (exportDayPDFBtn) {
    exportDayPDFBtn.addEventListener('click', async () => {
      try {
        if (!window.jspdf) {
          alert(t('alerts.pdfLibraryMissing'));
          return;
        }

        const { jsPDF } = window.jspdf;
        const d = new Date(dayPicker.value);
        const dataForDay = getRowsForDay(d);

        if (!dataForDay || dataForDay.length === 0) {
          alert(t('alerts.noDataForDay'));
          return;
        }

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 20;
        const margin = 15;
        const lineHeight = 7;

        doc.setFontSize(20);
        doc.text(t('pdf.daySummary'), margin, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.text(`${t('pdf.date')}: ${toIsoDateInputValue(d)}`, margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.text(`${t('pdf.exported')}: ${formatLocaleDateTime(new Date())}`, margin, yPos);
        yPos += 15;

        const byName = {};
        for (const r of dataForDay) {
          const name = r.Name || 'Unknown';
          if (!byName[name]) {
            byName[name] = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };
          }
          byName[name].Created += Number(r["Created"] || 0);
          byName[name].SentRequests += Number(r["Sent Requests"] || 0);
          byName[name].Connected += Number(r["Connected"] || 0);
          byName[name].PositiveReplies += Number(r["Positive Replies"] || 0);
          byName[name].Events += Number(r["Events Created"] || 0);
        }

        const sortSelect = document.getElementById('sortColumn');
        const sortCol = sortSelect ? sortSelect.value : 'Created';
        const sortMap = {
          'Created': 'Created',
          'SentRequests': 'Sent Requests',
          'Connected': 'Connected',
          'PositiveReplies': 'Positive Replies',
          'Events': 'Events'
        };
        const sortKey = sortMap[sortCol] || 'Created';
        const sortedNames = Object.keys(byName).sort((a, b) => {
          const valueA = byName[a][sortKey] || 0;
          const valueB = byName[b][sortKey] || 0;
          return valueB - valueA;
        });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(t('pdf.summaryByName'), margin, yPos);
        yPos += 10;

        const colWidths = [50, 30, 35, 30, 35, 25];
        const headers = [
          t('table.name'),
          t('table.created'),
          t('table.sentRequests'),
          t('table.connected'),
          t('table.positiveReplies'),
          t('table.events')
        ];
        let xPos = margin;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        headers.forEach((header, idx) => {
          doc.text(header, xPos, yPos);
          xPos += colWidths[idx];
        });
        yPos += lineHeight + 2;

        doc.setFont('helvetica', 'normal');
        let totals = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };

        sortedNames.forEach(name => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
            xPos = margin;
            doc.setFont('helvetica', 'bold');
            headers.forEach((header, idx) => {
              doc.text(header, xPos, yPos);
              xPos += colWidths[idx];
            });
            yPos += lineHeight + 2;
            doc.setFont('helvetica', 'normal');
          }

          const row = byName[name];
          totals.Created += row.Created;
          totals.SentRequests += row.SentRequests;
          totals.Connected += row.Connected;
          totals.PositiveReplies += row.PositiveReplies;
          totals.Events += row.Events;

          xPos = margin;
          doc.text(name.substring(0, 20), xPos, yPos);
          xPos += colWidths[0];
          doc.text(row.Created.toString(), xPos, yPos, { align: 'right' });
          xPos += colWidths[1];
          doc.text(row.SentRequests.toString(), xPos, yPos, { align: 'right' });
          xPos += colWidths[2];
          doc.text(row.Connected.toString(), xPos, yPos, { align: 'right' });
          xPos += colWidths[3];
          doc.text(row.PositiveReplies.toString(), xPos, yPos, { align: 'right' });
          xPos += colWidths[4];
          doc.text(row.Events.toString(), xPos, yPos, { align: 'right' });
          yPos += lineHeight;
        });

        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        yPos += 3;
        doc.setFont('helvetica', 'bold');
        xPos = margin;
        doc.text(t('table.total').toUpperCase(), xPos, yPos);
        xPos += colWidths[0];
        doc.text(totals.Created.toString(), xPos, yPos, { align: 'right' });
        xPos += colWidths[1];
        doc.text(totals.SentRequests.toString(), xPos, yPos, { align: 'right' });
        xPos += colWidths[2];
        doc.text(totals.Connected.toString(), xPos, yPos, { align: 'right' });
        xPos += colWidths[3];
        doc.text(totals.PositiveReplies.toString(), xPos, yPos, { align: 'right' });
        xPos += colWidths[4];
        doc.text(totals.Events.toString(), xPos, yPos, { align: 'right' });

        const filename = `day-summary-${toIsoDateInputValue(d)}.pdf`;
        doc.save(filename);

        console.log('Day Summary PDF export completed:', filename);
      } catch (error) {
        console.error('Error exporting day summary to PDF:', error);
        alert(t('alerts.exportPdfError') + error.message);
      }
    });
  }

  rerenderAll = renderAll;
  window._rerenderAll = renderAll;

  document.getElementById('resetFilter').addEventListener('click', () => {
    const fromEl = document.getElementById('fromDate');
    const toEl = document.getElementById('toDate');
    const datesList = rows
      .map(r => parseDdMmYyyyToDate(r.Date))
      .filter(Boolean)
      .sort((a,b) => a - b);
    const minDate = datesList[0] || new Date();
    const maxDate = datesList[datesList.length - 1] || new Date();
    if (fromEl && toEl) {
      fromEl.value = toIsoDateInputValue(minDate);
      toEl.value = toIsoDateInputValue(maxDate);
    }
    renderAll(rows);
  });

  renderAll(rows);
}
function getRowsForDay(dateObj) {
  const target = toIsoDateInputValue(dateObj);
  return rows.filter(r => {
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) return false;
    return toIsoDateInputValue(d) === target;
  });
}

function sortDayData(sortColumn) {
  if (!currentDayData) return;

  const sortedNames = Object.keys(currentDayData).sort((a, b) => {
    const valueA = currentDayData[a][sortColumn] || 0;
    const valueB = currentDayData[b][sortColumn] || 0;
    return valueB - valueA;
  });

  const totals = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };
  let html = '';
  html += '<table class="summary-table">';
  const headerCells = DAY_SUMMARY_METRICS.map(metric => `<th>${t(metric.labelKey)}</th>`).join('');
  html += `<thead><tr><th>${t('table.name')}</th>${headerCells}</tr></thead>`;
  html += '<tbody>';

  for (const n of sortedNames) {
    const row = currentDayData[n];
    totals.Created += row.Created;
    totals.SentRequests += row.SentRequests;
    totals.Connected += row.Connected;
    totals.PositiveReplies += row.PositiveReplies;
    totals.Events += row.Events;
    const metricCells = DAY_SUMMARY_METRICS.map(metric => `<td>${row[metric.key]}</td>`).join('');
    html += `<tr><td>${n}</td>${metricCells}</tr>`;
  }

  html += '</tbody>';
  const totalCells = DAY_SUMMARY_METRICS.map(metric => `<td>${totals[metric.key]}</td>`).join('');
  html += `<tfoot><tr><td>${t('table.total')}</td>${totalCells}</tr></tfoot>`;
  html += '</table>';

  document.getElementById('daySummaryContainer').innerHTML = html;
}

function renderDaySummary(dateObj) {
  const dayRows = getRowsForDay(dateObj);
  const byName = {};
  for (const r of dayRows) {
    const name = r.Name || 'Unknown';
    if (!byName[name]) {
      byName[name] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    byName[name].Created += Number(r["Created"] || 0);
    byName[name].SentRequests += Number(r["Sent Requests"] || 0);
    byName[name].Connected += Number(r["Connected"] || 0);
    byName[name].PositiveReplies += Number(r["Positive Replies"] || 0);
    byName[name].Events += Number(r["Events Created"] || 0);
  }

  currentDayData = byName;
  const sortSelect = document.getElementById('sortColumn');
  const selected = sortSelect ? sortSelect.value : 'Created';
  sortDayData(selected);
  document.getElementById('dayModalTitle').textContent = `${t('modals.daySummary')} — ${toIsoDateInputValue(dateObj)}`;
}

function buildCsvForDay(dayRows) {
  const headers = ["Name","Created","Sent Requests","Connected","Positive Replies","Events"];
  const byName = {};
  for (const r of dayRows) {
    const name = r.Name || 'Unknown';
    if (!byName[name]) {
      byName[name] = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };
    }
    byName[name].Created += Number(r["Created"] || 0);
    byName[name].SentRequests += Number(r["Sent Requests"] || 0);
    byName[name].Connected += Number(r["Connected"] || 0);
    byName[name].PositiveReplies += Number(r["Positive Replies"] || 0);
    byName[name].Events += Number(r["Events Created"] || 0);
  }
  let csv = headers.join(',') + '\n';
  for (const name of Object.keys(byName)) {
    const r = byName[name];
    csv += `${name},${r.Created},${r.SentRequests},${r.Connected},${r.PositiveReplies},${r.Events}\n`;
  }
  return csv;
}
function initTabs() {
  const tabs = [
    { btn: document.getElementById('tab-funnel-btn'), panel: document.getElementById('tab-funnel') },
    { btn: document.getElementById('tab-country-btn'), panel: document.getElementById('tab-country') },
    { btn: document.getElementById('tab-weekly-btn'), panel: document.getElementById('tab-weekly') },
    { btn: document.getElementById('tab-monthly-btn'), panel: document.getElementById('tab-monthly') },
    { btn: document.getElementById('tab-leaderboard-btn'), panel: document.getElementById('tab-leaderboard') },
    { btn: document.getElementById('tab-source-btn'), panel: document.getElementById('tab-source') }
  ];

  const debouncedResizeCharts = debounce((panelId) => {
    scheduleChartUpdate(() => {
      if (panelId === 'tab-funnel') {
        [chartRefs.createdFound, chartRefs.sentConnected, chartRefs.connectedReplies, chartRefs.repliesPositive, chartRefs.positiveEvents]
          .forEach(c => c && typeof c.resize === 'function' && c.resize());
      } else if (panelId === 'tab-country') {
        [
          chartRefs.countryConversionRate,
          chartRefs.countryCreatedFound,
          chartRefs.countrySentConnected,
          chartRefs.countryConnectedReplies,
          chartRefs.countryRepliesPositive,
          chartRefs.countryPositiveEvents
        ].forEach(c => c && typeof c.resize === 'function' && c.resize());
      } else if (panelId === 'tab-weekly') {
        [chartRefs.weekCreatedFound, chartRefs.weekSentConnected, chartRefs.weekConnectedReplies, chartRefs.weekRepliesPositive, chartRefs.weekPositiveEvents]
          .forEach(c => c && typeof c.resize === 'function' && c.resize());
      } else if (panelId === 'tab-monthly') {
        [chartRefs.monthConversionRate, chartRefs.monthCreatedFound, chartRefs.monthSentConnected, chartRefs.monthConnectedReplies, chartRefs.monthRepliesPositive, chartRefs.monthPositiveEvents]
          .forEach(c => c && typeof c.resize === 'function' && c.resize());
      } else if (panelId === 'tab-leaderboard') {
        [chartRefs.lbConversionRate, chartRefs.lbCreated, chartRefs.lbSent, chartRefs.lbPositive, chartRefs.lbEvents]
          .forEach(c => c && typeof c.resize === 'function' && c.resize());
      } else if (panelId === 'tab-source') {
        [chartRefs.sourceConversionRate, chartRefs.sourceCreatedToSent, chartRefs.sourceSentToConnected, chartRefs.sourceConnectedToReplies, chartRefs.sourceRepliesToPositive, chartRefs.sourcePositiveToEvents]
          .forEach(c => c && typeof c.resize === 'function' && c.resize());
      }
    });
  }, 200);

  function resizeChartsFor(panelId) {
    debouncedResizeCharts(panelId);
  }

  function activate(targetBtn) {
    const currentActivePanel = tabs.find(({panel}) => panel.classList.contains('active'))?.panel;
    const newPanel = tabs.find(({btn}) => btn === targetBtn)?.panel;
    const panelId = targetBtn.getAttribute('aria-controls');

    if (currentActivePanel === newPanel) return;

    tabs.forEach(({btn}) => {
      const active = btn === targetBtn;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (newPanel && lastFilteredRows.length > 0) {
      const tabKey = panelId.replace('tab-', '');
      if (!renderedTabs[tabKey]) {
        if (panelId === 'tab-funnel') {
          renderFunnelCharts(lastFilteredRows);
        } else if (panelId === 'tab-country') {
          renderCountryCharts(lastFilteredRows);
        } else if (panelId === 'tab-weekly') {
          renderWeeklyCharts(lastFilteredRows);
        } else if (panelId === 'tab-monthly') {
          renderMonthlyCharts(lastFilteredRows);
        } else if (panelId === 'tab-leaderboard') {
          renderLeaderboardCharts(lastFilteredRows);
        } else if (panelId === 'tab-source') {
          renderSourceCharts(lastFilteredRows);
        }
        renderedTabs[tabKey] = true;
      }
    }

    if (currentActivePanel) {
      currentActivePanel.style.opacity = '0';
      currentActivePanel.style.transform = 'translateY(20px)';

      setTimeout(() => {
        currentActivePanel.classList.remove('active');

        if (newPanel) {
          newPanel.style.display = 'block';
          newPanel.style.opacity = '0';
          newPanel.style.transform = 'translateY(20px)';
          newPanel.classList.add('active');

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              newPanel.style.opacity = '1';
              newPanel.style.transform = 'translateY(0)';

              setTimeout(() => {
                newPanel.style.opacity = '';
                newPanel.style.transform = '';
                newPanel.style.display = '';
                resizeChartsFor(panelId);
              }, 300);
            });
          });
        }
      }, 300);
    } else if (newPanel) {
      newPanel.style.display = 'block';
      newPanel.style.opacity = '0';
      newPanel.style.transform = 'translateY(20px)';
      newPanel.classList.add('active');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newPanel.style.opacity = '1';
          newPanel.style.transform = 'translateY(0)';

          setTimeout(() => {
            newPanel.style.opacity = '';
            newPanel.style.transform = '';
            newPanel.style.display = '';
            resizeChartsFor(panelId);
          }, 300);
        });
      });
    }

    tabs.forEach(({panel}) => {
      if (panel !== currentActivePanel && panel !== newPanel) {
        panel.classList.remove('active');
      }
    });
  }
  tabs.forEach(({btn}) => btn.addEventListener('click', () => activate(btn)));
}
function exportToExcel() {
  try {
    if (!window.XLSX) {
      alert(t('alerts.excelLibraryMissing'));
      return;
    }

    const activeTab = document.querySelector('.tabpanel.active')?.id;
    const tabName = activeTab ? activeTab.replace('tab-', '') : 'dashboard';

    if (typeof rows === 'undefined') {
      console.error('rows is not defined in exportToExcel');
      alert(t('alerts.dataNotLoaded'));
      return;
    }

    const filteredRows = lastFilteredRows.length > 0 ? lastFilteredRows : (rows || []);

    if (!filteredRows || filteredRows.length === 0) {
      alert(t('alerts.noDataToExport'));
      return;
    }

    const wb = XLSX.utils.book_new();

    const wsData = XLSX.utils.json_to_sheet(filteredRows);
    XLSX.utils.book_append_sheet(wb, wsData, 'Data');

    if (aggregationCache.funnel) {
      const funnelData = [];
      const agg = aggregationCache.funnel;
      for (let i = 0; i < agg.dates.length; i++) {
        funnelData.push({
          Date: agg.dates[i],
          Created: agg.created[i],
          'Sent Requests': agg.sent[i],
          Connected: agg.connected[i],
          Replies: agg.replies[i],
          'Positive Replies': agg.positive[i],
          Events: agg.events[i]
        });
      }
      const wsFunnel = XLSX.utils.json_to_sheet(funnelData);
      XLSX.utils.book_append_sheet(wb, wsFunnel, 'Funnel');
    }

    if (aggregationCache.country) {
      const countryData = [];
      const agg = aggregationCache.country;
      for (let i = 0; i < agg.countries.length; i++) {
        countryData.push({
          Country: agg.countries[i],
          Created: agg.created[i],
          'Sent Requests': agg.sent[i],
          Connected: agg.connected[i],
          Replies: agg.replies[i],
          'Positive Replies': agg.positive[i],
          Events: agg.events[i],
          'Conversion Rate %': agg.conversionRates[i]
        });
      }
      const wsCountry = XLSX.utils.json_to_sheet(countryData);
      XLSX.utils.book_append_sheet(wb, wsCountry, 'Countries');
    }

    if (aggregationCache.weekly) {
      const weekData = [];
      const agg = aggregationCache.weekly;
      for (let i = 0; i < agg.weeks.length; i++) {
        weekData.push({
          Week: agg.weeks[i],
          Created: agg.created[i],
          'Sent Requests': agg.sent[i],
          Connected: agg.connected[i],
          Replies: agg.replies[i],
          'Positive Replies': agg.positive[i],
          Events: agg.events[i]
        });
      }
      const wsWeek = XLSX.utils.json_to_sheet(weekData);
      XLSX.utils.book_append_sheet(wb, wsWeek, 'Weekly');
    }

    if (aggregationCache.monthly) {
      const monthData = [];
      const agg = aggregationCache.monthly;
      for (let i = 0; i < agg.months.length; i++) {
        monthData.push({
          Month: agg.months[i],
          Created: agg.created[i],
          'Sent Requests': agg.sent[i],
          Connected: agg.connected[i],
          Replies: agg.replies[i],
          'Positive Replies': agg.positive[i],
          Events: agg.events[i],
          'Conversion Rate %': agg.conversionRates[i]
        });
      }
      const wsMonth = XLSX.utils.json_to_sheet(monthData);
      XLSX.utils.book_append_sheet(wb, wsMonth, 'Monthly');
    }

    if (aggregationCache.leaderboard) {
      const lbData = [];
      const agg = aggregationCache.leaderboard;
      for (let i = 0; i < agg.names.length; i++) {
        lbData.push({
          Name: agg.names[i],
          Created: agg.created[i],
          'Sent Requests': agg.sent[i],
          'Positive Replies': agg.positive[i],
          Events: agg.events[i],
          'Conversion Rate %': agg.conversionRates[i]
        });
      }
      const wsLb = XLSX.utils.json_to_sheet(lbData);
      XLSX.utils.book_append_sheet(wb, wsLb, 'Leaderboard');
    }

    if (aggregationCache.source) {
      const sourceData = [];
      const agg = aggregationCache.source;
      for (let i = 0; i < agg.sources.length; i++) {
        sourceData.push({
          Source: agg.sources[i],
          Created: agg.created[i],
          'Sent Requests': agg.sentRequests[i],
          Connected: agg.connected[i],
          'Total Replies': agg.totalReplies[i],
          'Positive Replies': agg.positiveReplies[i],
          Events: agg.events[i],
          'Conversion Rate %': agg.conversionRates[i]
        });
      }
      const wsSource = XLSX.utils.json_to_sheet(sourceData);
      XLSX.utils.book_append_sheet(wb, wsSource, 'Source');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `lead-gen-dashboard-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    console.log('Excel export completed:', filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(t('alerts.exportExcelError') + error.message);
  }
}

async function exportToPDF() {
  try {
    if (!window.jspdf) {
      alert(t('alerts.pdfLibraryMissing'));
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    const margin = 15;
    const lineHeight = 7;

    doc.setFontSize(20);
    doc.text(t('common.title'), margin, yPos);
    yPos += 10;

    const fromDate = document.getElementById('fromDate')?.value || 'N/A';
    const toDate = document.getElementById('toDate')?.value || 'N/A';
    doc.setFontSize(12);
    doc.text(`${t('pdf.dateRange')}: ${fromDate} → ${toDate}`, margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`${t('pdf.exported')}: ${formatLocaleDateTime(new Date())}`, margin, yPos);
    yPos += 15;

    const activeTab = document.querySelector('.tabpanel.active')?.id;
    const tabLabel = getActiveTabLabel(activeTab);

    doc.setFontSize(14);
    doc.text(`${t('pdf.activeTab')}: ${tabLabel}`, margin, yPos);
    yPos += 10;

    if (typeof rows === 'undefined') {
      console.error('rows is not defined in exportToPDF');
      alert(t('alerts.dataNotLoaded'));
      return;
    }

    const filteredRows = lastFilteredRows.length > 0 ? lastFilteredRows : (rows || []);
    if (filteredRows && filteredRows.length > 0) {
      const totals = {
        Created: 0,
        'Sent Requests': 0,
        Connected: 0,
        'Total replies': 0,
        'Positive Replies': 0,
        'Events Created': 0
      };

      filteredRows.forEach(row => {
        totals.Created += Number(row['Created'] || 0);
        totals['Sent Requests'] += Number(row['Sent Requests'] || 0);
        totals.Connected += Number(row['Connected'] || 0);
        totals['Total replies'] += Number(row['Total replies'] || 0);
        totals['Positive Replies'] += Number(row['Positive Replies'] || 0);
        totals['Events Created'] += Number(row['Events Created'] || 0);
      });

      const tableData = [
        [t('table.metric'), t('table.total')],
        [t('table.created'), totals.Created.toString()],
        [t('table.sentRequests'), totals['Sent Requests'].toString()],
        [t('table.connected'), totals.Connected.toString()],
        [t('table.replies'), totals['Total replies'].toString()],
        [t('table.positiveReplies'), totals['Positive Replies'].toString()],
        [t('table.events'), totals['Events Created'].toString()]
      ];

      doc.setFontSize(12);
      doc.text(t('pdf.summaryTotals'), margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      let startX = margin;
      const colWidth = (pageWidth - 2 * margin) / 2;

      tableData.forEach((row, idx) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
        doc.text(row[0], startX, yPos);
        doc.text(row[1], startX + colWidth, yPos, { align: 'right' });
        yPos += lineHeight;
      });

      yPos += 10;
    }

    if (activeTab === 'tab-country' && aggregationCache.country) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(t('pdf.topCountries'), margin, yPos);
      yPos += 8;

      const agg = aggregationCache.country;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const topCount = Math.min(10, agg.countries.length);
      for (let i = 0; i < topCount; i++) {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
        }

        const text = `${i + 1}. ${agg.countries[i]}: ${agg.events[i]} ${t('table.events')} (${agg.conversionRates[i].toFixed(2)}% ${t('table.crShort')})`;
        doc.text(text, margin, yPos);
        yPos += lineHeight;
      }
    }

    if (activeTab === 'tab-leaderboard' && aggregationCache.leaderboard) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(t('pdf.topGenerators'), margin, yPos);
      yPos += 8;

      const agg = aggregationCache.leaderboard;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const topCount = Math.min(10, agg.names.length);
      for (let i = 0; i < topCount; i++) {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
        }

        const text = `${i + 1}. ${agg.names[i]}: ${agg.events[i]} ${t('table.events')} (${agg.conversionRates[i].toFixed(2)}% ${t('table.crShort')})`;
        doc.text(text, margin, yPos);
        yPos += lineHeight;
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `lead-gen-dashboard-${dateStr}.pdf`;
    doc.save(filename);

    console.log('PDF export completed:', filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert(t('alerts.exportPdfError') + error.message);
  }
}
initializeLanguage();
initializeTheme();
initTabs();
initDashboard();
initThemeToggle();

const applyFilterBtn = document.getElementById('applyFilter');
if (applyFilterBtn) {
  applyFilterBtn.addEventListener('click', applyCurrentFilter);
}

function aggregateCountrySummary(countryName, rows, fromDate, toDate) {
  const acc = { Created: 0, SentRequests: 0, Connected: 0, Replies: 0, PositiveReplies: 0, Events: 0 };
  for (const r of rows) {
    if ((r.Country || 'Unknown') !== countryName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    acc.Created += Number(r['Created'] || 0);
    acc.SentRequests += Number(r['Sent Requests'] || 0);
    acc.Connected += Number(r['Connected'] || 0);
    acc.Replies += Number(r['Total replies'] || 0);
    acc.PositiveReplies += Number(r['Positive Replies'] || 0);
    acc.Events += Number(r['Events Created'] || 0);
  }
  return acc;
}

function aggregateCountryMonthly(countryName, rows, fromDate, toDate) {
  const byMonth = {};
  for (const r of rows) {
    if ((r.Country || 'Unknown') !== countryName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { Created: 0, Events: 0 };
    byMonth[key].Created += Number(r['Created'] || 0);
    byMonth[key].Events += Number(r['Events Created'] || 0);
  }
  const months = Object.keys(byMonth).sort();
  return { months, created: months.map(m => byMonth[m].Created), events: months.map(m => byMonth[m].Events) };
}

function aggregateCountryTopGenerators(countryName, rows, fromDate, toDate, limit = 5) {
  const byName = {};
  for (const r of rows) {
    if ((r.Country || 'Unknown') !== countryName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    const name = r.Name || 'Unknown';
    if (!byName[name]) byName[name] = { Created: 0, Events: 0 };
    byName[name].Created += Number(r['Created'] || 0);
    byName[name].Events += Number(r['Events Created'] || 0);
  }
  const entries = Object.entries(byName).map(([name, v]) => ({ name, ...v, cr: v.Created > 0 ? (v.Events / v.Created) * 100 : 0 }));
  entries.sort((a,b) => b.cr - a.cr || b.Events - a.Events);
  return entries.slice(0, limit);
}

function openCountryInsight(countryName, rows) {
  const from = new Date(document.getElementById('fromDate').value);
  const to = new Date(document.getElementById('toDate').value);
  from.setHours(0,0,0,0);
  to.setHours(23,59,59,999);

  const sum = aggregateCountrySummary(countryName, rows, from, to);
  const cr = sum.Created > 0 ? (sum.Events / sum.Created) * 100 : 0;
  const sentToConn = sum.SentRequests > 0 ? (sum.Connected / sum.SentRequests) * 100 : 0;
  const posToRep = sum.Replies > 0 ? (sum.PositiveReplies / sum.Replies) * 100 : 0;
  const summaryHtml = `
    <div class="summary-table-wrapper">
      <table class="summary-table">
        <thead><tr><th>${t('table.metric')}</th><th>${t('table.value')}</th></tr></thead>
        <tbody>
          <tr><td>${t('table.created')}</td><td>${sum.Created}</td></tr>
          <tr><td>${t('table.sentRequests')}</td><td>${sum.SentRequests}</td></tr>
          <tr><td>${t('table.connected')}</td><td>${sum.Connected}</td></tr>
          <tr><td>${t('table.replies')}</td><td>${sum.Replies}</td></tr>
          <tr><td>${t('table.positiveReplies')}</td><td>${sum.PositiveReplies}</td></tr>
          <tr><td>${t('table.events')}</td><td>${sum.Events}</td></tr>
          <tr><td>${t('table.crEvents')}</td><td>${cr.toFixed(2)}%</td></tr>
          <tr><td>${t('table.csRate')}</td><td>${sentToConn.toFixed(2)}%</td></tr>
          <tr><td>${t('table.prRate')}</td><td>${posToRep.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    </div>`;
  document.getElementById('countrySummary').innerHTML = summaryHtml;
  document.getElementById('countryModalTitle').textContent = `${t('modals.countryInsight')} — ${countryName}`;

  const monthly = aggregateCountryMonthly(countryName, rows, from, to);
  if (chartRefs.countryMonthlyPaired) chartRefs.countryMonthlyPaired.destroy();
  chartRefs.countryMonthlyPaired = renderPairedBarChart(
    document.getElementById('countryMonthlyPaired'),
    monthly.months,
    getMetricLabel('Created'),
    monthly.created,
    getMetricLabel('Events'),
    monthly.events
  );

  const top = aggregateCountryTopGenerators(countryName, rows, from, to, 5);
  let topHtml = `<div class="section-break"><div class="label">${t('modals.topGenerators')}</div></div>`;
  topHtml += '<table class="summary-table">';
  topHtml += `<thead><tr><th>${t('table.name')}</th><th>${t('table.created')}</th><th>${t('table.events')}</th><th>${t('table.crShort')}%</th></tr></thead><tbody>`;
  for (const tEntry of top) {
    topHtml += `<tr><td>${tEntry.name}</td><td>${tEntry.Created}</td><td>${tEntry.Events}</td><td>${tEntry.cr.toFixed(2)}%</td></tr>`;
  }
  topHtml += '</tbody></table>';
  document.getElementById('countryTopGenerators').innerHTML = topHtml;

  const countryOverlay = document.getElementById('countryModalOverlay');
  countryOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function aggregateLeadSummary(leadName, rows, fromDate, toDate) {
  const acc = { Created: 0, SentRequests: 0, Connected: 0, Replies: 0, PositiveReplies: 0, Events: 0 };
  for (const r of rows) {
    const name = r.Name || 'Unknown';
    if (name !== leadName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    acc.Created += Number(r['Created'] || 0);
    acc.SentRequests += Number(r['Sent Requests'] || 0);
    acc.Connected += Number(r['Connected'] || 0);
    acc.Replies += Number(r['Total replies'] || 0);
    acc.PositiveReplies += Number(r['Positive Replies'] || 0);
    acc.Events += Number(r['Events Created'] || 0);
  }
  return acc;
}

function aggregateLeadMonthly(leadName, rows, fromDate, toDate) {
  const byMonth = {};
  for (const r of rows) {
    const name = r.Name || 'Unknown';
    if (name !== leadName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { Created: 0, Events: 0 };
    byMonth[key].Created += Number(r['Created'] || 0);
    byMonth[key].Events += Number(r['Events Created'] || 0);
  }
  const months = Object.keys(byMonth).sort();
  return { months, created: months.map(m => byMonth[m].Created), events: months.map(m => byMonth[m].Events) };
}

function aggregateLeadTopCountries(leadName, rows, fromDate, toDate, limit = 5) {
  const byCountry = {};
  for (const r of rows) {
    const name = r.Name || 'Unknown';
    if (name !== leadName) continue;
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    const country = r.Country || 'Unknown';
    if (!byCountry[country]) byCountry[country] = { Created: 0, Events: 0 };
    byCountry[country].Created += Number(r['Created'] || 0);
    byCountry[country].Events += Number(r['Events Created'] || 0);
  }
  const entries = Object.entries(byCountry).map(([country, v]) => ({ country, ...v, cr: v.Created > 0 ? (v.Events / v.Created) * 100 : 0 }));
  entries.sort((a,b) => b.cr - a.cr || b.Events - a.Events);
  return entries.slice(0, limit);
}

function openLeadInsight(leadName, rows) {
  const from = new Date(document.getElementById('fromDate').value);
  const to = new Date(document.getElementById('toDate').value);
  from.setHours(0,0,0,0);
  to.setHours(23,59,59,999);

  const sum = aggregateLeadSummary(leadName, rows, from, to);
  const cr = sum.Created > 0 ? (sum.Events / sum.Created) * 100 : 0;
  const sentToConn = sum.SentRequests > 0 ? (sum.Connected / sum.SentRequests) * 100 : 0;
  const posToRep = sum.Replies > 0 ? (sum.PositiveReplies / sum.Replies) * 100 : 0;
  const summaryHtml = `
    <div class="summary-table-wrapper">
      <table class="summary-table">
        <thead><tr><th>${t('table.metric')}</th><th>${t('table.value')}</th></tr></thead>
        <tbody>
          <tr><td>${t('table.created')}</td><td>${sum.Created}</td></tr>
          <tr><td>${t('table.sentRequests')}</td><td>${sum.SentRequests}</td></tr>
          <tr><td>${t('table.connected')}</td><td>${sum.Connected}</td></tr>
          <tr><td>${t('table.replies')}</td><td>${sum.Replies}</td></tr>
          <tr><td>${t('table.positiveReplies')}</td><td>${sum.PositiveReplies}</td></tr>
          <tr><td>${t('table.events')}</td><td>${sum.Events}</td></tr>
          <tr><td>${t('table.crEvents')}</td><td>${cr.toFixed(2)}%</td></tr>
          <tr><td>${t('table.csRate')}</td><td>${sentToConn.toFixed(2)}%</td></tr>
          <tr><td>${t('table.prRate')}</td><td>${posToRep.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    </div>`;
  document.getElementById('leadSummary').innerHTML = summaryHtml;
  document.getElementById('leadModalTitle').textContent = `${t('modals.leadInsight')} — ${leadName}`;

  const monthly = aggregateLeadMonthly(leadName, rows, from, to);
  if (chartRefs.leadMonthlyPaired) chartRefs.leadMonthlyPaired.destroy();
  chartRefs.leadMonthlyPaired = renderPairedBarChart(
    document.getElementById('leadMonthlyPaired'),
    monthly.months,
    getMetricLabel('Created'),
    monthly.created,
    getMetricLabel('Events'),
    monthly.events
  );

  const top = aggregateLeadTopCountries(leadName, rows, from, to, 5);
  let topHtml = `<div class="section-break"><div class="label">${t('modals.topCountries')}</div></div>`;
  topHtml += '<table class="summary-table">';
  topHtml += `<thead><tr><th>${t('table.country')}</th><th>${t('table.created')}</th><th>${t('table.events')}</th><th>${t('table.crShort')}%</th></tr></thead><tbody>`;
  for (const tEntry of top) {
    topHtml += `<tr><td>${tEntry.country}</td><td>${tEntry.Created}</td><td>${tEntry.Events}</td><td>${tEntry.cr.toFixed(2)}%</td></tr>`;
  }
  topHtml += '</tbody></table>';
  document.getElementById('leadTopCountries').innerHTML = topHtml;

  const leadOverlay = document.getElementById('leadModalOverlay');
  leadOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
