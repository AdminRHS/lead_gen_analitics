import { translations, localeMap } from '../i18n/index.js';
import { isLocalStorageAvailable } from '../cache.js';
import { state } from './state.js';
import {
  LANGUAGE_STORAGE_KEY,
  supportedLanguages,
  languageDisplayNames,
  DAY_SUMMARY_METRICS,
  metricTranslationMap
} from './config.js';

let statusUIUpdater = null;
let themeToggleUpdater = null;

export function registerStatusUIUpdater(handler) {
  statusUIUpdater = handler;
}

export function registerThemeToggleUpdater(handler) {
  themeToggleUpdater = handler;
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

export function t(keyPath) {
  const localeValue = getTranslationValue(translations[state.currentLanguage], keyPath);
  if (localeValue !== null && localeValue !== undefined) return localeValue;
  const fallbackValue = getTranslationValue(translations.en, keyPath);
  return fallbackValue !== null && fallbackValue !== undefined ? fallbackValue : keyPath;
}

export function formatLocaleDateTime(date) {
  return date.toLocaleString(localeMap[state.currentLanguage] || 'en-US');
}

function updateLoadingText() {
  if (state.lastStatusPayload) return;
  const updateEl = document.getElementById('update');
  if (updateEl) {
    updateEl.textContent = t('common.loading');
  }
}

function updateLanguageSelector() {
  const select = document.getElementById('languageSelect');
  if (select) {
    select.value = state.currentLanguage;
  }
}

function initLanguageSelector() {
  const select = document.getElementById('languageSelect');
  if (!select) return;
  if (!select.dataset.bound) {
    select.addEventListener('change', (event) => {
      setLanguage(event.target.value);
    });
    select.dataset.bound = 'true';
  }
  select.innerHTML = '';
  supportedLanguages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = languageDisplayNames[lang] || lang.toUpperCase();
    select.appendChild(option);
  });
  select.value = state.currentLanguage;
}

export function initializeLanguage() {
  const stored = getStoredLanguagePreference();
  if (stored) {
    state.currentLanguage = stored;
  }
  initLanguageSelector();
  applyTranslations();
}

export function setLanguage(lang) {
  const normalized = supportedLanguages.includes(lang) ? lang : 'en';
  state.currentLanguage = normalized;
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('Unable to store language preference:', error);
    }
  }
  applyTranslations();
}

export function getMetricLabel(metric) {
  const translationKey = metricTranslationMap[metric];
  return translationKey ? t(translationKey) : metric;
}

export function getActiveTabLabel(activeTabId) {
  if (!activeTabId) return t('common.title');
  const tabKey = activeTabId.replace('tab-', '');
  const translationMap = {
    funnel: 'tabs.funnel',
    country: 'tabs.countries',
    weekly: 'tabs.weekly',
    monthly: 'tabs.monthly',
    leaderboard: 'tabs.leaderboard',
    source: 'tabs.source',
    operations: 'tabs.operations'
  };
  const key = translationMap[tabKey];
  return key ? t(key) : t('common.title');
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
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

  themeToggleUpdater?.();
  updateLanguageSelector();
  updateLoadingText();

  if (statusUIUpdater && state.lastStatusPayload) {
    const updateEl = document.getElementById('update');
    if (updateEl) {
      statusUIUpdater(updateEl, state.lastStatusPayload.json, state.lastStatusPayload.fromCache);
    }
  }

  if (typeof state.rerenderAll === 'function' && state.rows && state.rows.length > 0) {
    const sourceRows = state.lastFilteredRows.length > 0 ? state.lastFilteredRows : state.rows;
    state.rerenderAll(sourceRows);
  }
}

export { DAY_SUMMARY_METRICS };
