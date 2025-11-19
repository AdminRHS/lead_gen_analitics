import { state } from './state.js';
import { localeMap } from '../i18n/index.js';
import { t } from './i18nSupport.js';

const numberFormattersCache = new Map();

export function getCurrentLocale() {
  return localeMap[state.currentLanguage] || undefined;
}

function getNumberFormatter(maxFractionDigits = 0) {
  const locale = getCurrentLocale() || 'en-US';
  const cacheKey = `${locale}-${maxFractionDigits}`;
  if (!numberFormattersCache.has(cacheKey)) {
    numberFormattersCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits
      })
    );
  }
  return numberFormattersCache.get(cacheKey);
}

export function formatNumber(value, maximumFractionDigits = 0) {
  const formatter = getNumberFormatter(maximumFractionDigits);
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return formatter.format(safeValue);
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${formatNumber(value, digits)}%`;
}

export function formatDays(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${formatNumber(value, 1)} ${t('table.days')}`;
}

export function formatDateShort(date) {
  if (!(date instanceof Date) || isNaN(date.valueOf())) return '';
  const locale = getCurrentLocale();
  return date.toLocaleDateString(locale || undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function normalizeDimensionValue(value, fallback = 'Unknown') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
  }
  return value;
}

