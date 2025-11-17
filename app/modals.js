import { renderPairedBarChart } from '../charts.js';
import { parseDdMmYyyyToDate, toIsoDateInputValue } from '../utils.js';
import { state } from './state.js';
import { t, getMetricLabel, DAY_SUMMARY_METRICS } from './i18nSupport.js';

let modalsInitialized = false;

export function showModalOverlay(overlay) {
  if (!overlay || overlay.classList.contains('visible')) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  });
  state.openModalCount += 1;
  document.body.style.overflow = 'hidden';
}

export function hideModalOverlay(overlay) {
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

  state.openModalCount = Math.max(0, state.openModalCount - 1);
  if (state.openModalCount === 0) {
    document.body.style.overflow = '';
  }
}

function getRowsForDay(dateObj) {
  const target = toIsoDateInputValue(dateObj);
  return state.rows.filter((r) => {
    const d = parseDdMmYyyyToDate(r.Date);
    if (!d) return false;
    return toIsoDateInputValue(d) === target;
  });
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

function sortDayData(sortColumn) {
  if (!state.currentDayData) return;
  const sortedNames = Object.keys(state.currentDayData).sort((a, b) => {
    const valueA = state.currentDayData[a][sortColumn] || 0;
    const valueB = state.currentDayData[b][sortColumn] || 0;
    return valueB - valueA;
  });

  const totals = { Created: 0, SentRequests: 0, Connected: 0, PositiveReplies: 0, Events: 0 };
  let html = '';
  html += '<table class="summary-table">';
  const headerCells = DAY_SUMMARY_METRICS.map((metric) => `<th>${t(metric.labelKey)}</th>`).join('');
  html += `<thead><tr><th>${t('table.name')}</th>${headerCells}</tr></thead>`;
  html += '<tbody>';

  for (const name of sortedNames) {
    const row = state.currentDayData[name];
    totals.Created += row.Created;
    totals.SentRequests += row.SentRequests;
    totals.Connected += row.Connected;
    totals.PositiveReplies += row.PositiveReplies;
    totals.Events += row.Events;
    const metricCells = DAY_SUMMARY_METRICS.map((metric) => `<td>${row[metric.key]}</td>`).join('');
    html += `<tr><td>${name}</td>${metricCells}</tr>`;
  }

  html += '</tbody>';
  const totalCells = DAY_SUMMARY_METRICS.map((metric) => `<td>${totals[metric.key]}</td>`).join('');
  html += `<tfoot><tr><td>${t('table.total')}</td>${totalCells}</tr></tfoot>`;
  html += '</table>';

  const container = document.getElementById('daySummaryContainer');
  if (container) {
    container.innerHTML = html;
  }
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

  state.currentDayData = byName;
  const sortSelect = document.getElementById('sortColumn');
  const selected = sortSelect ? sortSelect.value : 'Created';
  sortDayData(selected || 'Created');
  const titleEl = document.getElementById('dayModalTitle');
  if (titleEl) {
    titleEl.textContent = `${t('modals.daySummary')} — ${toIsoDateInputValue(dateObj)}`;
  }
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
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { Created: 0, Events: 0 };
    byMonth[key].Created += Number(r['Created'] || 0);
    byMonth[key].Events += Number(r['Events Created'] || 0);
  }
  const months = Object.keys(byMonth).sort();
  return { months, created: months.map((m) => byMonth[m].Created), events: months.map((m) => byMonth[m].Events) };
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
  entries.sort((a, b) => b.cr - a.cr || b.Events - a.Events);
  return entries.slice(0, limit);
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
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { Created: 0, Events: 0 };
    byMonth[key].Created += Number(r['Created'] || 0);
    byMonth[key].Events += Number(r['Events Created'] || 0);
  }
  const months = Object.keys(byMonth).sort();
  return { months, created: months.map((m) => byMonth[m].Created), events: months.map((m) => byMonth[m].Events) };
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
  entries.sort((a, b) => b.cr - a.cr || b.Events - a.Events);
  return entries.slice(0, limit);
}

export function openCountryInsight(countryName, rows) {
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const from = new Date(fromInput?.value || state.maxDate);
  const to = new Date(toInput?.value || state.maxDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const summary = aggregateCountrySummary(countryName, rows, from, to);
  const cr = summary.Created > 0 ? (summary.Events / summary.Created) * 100 : 0;
  const sentToConn = summary.SentRequests > 0 ? (summary.Connected / summary.SentRequests) * 100 : 0;
  const posToRep = summary.Replies > 0 ? (summary.PositiveReplies / summary.Replies) * 100 : 0;
  const summaryHtml = `
    <div class="summary-table-wrapper">
      <table class="summary-table">
        <thead><tr><th>${t('table.metric')}</th><th>${t('table.value')}</th></tr></thead>
        <tbody>
          <tr><td>${t('table.created')}</td><td>${summary.Created}</td></tr>
          <tr><td>${t('table.sentRequests')}</td><td>${summary.SentRequests}</td></tr>
          <tr><td>${t('table.connected')}</td><td>${summary.Connected}</td></tr>
          <tr><td>${t('table.replies')}</td><td>${summary.Replies}</td></tr>
          <tr><td>${t('table.positiveReplies')}</td><td>${summary.PositiveReplies}</td></tr>
          <tr><td>${t('table.events')}</td><td>${summary.Events}</td></tr>
          <tr><td>${t('table.crEvents')}</td><td>${cr.toFixed(2)}%</td></tr>
          <tr><td>${t('table.csRate')}</td><td>${sentToConn.toFixed(2)}%</td></tr>
          <tr><td>${t('table.prRate')}</td><td>${posToRep.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    </div>`;
  const summaryEl = document.getElementById('countrySummary');
  if (summaryEl) summaryEl.innerHTML = summaryHtml;
  const titleEl = document.getElementById('countryModalTitle');
  if (titleEl) titleEl.textContent = `${t('modals.countryInsight')} — ${countryName}`;

  const monthly = aggregateCountryMonthly(countryName, rows, from, to);
  if (state.chartRefs.countryMonthlyPaired) state.chartRefs.countryMonthlyPaired.destroy();
  state.chartRefs.countryMonthlyPaired = renderPairedBarChart(
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
  for (const entry of top) {
    topHtml += `<tr><td>${entry.name}</td><td>${entry.Created}</td><td>${entry.Events}</td><td>${entry.cr.toFixed(2)}%</td></tr>`;
  }
  topHtml += '</tbody></table>';
  const topEl = document.getElementById('countryTopGenerators');
  if (topEl) topEl.innerHTML = topHtml;

  const overlay = document.getElementById('countryModalOverlay');
  showModalOverlay(overlay);
}

export function openLeadInsight(leadName, rows) {
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const from = new Date(fromInput?.value || state.maxDate);
  const to = new Date(toInput?.value || state.maxDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const summary = aggregateLeadSummary(leadName, rows, from, to);
  const cr = summary.Created > 0 ? (summary.Events / summary.Created) * 100 : 0;
  const sentToConn = summary.SentRequests > 0 ? (summary.Connected / summary.SentRequests) * 100 : 0;
  const posToRep = summary.Replies > 0 ? (summary.PositiveReplies / summary.Replies) * 100 : 0;
  const summaryHtml = `
    <div class="summary-table-wrapper">
      <table class="summary-table">
        <thead><tr><th>${t('table.metric')}</th><th>${t('table.value')}</th></tr></thead>
        <tbody>
          <tr><td>${t('table.created')}</td><td>${summary.Created}</td></tr>
          <tr><td>${t('table.sentRequests')}</td><td>${summary.SentRequests}</td></tr>
          <tr><td>${t('table.connected')}</td><td>${summary.Connected}</td></tr>
          <tr><td>${t('table.replies')}</td><td>${summary.Replies}</td></tr>
          <tr><td>${t('table.positiveReplies')}</td><td>${summary.PositiveReplies}</td></tr>
          <tr><td>${t('table.events')}</td><td>${summary.Events}</td></tr>
          <tr><td>${t('table.crEvents')}</td><td>${cr.toFixed(2)}%</td></tr>
          <tr><td>${t('table.csRate')}</td><td>${sentToConn.toFixed(2)}%</td></tr>
          <tr><td>${t('table.prRate')}</td><td>${posToRep.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    </div>`;
  const summaryEl = document.getElementById('leadSummary');
  if (summaryEl) summaryEl.innerHTML = summaryHtml;
  const titleEl = document.getElementById('leadModalTitle');
  if (titleEl) titleEl.textContent = `${t('modals.leadInsight')} — ${leadName}`;

  const monthly = aggregateLeadMonthly(leadName, rows, from, to);
  if (state.chartRefs.leadMonthlyPaired) state.chartRefs.leadMonthlyPaired.destroy();
  state.chartRefs.leadMonthlyPaired = renderPairedBarChart(
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
  for (const entry of top) {
    topHtml += `<tr><td>${entry.country}</td><td>${entry.Created}</td><td>${entry.Events}</td><td>${entry.cr.toFixed(2)}%</td></tr>`;
  }
  topHtml += '</tbody></table>';
  const topEl = document.getElementById('leadTopCountries');
  if (topEl) topEl.innerHTML = topHtml;

  const overlay = document.getElementById('leadModalOverlay');
  showModalOverlay(overlay);
}

function bindSortSelect() {
  const sortSelect = document.getElementById('sortColumn');
  if (!sortSelect || sortSelect.dataset.bound) return;
  sortSelect.addEventListener('change', () => {
    sortDayData(sortSelect.value || 'Created');
  });
  sortSelect.dataset.bound = 'true';
}

function bindDayPicker() {
  const dayPicker = document.getElementById('dayPicker');
  if (!dayPicker || dayPicker.dataset.bound) return;
  dayPicker.addEventListener('change', () => {
    const d = new Date(dayPicker.value);
    renderDaySummary(d);
    const sortSelect = document.getElementById('sortColumn');
    if (sortSelect) sortDayData(sortSelect.value || 'Created');
  });
  dayPicker.dataset.bound = 'true';
}

function bindDayModalButtons() {
  const overlay = document.getElementById('dayModalOverlay');
  const openBtn = document.getElementById('openDaySummary');
  const closeBtn = document.getElementById('closeDayModal');
  const doneBtn = document.getElementById('doneDay');
  const exportCsvBtn = document.getElementById('exportDayCsv');
  if (openBtn && !openBtn.dataset.bound) {
    openBtn.addEventListener('click', () => {
      const dayPicker = document.getElementById('dayPicker');
      if (dayPicker) {
        dayPicker.value = toIsoDateInputValue(state.maxDate);
        renderDaySummary(new Date(dayPicker.value));
      }
      const sortSelect = document.getElementById('sortColumn');
      if (sortSelect) sortDayData(sortSelect.value || 'Created');
      showModalOverlay(overlay);
    });
    openBtn.dataset.bound = 'true';
  }
  [closeBtn, doneBtn].forEach((btn) => {
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => hideModalOverlay(overlay));
      btn.dataset.bound = 'true';
    }
  });
  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModalOverlay(overlay); });
    overlay.dataset.bound = 'true';
  }
  if (exportCsvBtn && !exportCsvBtn.dataset.bound) {
    exportCsvBtn.addEventListener('click', () => {
      const dayPicker = document.getElementById('dayPicker');
      const d = new Date(dayPicker?.value || state.maxDate);
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
    exportCsvBtn.dataset.bound = 'true';
  }
}

function bindCountryModalButtons() {
  const overlay = document.getElementById('countryModalOverlay');
  const closeBtn = document.getElementById('closeCountryModal');
  const doneBtn = document.getElementById('doneCountry');
  [closeBtn, doneBtn].forEach((btn) => {
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => hideModalOverlay(overlay));
      btn.dataset.bound = 'true';
    }
  });
  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModalOverlay(overlay); });
    overlay.dataset.bound = 'true';
  }
}

function bindLeadModalButtons() {
  const overlay = document.getElementById('leadModalOverlay');
  const closeBtn = document.getElementById('closeLeadModal');
  const doneBtn = document.getElementById('doneLead');
  [closeBtn, doneBtn].forEach((btn) => {
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => hideModalOverlay(overlay));
      btn.dataset.bound = 'true';
    }
  });
  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModalOverlay(overlay); });
    overlay.dataset.bound = 'true';
  }
}

export function setupModals() {
  if (modalsInitialized) return;
  bindSortSelect();
  bindDayPicker();
  bindDayModalButtons();
  bindCountryModalButtons();
  bindLeadModalButtons();
  modalsInitialized = true;
}
