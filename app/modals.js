import { renderPairedBarChart } from '../charts.js';
import { parseDdMmYyyyToDate, toIsoDateInputValue } from '../utils.js';
import { state } from './state.js';
import { t, getMetricLabel, DAY_SUMMARY_METRICS } from './i18nSupport.js';
import { localeMap } from '../i18n/index.js';

let modalsInitialized = false;
const numberFormatters = new Map();

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

function normalizeDimensionValue(value, fallback = 'Unknown') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
  }
  return value;
}

function formatNumberValue(value, fractionDigits = 0) {
  const locale = localeMap[state.currentLanguage] || 'en-US';
  const cacheKey = `${locale}-${fractionDigits}`;
  if (!numberFormatters.has(cacheKey)) {
    numberFormatters.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits
      })
    );
  }
  const formatter = numberFormatters.get(cacheKey);
  const numeric = Number(value) || 0;
  return formatter.format(numeric);
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

function buildLeadTimelineDetails(leadName, rows, fromDate, toDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const leadDetails = [];

  rows.forEach((row, index) => {
    const name = row.Name || 'Unknown';
    if (name !== leadName) return;
    const date = parseDdMmYyyyToDate(row.Date);
    if (!(date instanceof Date) || isNaN(date.valueOf())) return;
    if (fromDate && date < fromDate) return;
    if (toDate && date > toDate) return;

    const created = Number(row['Created'] || 0);
    const sent = Number(row['Sent Requests'] || 0);
    const connected = Number(row['Connected'] || 0);
    const replies = Number(row['Total replies'] || 0);
    const positive = Number(row['Positive Replies'] || 0);
    const events = Number(row['Events Created'] || 0);
    const totalActivity = created + sent + connected + replies + positive + events;
    if (totalActivity === 0) return;

    const leadAge = Math.max(0, Math.round((now - date) / MS_PER_DAY));
    const timeStuck = events > 0 ? 0 : leadAge;

    leadDetails.push({
      entryId: `${leadName}-${date.getTime()}-${index}`,
      createdCount: created,
      sentCount: sent,
      connectedCount: connected,
      repliesCount: replies,
      positiveCount: positive,
      eventsCount: events,
      createdDate: created > 0 ? date : null,
      sentDate: sent > 0 ? date : null,
      connectedDate: connected > 0 ? date : null,
      repliesDate: replies > 0 ? date : null,
      positiveDate: positive > 0 ? date : null,
      eventDate: events > 0 ? date : null,
      leadAge,
      timeStuck,
      source: row.Source || 'Unknown',
      generator: leadName
    });
  });

  leadDetails.sort((a, b) => {
    const aDate = a.createdDate || a.sentDate || a.connectedDate || a.positiveDate || a.eventDate || 0;
    const bDate = b.createdDate || b.sentDate || b.connectedDate || b.positiveDate || b.eventDate || 0;
    return (bDate || 0) - (aDate || 0);
  });

  return leadDetails;
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

  const timelineDetails = buildLeadTimelineDetails(leadName, rows, from, to);
  let timelineHtml = '<div class="section-break"><div class="label">' + t('table.timelineDetailsTitle') + '</div></div>';
  timelineHtml += '<div class="table-responsive">';
  timelineHtml += '<table class="summary-table">';
  timelineHtml += '<thead><tr>';
  timelineHtml += '<th>#</th>';
  timelineHtml += '<th>' + t('table.created') + '</th>';
  timelineHtml += '<th>' + t('table.sentRequests') + '</th>';
  timelineHtml += '<th>' + t('table.connected') + '</th>';
  timelineHtml += '<th>' + t('table.replies') + '</th>';
  timelineHtml += '<th>' + t('table.positiveReplies') + '</th>';
  timelineHtml += '<th>' + t('table.events') + '</th>';
  timelineHtml += '<th>' + t('table.leadAge') + '</th>';
  timelineHtml += '<th>' + t('table.timeStuck') + '</th>';
  timelineHtml += '<th>' + t('table.source') + '</th>';
  timelineHtml += '<th>' + t('table.generator') + '</th>';
  timelineHtml += '</tr></thead><tbody>';
  
  const locale = localeMap[state.currentLanguage] || 'en-US';
  const formatDate = (date) => {
    if (!date) return '—';
    return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  const formatCountWithDate = (count, date) => {
    if (!count || count <= 0 || !date) return '—';
    const formattedCount = Number(count).toLocaleString(locale);
    return `${formattedCount}<br><span class="timeline-date">${formatDate(date)}</span>`;
  };

  if (!timelineDetails.length) {
    timelineHtml += `<tr><td colspan="11">${t('table.noData')}</td></tr>`;
  }

  timelineDetails.slice(0, 100).forEach((lead, index) => {
    timelineHtml += '<tr>';
    timelineHtml += '<td>' + (index + 1) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.createdCount, lead.createdDate) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.sentCount, lead.sentDate) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.connectedCount, lead.connectedDate) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.repliesCount, lead.repliesDate) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.positiveCount, lead.positiveDate) + '</td>';
    timelineHtml += '<td>' + formatCountWithDate(lead.eventsCount, lead.eventDate) + '</td>';
    timelineHtml += '<td>' + lead.leadAge + ' ' + t('table.days') + '</td>';
    timelineHtml += '<td>' + lead.timeStuck + ' ' + t('table.days') + '</td>';
    timelineHtml += '<td>' + lead.source + '</td>';
    timelineHtml += '<td>' + lead.generator + '</td>';
    timelineHtml += '</tr>';
  });
  timelineHtml += '</tbody></table></div>';
  if (timelineDetails.length > 100) {
    timelineHtml += '<div style="margin-top: 8px; color: #666; font-size: 12px;">' + t('table.showingFirst100') + ' ' + timelineDetails.length + '</div>';
  }
  const timelineEl = document.getElementById('leadTimelineDetails');
  if (timelineEl) timelineEl.innerHTML = timelineHtml;

  const overlay = document.getElementById('leadModalOverlay');
  showModalOverlay(overlay);
}

function buildSourceSamples(sourceName, rows, limit = 25) {
  const normalizedSource = normalizeDimensionValue(sourceName);
  return rows
    .filter((row) => normalizeDimensionValue(row.Source) === normalizedSource)
    .sort((a, b) => {
      const dateA = parseDdMmYyyyToDate(a.Date);
      const dateB = parseDdMmYyyyToDate(b.Date);
      return (dateB?.valueOf() || 0) - (dateA?.valueOf() || 0);
    })
    .slice(0, limit);
}

export function openSourceInsight(sourceName, rows) {
  const overlay = document.getElementById('sourceModalOverlay');
  if (!overlay) return;
  const samples = buildSourceSamples(sourceName, rows, 25);
  const summaryTotals = samples.reduce(
    (acc, row) => {
      acc.created += Number(row['Created'] || 0);
      acc.sent += Number(row['Sent Requests'] || 0);
      acc.connected += Number(row['Connected'] || 0);
      acc.positive += Number(row['Positive Replies'] || 0);
      acc.events += Number(row['Events Created'] || 0);
      return acc;
    },
    { created: 0, sent: 0, connected: 0, positive: 0, events: 0 }
  );

  const summaryEl = document.getElementById('sourceModalSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <table class="summary-table">
        <tbody>
          <tr><td>${t('table.created')}</td><td>${formatNumberValue(summaryTotals.created)}</td></tr>
          <tr><td>${t('table.sentRequests')}</td><td>${formatNumberValue(summaryTotals.sent)}</td></tr>
          <tr><td>${t('table.connected')}</td><td>${formatNumberValue(summaryTotals.connected)}</td></tr>
          <tr><td>${t('table.positiveReplies')}</td><td>${formatNumberValue(summaryTotals.positive)}</td></tr>
          <tr><td>${t('table.events')}</td><td>${formatNumberValue(summaryTotals.events)}</td></tr>
        </tbody>
      </table>
    `;
  }

  const body = document.getElementById('sourceSamplesBody');
  if (body) {
    if (!samples.length) {
      body.innerHTML = `<tr><td colspan="8">${t('table.noData')}</td></tr>`;
    } else {
      const locale = localeMap[state.currentLanguage] || 'en-US';
      const formatDate = (value) => {
        const dateObj = parseDdMmYyyyToDate(value);
        return dateObj instanceof Date && !isNaN(dateObj.valueOf())
          ? dateObj.toLocaleDateString(locale)
          : '—';
      };
      body.innerHTML = samples
        .map((row) => {
          const companySize =
            row['Company Size'] ||
            row['Company size'] ||
            row['Company Segment'] ||
            row['Company segment'] ||
            '—';
          return `
            <tr>
              <td>${row.Name || '—'}</td>
              <td>${row.Country || '—'}</td>
              <td>${companySize || '—'}</td>
              <td>${formatNumberValue(row['Created'] || 0)}</td>
              <td>${formatNumberValue(row['Sent Requests'] || 0)}</td>
              <td>${formatNumberValue(row['Connected'] || 0)}</td>
              <td>${formatNumberValue(row['Positive Replies'] || 0)}</td>
              <td>${formatNumberValue(row['Events Created'] || 0)}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  const titleEl = document.getElementById('sourceModalTitle');
  if (titleEl) {
    titleEl.textContent = `${t('modals.sourceInsight')} — ${sourceName}`;
  }

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

function bindSourceModalButtons() {
  const overlay = document.getElementById('sourceModalOverlay');
  const closeBtn = document.getElementById('closeSourceModal');
  const doneBtn = document.getElementById('doneSourceModal');
  [closeBtn, doneBtn].forEach((btn) => {
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => hideModalOverlay(overlay));
      btn.dataset.bound = 'true';
    }
  });
  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideModalOverlay(overlay);
    });
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
  bindSourceModalButtons();
  modalsInitialized = true;
}
