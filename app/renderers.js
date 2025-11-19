import { renderPairedBarChart, renderSingleBarChart, renderConversionRateChart } from '../charts.js';
import {
  buildAggregates,
  buildCountryAggregates,
  buildWeeklyAggregates,
  buildMonthlyAggregates,
  buildLeaderboardAggregates,
  buildSourceAggregates,
  buildFunnelSummary,
  buildLeadGeneratorQuality,
  buildDailySnapshots,
  buildLeadAgingBuckets,
  buildTimingStats,
  buildTeamLoadCapacity,
  buildCountrySegmentation
} from '../aggregates.js';
import {
  shouldRecalculateAggregations,
  updateAggregationCache,
  updatePairedBarChart,
  updateSingleBarChart,
  scheduleChartUpdate
} from '../chartOptimizer.js';
import { state } from './state.js';
import { t, getMetricLabel } from './i18nSupport.js';
import { openCountryInsight, openLeadInsight } from './modals.js';
import { localeMap } from '../i18n/index.js';

const numberFormattersCache = new Map();
const MAX_STEP_COLUMNS = 5;

function getLocale() {
  return localeMap[state.currentLanguage] || undefined;
}

function formatNumber(value, maximumFractionDigits = 0) {
  const locale = getLocale();
  const cacheKey = `${locale || 'default'}-${maximumFractionDigits}`;
  if (!numberFormattersCache.has(cacheKey)) {
    numberFormattersCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits
      })
    );
  }
  const formatter = numberFormattersCache.get(cacheKey);
  const safeValue = Number.isFinite(value) ? value : 0;
  return formatter.format(safeValue);
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function formatDays(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${formatNumber(value, 1)} ${t('table.days')}`;
}

function formatDateShort(date) {
  if (!(date instanceof Date) || isNaN(date.valueOf())) return '';
  const locale = getLocale();
  return date.toLocaleDateString(locale || undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function isFullDataScope(filteredRows) {
  return filteredRows === state.rows;
}

function sortWeekKeys(keys = []) {
  return [...keys].sort((a, b) => {
    const [ay, aw] = a.split('-W').map(Number);
    const [by, bw] = b.split('-W').map(Number);
    if (ay !== by) return ay - by;
    return (aw || 0) - (bw || 0);
  });
}

function buildWeeklyAggregatesFromSummary() {
  const weekly = state.serverSummary?.weekly;
  if (!weekly) return null;
  const keys = sortWeekKeys(Object.keys(weekly));
  return {
    weeks: keys,
    created: keys.map((key) => weekly[key]?.Created || 0),
    sent: keys.map((key) => weekly[key]?.SentRequests || 0),
    connected: keys.map((key) => weekly[key]?.Connected || 0),
    replies: keys.map((key) => weekly[key]?.Replies || 0),
    positive: keys.map((key) => weekly[key]?.PositiveReplies || 0),
    events: keys.map((key) => weekly[key]?.Events || 0)
  };
}

function buildMonthlyAggregatesFromSummary() {
  const monthly = state.serverSummary?.monthly;
  if (!monthly) return null;
  const keys = Object.keys(monthly).sort();
  return {
    months: keys,
    created: keys.map((key) => monthly[key]?.Created || 0),
    sent: keys.map((key) => monthly[key]?.SentRequests || 0),
    connected: keys.map((key) => monthly[key]?.Connected || 0),
    replies: keys.map((key) => monthly[key]?.Replies || 0),
    positive: keys.map((key) => monthly[key]?.PositiveReplies || 0),
    events: keys.map((key) => monthly[key]?.Events || 0),
    conversionRates: keys.map((key) => {
      const data = monthly[key] || {};
      return data.Created > 0 ? (data.Events / data.Created) * 100 : 0;
    })
  };
}

function buildCountryAggregatesFromSummary() {
  const countriesSummary = state.serverSummary?.countries;
  if (!countriesSummary) return null;
  const countries = Object.keys(countriesSummary).sort(
    (a, b) => (countriesSummary[b]?.Created || 0) - (countriesSummary[a]?.Created || 0)
  );
  return {
    countries,
    created: countries.map((country) => countriesSummary[country]?.Created || 0),
    sent: countries.map((country) => countriesSummary[country]?.SentRequests || 0),
    connected: countries.map((country) => countriesSummary[country]?.Connected || 0),
    replies: countries.map((country) => countriesSummary[country]?.Replies || 0),
    positive: countries.map((country) => countriesSummary[country]?.PositiveReplies || 0),
    events: countries.map((country) => countriesSummary[country]?.Events || 0),
    conversionRates: countries.map((country) => {
      const data = countriesSummary[country] || {};
      return data.Created > 0 ? (data.Events / data.Created) * 100 : 0;
    })
  };
}

function renderFunnelDropoffMatrix(summary) {
  const container = document.getElementById('funnelDropoffContainer');
  if (!container) return;

  const hasData = summary && Object.values(summary).some((val) => Number(val) > 0);
  if (!hasData) {
    container.innerHTML = `<div class="empty-state">${t('table.noData')}</div>`;
    return;
  }

  const stageOrder = [
    { key: 'Created', labelKey: 'Created' },
    { key: 'SentRequests', labelKey: 'Sent Requests' },
    { key: 'Connected', labelKey: 'Connected' },
    { key: 'Replies', labelKey: 'Replies' },
    { key: 'PositiveReplies', labelKey: 'Positive Replies' },
    { key: 'Events', labelKey: 'Events' }
  ];

  const createdCount = summary.Created || 0;
  const rowsHtml = stageOrder
    .map((stage, idx) => {
      const current = summary[stage.key] || 0;
      const prev = idx === 0 ? null : summary[stageOrder[idx - 1].key] || 0;
      const dropoffCount = prev !== null ? Math.max(0, prev - current) : 0;
      const dropoffPercent = prev && prev > 0 ? (dropoffCount / prev) * 100 : 0;
      const cumulative = createdCount > 0 ? (current / createdCount) * 100 : 0;
      const dropoffDisplay =
        prev === null
          ? '—'
          : `${dropoffCount > 0 ? `-${formatNumber(dropoffCount)}` : formatNumber(0)} (${formatPercent(dropoffPercent)})`;

      return `
        <tr>
          <td>${getMetricLabel(stage.labelKey)}</td>
          <td>${formatNumber(current)}</td>
          <td>${dropoffDisplay}</td>
          <td>${formatPercent(cumulative)}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="summary-table">
      <thead>
        <tr>
          <th>${t('table.stage')}</th>
          <th>${t('table.value')}</th>
          <th>${t('table.dropoff')}</th>
          <th>${t('table.cumulative')}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function bindLeadQualitySortControl() {
  const select = document.getElementById('leadQualitySort');
  if (select && !select.dataset.bound) {
    select.addEventListener('change', updateLeadQualityTableRows);
    select.dataset.bound = 'true';
  }
}

function getLeadQualitySortKey() {
  const select = document.getElementById('leadQualitySort');
  return select?.value || 'positiveRate';
}

function updateLeadQualityTableRows() {
  const tbody = document.getElementById('leadQualityTableBody');
  if (!tbody) return;

  const rows = state.tableData.leadQuality || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">${t('table.noData')}</td></tr>`;
    return;
  }
  const sortKey = getLeadQualitySortKey();
  const sorted = [...rows].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    if (sortKey === 'avgResponseTimeDays') {
      if (aValue === null && bValue === null) return a.name.localeCompare(b.name);
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return aValue - bValue;
    }
    return (bValue ?? 0) - (aValue ?? 0);
  });

  tbody.innerHTML = sorted
    .map((row) => {
      const avgResponse = row.avgResponseTimeDays !== null ? formatNumber(row.avgResponseTimeDays, 1) : '—';
      return `
        <tr>
          <td>${row.name}</td>
          <td>${formatNumber(row.sent)}</td>
          <td>${formatNumber(row.connected)}</td>
          <td>${formatNumber(row.positive)}</td>
          <td>${formatPercent(row.positiveRate * 100)}</td>
          <td>${formatPercent(row.createdToPositive * 100)}</td>
          <td>${formatPercent(row.positiveToEvents * 100)}</td>
          <td>${formatNumber(row.eventsPerWeek, 1)}</td>
          <td>${avgResponse}</td>
        </tr>
      `;
    })
    .join('');
}

function renderLeadGeneratorQualityTable() {
  bindLeadQualitySortControl();
  updateLeadQualityTableRows();
}

function renderLeadAgingTable() {
  const tbody = document.getElementById('leadAgingTableBody');
  if (!tbody) return;
  const dataset = state.tableData.aging;

  if (!dataset || !dataset.rows || !dataset.rows.length) {
    tbody.innerHTML = `<tr><td colspan="5">${t('table.noData')}</td></tr>`;
    return;
  }

  const bucketKeys = dataset.buckets.map((bucket) => bucket.key);
  const rowsHtml = dataset.rows
    .map((row) => {
      const stageLabel = getMetricLabel(row.stageKey);
      const bucketCells = bucketKeys
        .map((bucketKey) => `<td>${formatNumber(row.counts[bucketKey] || 0)}</td>`)
        .join('');
      return `
        <tr>
          <td>${stageLabel}</td>
          ${bucketCells}
          <td>${formatNumber(row.total || 0)}</td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rowsHtml;
}

function renderDailySnapshotTable() {
  const tbody = document.getElementById('dailySnapshotTableBody');
  if (!tbody) return;
  const dataset = state.tableData.dailySnapshot?.rows || [];

  if (!dataset.length) {
    tbody.innerHTML = `<tr><td colspan="9">${t('table.noData')}</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map((row) => {
      const conversion = formatPercent(row.conversionRate, 1);
      let deltaPill = `<span class="delta-pill neutral">—</span>`;
      if (row.deltaFromPrev !== null && row.deltaFromPrev !== undefined) {
        const direction = row.deltaFromPrev > 0 ? 'up' : row.deltaFromPrev < 0 ? 'down' : 'neutral';
        const arrow = row.deltaFromPrev > 0 ? '▲' : row.deltaFromPrev < 0 ? '▼' : '→';
        const deltaValue = Math.abs(row.deltaFromPrev);
        const label = `${formatNumber(deltaValue, 1)}pp`;
        deltaPill = `<span class="delta-pill ${direction}">${arrow} ${label}</span>`;
      }
      return `
        <tr>
          <td>${formatDateShort(row.date)}</td>
          <td>${formatNumber(row.created)}</td>
          <td>${formatNumber(row.sent)}</td>
          <td>${formatNumber(row.connected)}</td>
          <td>${formatNumber(row.replies)}</td>
          <td>${formatNumber(row.positive)}</td>
          <td>${formatNumber(row.events)}</td>
          <td>${conversion}</td>
          <td>${deltaPill}</td>
        </tr>
      `;
    })
    .join('');
}

function computeStepPerformanceDataset(lbAgg) {
  if (!lbAgg || !lbAgg.names || lbAgg.names.length === 0) {
    return { names: [], rows: [] };
  }
  const entries = lbAgg.names.map((name, idx) => ({
    name,
    sent: lbAgg.sent[idx] || 0,
    connected: lbAgg.connected ? lbAgg.connected[idx] || 0 : 0,
    replies: lbAgg.replies ? lbAgg.replies[idx] || 0 : 0,
    positive: lbAgg.positive[idx] || 0,
    events: lbAgg.events[idx] || 0
  }));

  entries.sort((a, b) => b.events - a.events);
  const limited = entries.slice(0, Math.min(entries.length, MAX_STEP_COLUMNS));

  const stages = [
    { key: 'table.stageSentToConnected', numerator: 'connected', denominator: 'sent' },
    { key: 'table.stageConnectedToReplies', numerator: 'replies', denominator: 'connected' },
    { key: 'table.stagePositiveToEvents', numerator: 'events', denominator: 'positive' }
  ];

  const rows = stages.map((stage) => {
    const values = limited.map((entry) => {
      const numerator = entry[stage.numerator] || 0;
      const denominator = entry[stage.denominator] || 0;
      if (denominator <= 0) return 0;
      const rate = (numerator / denominator) * 100;
      return Number.isFinite(rate) ? rate : 0;
    });
    const maxValue = Math.max(...values);
    return {
      stageKey: stage.key,
      values,
      maxValue
    };
  });

  return {
    names: limited.map((entry) => entry.name),
    rows
  };
}

function renderStepPerformanceTable() {
  const container = document.getElementById('stepPerformanceContainer');
  if (!container) return;
  const dataset = state.tableData.stepPerformance;
  if (!dataset || !dataset.names || dataset.names.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('table.noData')}</div>`;
    return;
  }

  const headerCells = dataset.names.map((name) => `<th>${name}</th>`).join('');
  const rowsHtml = dataset.rows
    .map((row) => {
      const cells = row.values
        .map((value) => {
          const isBest = value === row.maxValue && value > 0;
          const className = isBest ? 'rate-chip best' : 'rate-chip';
          return `<td><span class="${className}">${formatPercent(value, 1)}</span></td>`;
        })
        .join('');
      return `
        <tr>
          <td>${t(row.stageKey)}</td>
          ${cells}
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="summary-table matrix-table">
      <thead>
        <tr>
          <th>${t('table.stage')}</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function buildSourceQualityDataset(sourceAgg) {
  if (!sourceAgg || !sourceAgg.sources || sourceAgg.sources.length === 0) {
    return { sources: [], rows: [] };
  }

  const metricDefs = [
    {
      key: 'table.metricConnectedRate',
      type: 'percent',
      higherBetter: true,
      calc: (idx) => {
        const sent = sourceAgg.sentRequests[idx] || 0;
        const connected = sourceAgg.connected[idx] || 0;
        return sent > 0 ? (connected / sent) * 100 : null;
      }
    },
    {
      key: 'table.metricRepliesRate',
      type: 'percent',
      higherBetter: true,
      calc: (idx) => {
        const connected = sourceAgg.connected[idx] || 0;
        const replies = sourceAgg.totalReplies[idx] || 0;
        return connected > 0 ? (replies / connected) * 100 : null;
      }
    },
    {
      key: 'table.metricPositiveRate',
      type: 'percent',
      higherBetter: true,
      calc: (idx) => {
        const replies = sourceAgg.totalReplies[idx] || 0;
        const positive = sourceAgg.positiveReplies[idx] || 0;
        return replies > 0 ? (positive / replies) * 100 : null;
      }
    },
    {
      key: 'table.metricAvgTimeToEvent',
      type: 'days',
      higherBetter: false,
      calc: (idx) => {
        return sourceAgg.avgDaysToEvent ? sourceAgg.avgDaysToEvent[idx] : null;
      }
    },
    {
      key: 'table.metricEventsPer100',
      type: 'number',
      higherBetter: true,
      calc: (idx) => {
        const created = sourceAgg.created[idx] || 0;
        const events = sourceAgg.events[idx] || 0;
        return created > 0 ? (events / created) * 100 : null;
      }
    }
  ];

  const sources = sourceAgg.sources;
  const rows = metricDefs.map((def) => {
    const values = sources.map((_, idx) => def.calc(idx));
    const validValues = values.filter((val) => val !== null && val !== undefined && Number.isFinite(val));
    const extreme =
      validValues.length === 0
        ? null
        : def.higherBetter
          ? Math.max(...validValues)
          : Math.min(...validValues);
    return {
      labelKey: def.key,
      values,
      extreme,
      type: def.type,
      higherBetter: def.higherBetter
    };
  });

  return { sources, rows };
}

function renderSourceQualityTable() {
  const container = document.getElementById('sourceQualityContainer');
  if (!container) return;
  const dataset = state.tableData.sourceQuality;
  if (!dataset || !dataset.sources || dataset.sources.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('table.noData')}</div>`;
    return;
  }

  const headerCells = dataset.sources.map((name) => `<th>${name}</th>`).join('');

  const formatValue = (value, type) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '—';
    }
    if (type === 'percent') return formatPercent(value, 1);
    if (type === 'days') return formatDays(value);
    return formatNumber(value, 1);
  };

  const rowsHtml = dataset.rows
    .map((row) => {
      const cells = row.values
        .map((value) => {
          const isBest =
            row.extreme !== null &&
            value !== null &&
            value !== undefined &&
            Number.isFinite(value) &&
            value === row.extreme;
          const className = isBest ? 'rate-chip best' : 'rate-chip';
          return `<td><span class="${className}">${formatValue(value, row.type)}</span></td>`;
        })
        .join('');
      return `
        <tr>
          <td>${t(row.labelKey)}</td>
          ${cells}
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="summary-table matrix-table">
      <thead>
        <tr>
          <th>${t('table.metric')}</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function renderOrUpdateChart(chartRef, elementId, renderFn, updateFn, ...args) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Chart element not found: ${elementId}`);
    return null;
  }

  if (chartRef && chartRef.data) {
    if (updateFn && updateFn(chartRef, ...args)) {
      return chartRef;
    }
    chartRef.destroy();
  }

  return renderFn(element, ...args);
}

function renderFunnelCharts(filteredRows) {
  if (
    shouldRecalculateAggregations(filteredRows, state.aggregationCache) ||
    !state.aggregationCache.funnel
  ) {
    const agg = buildAggregates(filteredRows);
    const funnelSummary = buildFunnelSummary(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, { funnel: agg, funnelSummary });
  }
  const agg = state.aggregationCache.funnel;
  state.tableData.funnelDropoff = state.aggregationCache.funnelSummary;
  renderFunnelDropoffMatrix(state.tableData.funnelDropoff);

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    state.chartRefs.createdFound = renderOrUpdateChart(
      state.chartRefs.createdFound,
      'chartCreatedToFound',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, createdLabel, agg.created, sentLabel, agg.sent
    );

    state.chartRefs.sentConnected = renderOrUpdateChart(
      state.chartRefs.sentConnected,
      'chartSentToConnected',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, sentLabel, agg.sent, connectedLabel, agg.connected
    );

    state.chartRefs.connectedReplies = renderOrUpdateChart(
      state.chartRefs.connectedReplies,
      'chartConnectedToReplies',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, connectedLabel, agg.connected, repliesLabel, agg.replies
    );

    state.chartRefs.repliesPositive = renderOrUpdateChart(
      state.chartRefs.repliesPositive,
      'chartRepliesToPositive',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, repliesLabel, agg.replies, positiveLabel, agg.positive
    );

    state.chartRefs.positiveEvents = renderOrUpdateChart(
      state.chartRefs.positiveEvents,
      'chartPositiveToEvents',
      renderPairedBarChart,
      updatePairedBarChart,
      agg.dates, positiveLabel, agg.positive, eventsLabel, agg.events
    );
  });
}

function renderCountrySegmentationTable() {
  const container = document.getElementById('countrySegmentationContainer');
  if (!container) return;
  const dataset = state.tableData.countrySegmentation;

  if (!dataset || !dataset.crossTab || !dataset.countries || !dataset.segments) {
    container.innerHTML = `<div class="table-responsive"><table class="summary-table"><tbody><tr><td colspan="4">${t('table.noData')}</td></tr></tbody></table></div>`;
    return;
  }

  const { crossTab, countries, segments } = dataset;
  const metrics = ['created', 'positive', 'events'];
  const metricLabels = {
    created: getMetricLabel('Created'),
    positive: getMetricLabel('Positive Replies'),
    events: getMetricLabel('Events Created')
  };

  const segmentLabels = {
    'Small Biz': t('table.smallBiz'),
    'Medium': t('table.medium'),
    'Enterprise': t('table.enterprise')
  };

  let html = '<div class="table-responsive"><table class="summary-table segmentation-table"><thead><tr><th data-i18n="table.country" class="country-col">Country</th>';

  segments.forEach((seg, segIndex) => {
    const isLast = segIndex === segments.length - 1;
    html += `<th colspan="3" class="${isLast ? '' : 'segment-border'}">${segmentLabels[seg] || seg}</th>`;
  });
  html += '</tr><tr><th class="country-col"></th>';

  segments.forEach((seg, segIndex) => {
    const isLast = segIndex === segments.length - 1;
    metrics.forEach((metric, metricIndex) => {
      const isLastMetric = metricIndex === metrics.length - 1;
      const borderClass = (!isLast && isLastMetric) ? 'segment-border' : '';
      html += `<th class="${borderClass}">${metricLabels[metric]}</th>`;
    });
  });
  html += '</tr></thead><tbody>';

  countries.forEach((country) => {
    html += `<tr><td class="country-col"><strong>${country}</strong></td>`;
    segments.forEach((seg, segIndex) => {
      const isLast = segIndex === segments.length - 1;
      const data = crossTab[seg][country] || { created: 0, positive: 0, events: 0 };
      metrics.forEach((metric, metricIndex) => {
        const isLastMetric = metricIndex === metrics.length - 1;
        const borderClass = (!isLast && isLastMetric) ? 'segment-border' : '';
        html += `<td class="${borderClass}">${formatNumber(data[metric])}</td>`;
      });
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderCountryCharts(filteredRows) {
  const canUseSummary = isFullDataScope(filteredRows) && state.serverSummary?.countries;
  if (canUseSummary) {
    const countryAgg = buildCountryAggregatesFromSummary();
    if (countryAgg) {
      const countrySegmentation = buildCountrySegmentation(filteredRows);
      updateAggregationCache(state.aggregationCache, filteredRows, {
        country: countryAgg,
        countrySegmentation
      });
    }
  }
  if (!state.aggregationCache.country || shouldRecalculateAggregations(filteredRows, state.aggregationCache)) {
    const countryAgg = buildCountryAggregates(filteredRows);
    const countrySegmentation = buildCountrySegmentation(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, {
      country: countryAgg,
      countrySegmentation
    });
  }
  const countryAgg = state.aggregationCache.country;
  state.tableData.countrySegmentation = state.aggregationCache.countrySegmentation;
  renderCountrySegmentationTable();

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');

    state.chartRefs.countryConversionRate = renderOrUpdateChart(
      state.chartRefs.countryConversionRate,
      'chartCountryConversionRate',
      (el, labels, label, data, color) => {
        const chart = renderConversionRateChart(el, labels, label, data, color);
        if (chart) {
          chart.options.onClick = (evt) => {
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

    const attachCountryClick = (chart, labels) => {
      if (chart) {
        chart.options.onClick = (evt) => {
          const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
          if (points && points.length) {
            const idx = points[0].index;
            const country = labels[idx];
            openCountryInsight(country, filteredRows);
          }
        };
      }
      return chart;
    };

    state.chartRefs.countryCreatedFound = renderOrUpdateChart(
      state.chartRefs.countryCreatedFound,
      'chartCountryCreatedToFound',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => attachCountryClick(
        renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData),
        labels
      ),
      updatePairedBarChart,
      countryAgg.countries, createdLabel, countryAgg.created, sentLabel, countryAgg.sent
    );

    state.chartRefs.countrySentConnected = renderOrUpdateChart(
      state.chartRefs.countrySentConnected,
      'chartCountrySentToConnected',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => attachCountryClick(
        renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData),
        labels
      ),
      updatePairedBarChart,
      countryAgg.countries, sentLabel, countryAgg.sent, connectedLabel, countryAgg.connected
    );

    state.chartRefs.countryConnectedReplies = renderOrUpdateChart(
      state.chartRefs.countryConnectedReplies,
      'chartCountryConnectedToReplies',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => attachCountryClick(
        renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData),
        labels
      ),
      updatePairedBarChart,
      countryAgg.countries, connectedLabel, countryAgg.connected, repliesLabel, countryAgg.replies
    );

    state.chartRefs.countryRepliesPositive = renderOrUpdateChart(
      state.chartRefs.countryRepliesPositive,
      'chartCountryRepliesToPositive',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => attachCountryClick(
        renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData),
        labels
      ),
      updatePairedBarChart,
      countryAgg.countries, repliesLabel, countryAgg.replies, positiveLabel, countryAgg.positive
    );

    state.chartRefs.countryPositiveEvents = renderOrUpdateChart(
      state.chartRefs.countryPositiveEvents,
      'chartCountryPositiveToEvents',
      (el, labels, leftLabel, leftData, rightLabel, rightData) => attachCountryClick(
        renderPairedBarChart(el, labels, leftLabel, leftData, rightLabel, rightData),
        labels
      ),
      updatePairedBarChart,
      countryAgg.countries, positiveLabel, countryAgg.positive, eventsLabel, countryAgg.events
    );
  });
}

function renderWeeklyCharts(filteredRows) {
  const canUseSummary = isFullDataScope(filteredRows) && state.serverSummary?.weekly;
  if (canUseSummary) {
    const weekAgg = buildWeeklyAggregatesFromSummary();
    if (weekAgg) {
      const dailySnapshot = buildDailySnapshots(filteredRows);
      updateAggregationCache(state.aggregationCache, filteredRows, {
        weekly: weekAgg,
        dailySnapshot
      });
    }
  }
  if (!state.aggregationCache.weekly || shouldRecalculateAggregations(filteredRows, state.aggregationCache)) {
    const weekAgg = buildWeeklyAggregates(filteredRows);
    const dailySnapshot = buildDailySnapshots(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, {
      weekly: weekAgg,
      dailySnapshot
    });
  }
  const weekAgg = state.aggregationCache.weekly;
  state.tableData.dailySnapshot = state.aggregationCache.dailySnapshot;
  renderDailySnapshotTable();

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');

    state.chartRefs.weekCreatedFound = renderOrUpdateChart(
      state.chartRefs.weekCreatedFound,
      'chartWeekCreatedToFound',
      renderPairedBarChart,
      updatePairedBarChart,
      weekAgg.weeks, createdLabel, weekAgg.created, sentLabel, weekAgg.sent
    );

    state.chartRefs.weekSentConnected = renderOrUpdateChart(
      state.chartRefs.weekSentConnected,
      'chartWeekSentToConnected',
      renderPairedBarChart,
      updatePairedBarChart,
      weekAgg.weeks, sentLabel, weekAgg.sent, connectedLabel, weekAgg.connected
    );

    state.chartRefs.weekConnectedReplies = renderOrUpdateChart(
      state.chartRefs.weekConnectedReplies,
      'chartWeekConnectedToReplies',
      renderPairedBarChart,
      updatePairedBarChart,
      weekAgg.weeks, connectedLabel, weekAgg.connected, repliesLabel, weekAgg.replies
    );

    state.chartRefs.weekRepliesPositive = renderOrUpdateChart(
      state.chartRefs.weekRepliesPositive,
      'chartWeekRepliesToPositive',
      renderPairedBarChart,
      updatePairedBarChart,
      weekAgg.weeks, repliesLabel, weekAgg.replies, positiveLabel, weekAgg.positive
    );

    state.chartRefs.weekPositiveEvents = renderOrUpdateChart(
      state.chartRefs.weekPositiveEvents,
      'chartWeekPositiveToEvents',
      renderPairedBarChart,
      updatePairedBarChart,
      weekAgg.weeks, positiveLabel, weekAgg.positive, eventsLabel, weekAgg.events
    );
  });
}

function renderMonthlyCharts(filteredRows) {
  const canUseSummary = isFullDataScope(filteredRows) && state.serverSummary?.monthly;
  if (canUseSummary) {
    const monthAgg = buildMonthlyAggregatesFromSummary();
    if (monthAgg) {
      updateAggregationCache(state.aggregationCache, filteredRows, { monthly: monthAgg });
    }
  }
  if (!state.aggregationCache.monthly || shouldRecalculateAggregations(filteredRows, state.aggregationCache)) {
    const monthAgg = buildMonthlyAggregates(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, { monthly: monthAgg });
  }
  const monthAgg = state.aggregationCache.monthly;

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');

    state.chartRefs.monthConversionRate = renderOrUpdateChart(
      state.chartRefs.monthConversionRate,
      'chartMonthConversionRate',
      renderConversionRateChart,
      null,
      monthAgg.months, conversionRateLabel, monthAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );

    state.chartRefs.monthCreatedFound = renderOrUpdateChart(
      state.chartRefs.monthCreatedFound,
      'chartMonthCreatedToFound',
      renderPairedBarChart,
      updatePairedBarChart,
      monthAgg.months, createdLabel, monthAgg.created, sentLabel, monthAgg.sent
    );

    state.chartRefs.monthSentConnected = renderOrUpdateChart(
      state.chartRefs.monthSentConnected,
      'chartMonthSentToConnected',
      renderPairedBarChart,
      updatePairedBarChart,
      monthAgg.months, sentLabel, monthAgg.sent, connectedLabel, monthAgg.connected
    );

    state.chartRefs.monthConnectedReplies = renderOrUpdateChart(
      state.chartRefs.monthConnectedReplies,
      'chartMonthConnectedToReplies',
      renderPairedBarChart,
      updatePairedBarChart,
      monthAgg.months, connectedLabel, monthAgg.connected, repliesLabel, monthAgg.replies
    );

    state.chartRefs.monthRepliesPositive = renderOrUpdateChart(
      state.chartRefs.monthRepliesPositive,
      'chartMonthRepliesToPositive',
      renderPairedBarChart,
      updatePairedBarChart,
      monthAgg.months, repliesLabel, monthAgg.replies, positiveLabel, monthAgg.positive
    );

    state.chartRefs.monthPositiveEvents = renderOrUpdateChart(
      state.chartRefs.monthPositiveEvents,
      'chartMonthPositiveToEvents',
      renderPairedBarChart,
      updatePairedBarChart,
      monthAgg.months, positiveLabel, monthAgg.positive, eventsLabel, monthAgg.events
    );
  });
}

function renderTeamLoadTable() {
  const tbody = document.getElementById('teamLoadTableBody');
  if (!tbody) return;
  const dataset = state.tableData.teamLoad?.rows || [];

  if (!dataset.length) {
    tbody.innerHTML = `<tr><td colspan="6">${t('table.noData')}</td></tr>`;
    return;
  }

  const rowsHtml = dataset
    .map((row) => {
      return `
        <tr>
          <td>${row.name}</td>
          <td>${formatNumber(row.activeLeadsAssigned)}</td>
          <td>${formatNumber(row.leadsInProgress)}</td>
          <td>${row.leadsOverdue > 0 ? `<span style="color: #ef4444;">${formatNumber(row.leadsOverdue)}</span>` : formatNumber(row.leadsOverdue)}</td>
          <td>${formatNumber(row.avgLeadsPerDay, 1)}</td>
          <td>${formatNumber(row.eventsThisWeek)}</td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rowsHtml;
}

function renderLeaderboardCharts(filteredRows) {
  if (
    shouldRecalculateAggregations(filteredRows, state.aggregationCache) ||
    !state.aggregationCache.leaderboard
  ) {
    const lbAgg = buildLeaderboardAggregates(filteredRows);
    const leadQuality = buildLeadGeneratorQuality(filteredRows);
    const teamLoad = buildTeamLoadCapacity(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, {
      leaderboard: lbAgg,
      leadQuality,
      teamLoad
    });
  }
  const lbAgg = state.aggregationCache.leaderboard;
  state.tableData.leadQuality = state.aggregationCache.leadQuality?.rows || [];
  state.tableData.stepPerformance = computeStepPerformanceDataset(lbAgg);
  state.tableData.teamLoad = state.aggregationCache.teamLoad;
  renderLeadGeneratorQualityTable();
  renderStepPerformanceTable();
  renderTeamLoadTable();

  scheduleChartUpdate(() => {
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events Created');
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');

    const attachLeadClick = (chart, labels) => {
      if (chart) {
        chart.options.onClick = (evt) => {
          const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
          if (points && points.length) {
            const idx = points[0].index;
            const name = labels[idx];
            openLeadInsight(name, filteredRows);
          }
        };
      }
      return chart;
    };

    state.chartRefs.lbConversionRate = renderOrUpdateChart(
      state.chartRefs.lbConversionRate,
      'chartLbConversionRate',
      (el, labels, label, data, color) => attachLeadClick(
        renderConversionRateChart(el, labels, label, data, color),
        labels
      ),
      null,
      lbAgg.names, conversionRateLabel, lbAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );

    state.chartRefs.lbCreated = renderOrUpdateChart(
      state.chartRefs.lbCreated,
      'chartLbCreated',
      (el, labels, label, data, color) => attachLeadClick(
        renderSingleBarChart(el, labels, label, data, color),
        labels
      ),
      updateSingleBarChart,
      lbAgg.names, createdLabel, lbAgg.created, 'rgba(54,162,235,0.6)'
    );

    state.chartRefs.lbSent = renderOrUpdateChart(
      state.chartRefs.lbSent,
      'chartLbSent',
      (el, labels, label, data, color) => attachLeadClick(
        renderSingleBarChart(el, labels, label, data, color),
        labels
      ),
      updateSingleBarChart,
      lbAgg.names, sentLabel, lbAgg.sent, 'rgba(153,102,255,0.6)'
    );

    state.chartRefs.lbPositive = renderOrUpdateChart(
      state.chartRefs.lbPositive,
      'chartLbPositive',
      (el, labels, label, data, color) => attachLeadClick(
        renderSingleBarChart(el, labels, label, data, color),
        labels
      ),
      updateSingleBarChart,
      lbAgg.names, positiveLabel, lbAgg.positive, 'rgba(75,192,192,0.6)'
    );

    state.chartRefs.lbEvents = renderOrUpdateChart(
      state.chartRefs.lbEvents,
      'chartLbEvents',
      (el, labels, label, data, color) => attachLeadClick(
        renderSingleBarChart(el, labels, label, data, color),
        labels
      ),
      updateSingleBarChart,
      lbAgg.names, eventsLabel, lbAgg.events, 'rgba(255,206,86,0.6)'
    );
  });
}

function renderSourceCharts(filteredRows) {
  if (shouldRecalculateAggregations(filteredRows, state.aggregationCache) || !state.aggregationCache.source) {
    const sourceAgg = buildSourceAggregates(filteredRows);
    state.aggregationCache.source = sourceAgg;
    updateAggregationCache(state.aggregationCache, filteredRows, { source: sourceAgg });
  }
  const sourceAgg = state.aggregationCache.source;
  state.tableData.sourceQuality = buildSourceQualityDataset(sourceAgg);
  renderSourceQualityTable();

  scheduleChartUpdate(() => {
    const conversionRateLabel = getMetricLabel('Conversion Rate (%)');
    const createdLabel = getMetricLabel('Created');
    const sentLabel = getMetricLabel('Sent Requests');
    const connectedLabel = getMetricLabel('Connected');
    const repliesLabel = getMetricLabel('Total replies');
    const positiveLabel = getMetricLabel('Positive Replies');
    const eventsLabel = getMetricLabel('Events');

    state.chartRefs.sourceConversionRate = renderOrUpdateChart(
      state.chartRefs.sourceConversionRate,
      'chartSourceConversionRate',
      renderConversionRateChart,
      null,
      sourceAgg.sources, conversionRateLabel, sourceAgg.conversionRates, 'rgba(75,192,192,0.6)'
    );

    state.chartRefs.sourceCreatedToSent = renderOrUpdateChart(
      state.chartRefs.sourceCreatedToSent,
      'chartSourceCreatedToSent',
      renderPairedBarChart,
      updatePairedBarChart,
      sourceAgg.sources, createdLabel, sourceAgg.created, sentLabel, sourceAgg.sentRequests
    );

    state.chartRefs.sourceSentToConnected = renderOrUpdateChart(
      state.chartRefs.sourceSentToConnected,
      'chartSourceSentToConnected',
      renderPairedBarChart,
      updatePairedBarChart,
      sourceAgg.sources, sentLabel, sourceAgg.sentRequests, connectedLabel, sourceAgg.connected
    );

    state.chartRefs.sourceConnectedToReplies = renderOrUpdateChart(
      state.chartRefs.sourceConnectedToReplies,
      'chartSourceConnectedToReplies',
      renderPairedBarChart,
      updatePairedBarChart,
      sourceAgg.sources, connectedLabel, sourceAgg.connected, repliesLabel, sourceAgg.totalReplies
    );

    state.chartRefs.sourceRepliesToPositive = renderOrUpdateChart(
      state.chartRefs.sourceRepliesToPositive,
      'chartSourceRepliesToPositive',
      renderPairedBarChart,
      updatePairedBarChart,
      sourceAgg.sources, repliesLabel, sourceAgg.totalReplies, positiveLabel, sourceAgg.positiveReplies
    );

    state.chartRefs.sourcePositiveToEvents = renderOrUpdateChart(
      state.chartRefs.sourcePositiveToEvents,
      'chartSourcePositiveToEvents',
      renderPairedBarChart,
      updatePairedBarChart,
      sourceAgg.sources, positiveLabel, sourceAgg.positiveReplies, eventsLabel, sourceAgg.events
    );
  });
}

function renderOperationsTables(filteredRows) {
  if (
    shouldRecalculateAggregations(filteredRows, state.aggregationCache) ||
    !state.aggregationCache.aging
  ) {
    const aging = buildLeadAgingBuckets(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, { aging });
  }
  state.tableData.aging = state.aggregationCache.aging;
  renderLeadAgingTable();
}

function renderTimingTable() {
  const tbody = document.getElementById('timingTableBody');
  if (!tbody) return;
  const dataset = state.tableData.timing;

  if (!dataset || !dataset.steps || !dataset.steps.length) {
    tbody.innerHTML = `<tr><td colspan="6">${t('table.noData')}</td></tr>`;
    return;
  }

  const rowsHtml = dataset.steps
    .map((step) => {
      const stepLabel = getMetricLabel(step.labelKey);
      return `
        <tr>
          <td>${stepLabel}</td>
          <td>${formatDays(step.median)}</td>
          <td>${formatDays(step.average)}</td>
          <td>${formatDays(step.fastest)}</td>
          <td>${formatDays(step.slowest)}</td>
          <td>${formatDays(step.percentile90)}</td>
        </tr>
      `;
    })
    .join('');

  tbody.innerHTML = rowsHtml;
}

function renderTimingTables(filteredRows) {
  if (
    shouldRecalculateAggregations(filteredRows, state.aggregationCache) ||
    !state.aggregationCache.timing
  ) {
    const timing = buildTimingStats(filteredRows);
    updateAggregationCache(state.aggregationCache, filteredRows, { timing });
  }
  state.tableData.timing = state.aggregationCache.timing;
  renderTimingTable();
}

export function renderAll(filteredRows) {
  state.lastFilteredRows = filteredRows;
  const activeTab = document.querySelector('.tabpanel.active')?.id;

  if (activeTab === 'tab-funnel' || !activeTab) {
    renderFunnelCharts(filteredRows);
    state.renderedTabs.funnel = true;
  }
  if (activeTab === 'tab-country') {
    renderCountryCharts(filteredRows);
    state.renderedTabs.country = true;
  }
  if (activeTab === 'tab-weekly') {
    renderWeeklyCharts(filteredRows);
    state.renderedTabs.weekly = true;
  }
  if (activeTab === 'tab-monthly') {
    renderMonthlyCharts(filteredRows);
    state.renderedTabs.monthly = true;
  }
  if (activeTab === 'tab-leaderboard') {
    renderLeaderboardCharts(filteredRows);
    state.renderedTabs.leaderboard = true;
  }
  if (activeTab === 'tab-source') {
    renderSourceCharts(filteredRows);
    state.renderedTabs.source = true;
  }
  if (activeTab === 'tab-operations') {
    renderOperationsTables(filteredRows);
    state.renderedTabs.operations = true;
  }
  if (activeTab === 'tab-timing') {
    renderTimingTables(filteredRows);
    state.renderedTabs.timing = true;
  }
}
export {
  renderFunnelCharts,
  renderCountryCharts,
  renderWeeklyCharts,
  renderMonthlyCharts,
  renderLeaderboardCharts,
  renderSourceCharts,
  renderOperationsTables,
  renderTimingTables
};
