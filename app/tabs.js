import { debounce } from '../chartOptimizer.js';
import { state } from './state.js';
import {
  renderFunnelCharts,
  renderCountryCharts,
  renderWeeklyCharts,
  renderMonthlyCharts,
  renderLeaderboardCharts,
  renderSourceCharts,
  renderOperationsTables,
  renderTimingTables
} from './renderers.js';

export function initTabs() {
  const tabs = [
    { btn: document.getElementById('tab-funnel-btn'), panel: document.getElementById('tab-funnel') },
    { btn: document.getElementById('tab-country-btn'), panel: document.getElementById('tab-country') },
    { btn: document.getElementById('tab-weekly-btn'), panel: document.getElementById('tab-weekly') },
    { btn: document.getElementById('tab-monthly-btn'), panel: document.getElementById('tab-monthly') },
    { btn: document.getElementById('tab-leaderboard-btn'), panel: document.getElementById('tab-leaderboard') },
    { btn: document.getElementById('tab-operations-btn'), panel: document.getElementById('tab-operations') },
    { btn: document.getElementById('tab-source-btn'), panel: document.getElementById('tab-source') },
    { btn: document.getElementById('tab-timing-btn'), panel: document.getElementById('tab-timing') }
  ];

  const resizeCharts = (charts = []) => {
    charts.forEach((chart) => {
      if (chart && typeof chart.resize === 'function') {
        chart.resize();
      }
    });
  };

  const debouncedResizeCharts = debounce((panelId) => {
    if (panelId === 'tab-funnel') {
      resizeCharts([
        state.chartRefs.createdFound,
        state.chartRefs.sentConnected,
        state.chartRefs.connectedReplies,
        state.chartRefs.repliesPositive,
        state.chartRefs.positiveEvents
      ]);
    } else if (panelId === 'tab-country') {
      resizeCharts([
        state.chartRefs.countryConversionRate,
        state.chartRefs.countryCreatedFound,
        state.chartRefs.countrySentConnected,
        state.chartRefs.countryConnectedReplies,
        state.chartRefs.countryRepliesPositive,
        state.chartRefs.countryPositiveEvents
      ]);
    } else if (panelId === 'tab-weekly') {
      resizeCharts([
        state.chartRefs.weekCreatedFound,
        state.chartRefs.weekSentConnected,
        state.chartRefs.weekConnectedReplies,
        state.chartRefs.weekRepliesPositive,
        state.chartRefs.weekPositiveEvents
      ]);
    } else if (panelId === 'tab-monthly') {
      resizeCharts([
        state.chartRefs.monthConversionRate,
        state.chartRefs.monthCreatedFound,
        state.chartRefs.monthSentConnected,
        state.chartRefs.monthConnectedReplies,
        state.chartRefs.monthRepliesPositive,
        state.chartRefs.monthPositiveEvents
      ]);
    } else if (panelId === 'tab-leaderboard') {
      resizeCharts([
        state.chartRefs.lbConversionRate,
        state.chartRefs.lbCreated,
        state.chartRefs.lbSent,
        state.chartRefs.lbPositive,
        state.chartRefs.lbEvents
      ]);
    } else if (panelId === 'tab-source') {
      resizeCharts([
        state.chartRefs.sourceConversionRate,
        state.chartRefs.sourceCreatedToSent,
        state.chartRefs.sourceSentToConnected,
        state.chartRefs.sourceConnectedToReplies,
        state.chartRefs.sourceRepliesToPositive,
        state.chartRefs.sourcePositiveToEvents
      ]);
    } else if (panelId === 'tab-operations') {
      // Tables only, nothing to resize
    } else if (panelId === 'tab-timing') {
      // Tables only, nothing to resize
    }
  }, 200);

  const activate = (targetBtn) => {
    const currentActivePanel = tabs.find(({ panel }) => panel.classList.contains('active'))?.panel;
    const newPanel = tabs.find(({ btn }) => btn === targetBtn)?.panel;
    const panelId = targetBtn.getAttribute('aria-controls');

    if (currentActivePanel === newPanel) return;

    tabs.forEach(({ btn }) => {
      const isActive = btn === targetBtn;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (newPanel && state.lastFilteredRows.length > 0) {
      const tabKey = panelId.replace('tab-', '');
      if (!state.renderedTabs[tabKey]) {
        if (panelId === 'tab-funnel') {
          renderFunnelCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-country') {
          renderCountryCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-weekly') {
          renderWeeklyCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-monthly') {
          renderMonthlyCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-leaderboard') {
          renderLeaderboardCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-source') {
          renderSourceCharts(state.lastFilteredRows);
        } else if (panelId === 'tab-operations') {
          renderOperationsTables(state.lastFilteredRows);
        } else if (panelId === 'tab-timing') {
          renderTimingTables(state.lastFilteredRows);
        }
        state.renderedTabs[tabKey] = true;
      }
    }

    const finalizePanelTransition = () => {
      if (newPanel) {
        newPanel.style.opacity = '';
        newPanel.style.transform = '';
        newPanel.style.display = '';
        debouncedResizeCharts(panelId);
      }
    };

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
              setTimeout(finalizePanelTransition, 300);
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
          setTimeout(finalizePanelTransition, 300);
        });
      });
    }

    tabs.forEach(({ panel }) => {
      if (panel !== currentActivePanel && panel !== newPanel) {
        panel.classList.remove('active');
      }
    });
  };

  tabs.forEach(({ btn }) => {
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => activate(btn));
      btn.dataset.bound = 'true';
    }
  });
}
