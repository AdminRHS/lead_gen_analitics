import { initializeLanguage } from './i18nSupport.js';
import { initializeTheme, initThemeToggle } from './theme.js';
import { initTabs } from './tabs.js';
import { initDashboard, applyCurrentFilter } from './dashboard.js';
import { initControlsParallax } from './uiEffects.js';

function attachFilterHandler() {
  const applyFilterBtn = document.getElementById('applyFilter');
  if (applyFilterBtn && !applyFilterBtn.dataset.bound) {
    applyFilterBtn.addEventListener('click', applyCurrentFilter);
    applyFilterBtn.dataset.bound = 'true';
  }
}

function bootstrap() {
  initializeLanguage();
  initializeTheme();
  initTabs();
  initDashboard();
  initThemeToggle();
  initControlsParallax();
  attachFilterHandler();
}

bootstrap();
