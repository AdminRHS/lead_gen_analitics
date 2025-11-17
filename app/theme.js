import { state } from './state.js';
import { THEME_STORAGE_KEY } from './config.js';
import { isLocalStorageAvailable } from '../cache.js';
import { t, registerThemeToggleUpdater } from './i18nSupport.js';

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

export function updateThemeToggleButton(theme = state.currentTheme) {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;
  const isDark = theme === 'dark';
  const label = isDark ? t('common.themeLight') : t('common.themeDark');
  toggleBtn.textContent = `${isDark ? 'â˜€ï¸ ' : 'í¼™ '}${label}`;
  toggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
}

registerThemeToggleUpdater(() => updateThemeToggleButton());

function destroyAllCharts() {
  Object.keys(state.chartRefs).forEach((key) => {
    const chart = state.chartRefs[key];
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    state.chartRefs[key] = null;
  });
}

function resetRenderedTabs() {
  Object.keys(state.renderedTabs).forEach((key) => {
    state.renderedTabs[key] = false;
  });
}

function refreshChartsForTheme() {
  if (!state.rows || state.rows.length === 0 || typeof state.rerenderAll !== 'function') return;
  destroyAllCharts();
  resetRenderedTabs();
  const sourceRows = state.lastFilteredRows.length > 0 ? state.lastFilteredRows : state.rows;
  state.rerenderAll(sourceRows);
}

export function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  state.currentTheme = normalized;
  document.body.classList.toggle('dark-theme', normalized === 'dark');
  document.documentElement.style.setProperty('color-scheme', normalized === 'dark' ? 'dark' : 'light');
  updateThemeToggleButton(normalized);
  updateChartTheme(normalized === 'dark');
  refreshChartsForTheme();

  if (persist && isLocalStorageAvailable()) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
      state.userHasExplicitTheme = true;
    } catch (error) {
      console.warn('Unable to persist theme preference:', error);
    }
  }
}

function getStoredThemePreference() {
  if (!isLocalStorageAvailable()) return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      state.userHasExplicitTheme = true;
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read stored theme preference:', error);
  }
  return null;
}

function getInitialThemePreference() {
  const stored = getStoredThemePreference();
  if (stored) return stored;
  return state.prefersDarkSchemeQuery && state.prefersDarkSchemeQuery.matches ? 'dark' : 'light';
}

function setupSystemThemeListener() {
  if (!state.prefersDarkSchemeQuery) return;
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
    if (state.userHasExplicitTheme) return;
    applyTheme(event.matches ? 'dark' : 'light', { persist: false });
  };

  if (typeof state.prefersDarkSchemeQuery.addEventListener === 'function') {
    state.prefersDarkSchemeQuery.addEventListener('change', handleChange);
  } else if (typeof state.prefersDarkSchemeQuery.addListener === 'function') {
    state.prefersDarkSchemeQuery.addListener(handleChange);
  }
}

export function initializeTheme() {
  const initialTheme = getInitialThemePreference();
  applyTheme(initialTheme, { persist: false });
  updateThemeToggleButton(initialTheme);
  setupSystemThemeListener();
}

export function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn || toggleBtn.dataset.bound) return;
  toggleBtn.addEventListener('click', () => {
    const nextTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
  toggleBtn.dataset.bound = 'true';
  updateThemeToggleButton();
}
