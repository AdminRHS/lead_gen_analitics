import { state } from './state.js';
import { t, formatLocaleDateTime, getActiveTabLabel } from './i18nSupport.js';

function quoteCsvValue(value) {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}

function downloadCsv(filename, headers, rows) {
  const csvLines = [];
  if (headers && headers.length) {
    csvLines.push(headers.map(quoteCsvValue).join(','));
  }
  rows.forEach((row) => {
    csvLines.push(row.map(quoteCsvValue).join(','));
  });
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ensureJsPdf() {
  if (!window.jspdf) {
    alert(t('alerts.pdfLibraryMissing'));
    return null;
  }
  return window.jspdf.jsPDF;
}

function getReportFileName(prefix, extension) {
  const dateStr = new Date().toISOString().split('T')[0];
  return `${prefix}-${dateStr}.${extension}`;
}

export function exportToExcel() {
  try {
    if (!window.XLSX) {
      alert(t('alerts.excelLibraryMissing'));
      return;
    }

    if (typeof state.rows === 'undefined') {
      console.error('rows is not defined in exportToExcel');
      alert(t('alerts.dataNotLoaded'));
      return;
    }

    const filteredRows = state.lastFilteredRows.length > 0 ? state.lastFilteredRows : (state.rows || []);
    if (!filteredRows || filteredRows.length === 0) {
      alert(t('alerts.noDataToExport'));
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(filteredRows);
    XLSX.utils.book_append_sheet(wb, wsData, 'Data');

    const agg = state.aggregationCache;
    if (agg.funnel) {
      const rows = agg.dates.map((date, idx) => ({
        Date: date,
        Created: agg.funnel.created[idx],
        'Sent Requests': agg.funnel.sent[idx],
        Connected: agg.funnel.connected[idx],
        Replies: agg.funnel.replies[idx],
        'Positive Replies': agg.funnel.positive[idx],
        Events: agg.funnel.events[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Funnel');
    }

    if (agg.country) {
      const rows = agg.country.countries.map((country, idx) => ({
        Country: country,
        Created: agg.country.created[idx],
        'Sent Requests': agg.country.sent[idx],
        Connected: agg.country.connected[idx],
        Replies: agg.country.replies[idx],
        'Positive Replies': agg.country.positive[idx],
        Events: agg.country.events[idx],
        'Conversion Rate %': agg.country.conversionRates[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Countries');
    }

    if (agg.weekly) {
      const rows = agg.weekly.weeks.map((week, idx) => ({
        Week: week,
        Created: agg.weekly.created[idx],
        'Sent Requests': agg.weekly.sent[idx],
        Connected: agg.weekly.connected[idx],
        Replies: agg.weekly.replies[idx],
        'Positive Replies': agg.weekly.positive[idx],
        Events: agg.weekly.events[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Weekly');
    }

    if (agg.monthly) {
      const rows = agg.monthly.months.map((month, idx) => ({
        Month: month,
        Created: agg.monthly.created[idx],
        'Sent Requests': agg.monthly.sent[idx],
        Connected: agg.monthly.connected[idx],
        Replies: agg.monthly.replies[idx],
        'Positive Replies': agg.monthly.positive[idx],
        Events: agg.monthly.events[idx],
        'Conversion Rate %': agg.monthly.conversionRates[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Monthly');
    }

    if (agg.leaderboard) {
      const rows = agg.leaderboard.names.map((name, idx) => ({
        Name: name,
        Created: agg.leaderboard.created[idx],
        'Sent Requests': agg.leaderboard.sent[idx],
        'Positive Replies': agg.leaderboard.positive[idx],
        Events: agg.leaderboard.events[idx],
        'Conversion Rate %': agg.leaderboard.conversionRates[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Leaderboard');
    }

    if (agg.source) {
      const rows = agg.source.sources.map((source, idx) => ({
        Source: source,
        Created: agg.source.created[idx],
        'Sent Requests': agg.source.sentRequests[idx],
        Connected: agg.source.connected[idx],
        'Total Replies': agg.source.totalReplies[idx],
        'Positive Replies': agg.source.positiveReplies[idx],
        Events: agg.source.events[idx],
        'Conversion Rate %': agg.source.conversionRates[idx]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Source');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `lead-gen-dashboard-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert(t('alerts.exportExcelError') + error.message);
  }
}

export async function exportToPDF() {
  try {
    if (!window.jspdf) {
      alert(t('alerts.pdfLibraryMissing'));
      return;
    }

    if (typeof state.rows === 'undefined') {
      console.error('rows is not defined in exportToPDF');
      alert(t('alerts.dataNotLoaded'));
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

    const filteredRows = state.lastFilteredRows.length > 0 ? state.lastFilteredRows : (state.rows || []);
    if (filteredRows && filteredRows.length > 0) {
      const totals = {
        Created: 0,
        'Sent Requests': 0,
        Connected: 0,
        'Total replies': 0,
        'Positive Replies': 0,
        'Events Created': 0
      };

      filteredRows.forEach((row) => {
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
      const colWidth = (pageWidth - 2 * margin) / 2;
      tableData.forEach((row, idx) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
        doc.text(row[0], margin, yPos);
        doc.text(row[1], margin + colWidth, yPos, { align: 'right' });
        yPos += lineHeight;
      });
      yPos += 10;
    }

    const appendTopList = (title, items) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, yPos);
      yPos += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      items.forEach((text, idx) => {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${idx + 1}. ${text}`, margin, yPos);
        yPos += lineHeight;
      });
    };

    if (activeTab === 'tab-country' && state.aggregationCache.country) {
      const agg = state.aggregationCache.country;
      const items = agg.countries.slice(0, 10).map((country, idx) =>
        `${country}: ${agg.events[idx]} ${t('table.events')} (${agg.conversionRates[idx].toFixed(2)}% ${t('table.crShort')})`
      );
      appendTopList(t('pdf.topCountries'), items);
    }

    if (activeTab === 'tab-leaderboard' && state.aggregationCache.leaderboard) {
      const agg = state.aggregationCache.leaderboard;
      const items = agg.names.slice(0, 10).map((name, idx) =>
        `${name}: ${agg.events[idx]} ${t('table.events')} (${agg.conversionRates[idx].toFixed(2)}% ${t('table.crShort')})`
      );
      appendTopList(t('pdf.topGenerators'), items);
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `lead-gen-dashboard-${dateStr}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert(t('alerts.exportPdfError') + error.message);
  }
}

export function exportTeamLoadCsv() {
  const dataset = state.tableData.teamLoad?.rows || [];
  if (!dataset.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const headers = [
    t('table.name'),
    t('table.activeLeadsAssigned'),
    t('table.leadsInProgress'),
    t('table.leadsOverdue'),
    t('table.avgLeadsPerDay'),
    t('table.eventsThisWeek')
  ];
  const rows = dataset.map((row) => [
    row.name,
    row.activeLeadsAssigned,
    row.leadsInProgress,
    row.leadsOverdue,
    row.avgLeadsPerDay,
    row.eventsThisWeek
  ]);
  downloadCsv(getReportFileName('team-load', 'csv'), headers, rows);
}

export function exportTeamLoadPdf() {
  const dataset = state.tableData.teamLoad?.rows || [];
  if (!dataset.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const jsPDF = ensureJsPdf();
  if (!jsPDF) return;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const margin = 15;
  let y = 20;
  doc.setFontSize(16);
  doc.text(t('table.teamLoadTitle'), margin, y);
  y += 10;
  doc.setFontSize(10);
  dataset.forEach((row) => {
    if (y > doc.internal.pageSize.getHeight() - 10) {
      doc.addPage();
      y = 20;
    }
    const line = `${row.name} • ${t('table.activeLeadsAssigned')}: ${row.activeLeadsAssigned} • ${t('table.leadsInProgress')}: ${row.leadsInProgress} • ${t('table.leadsOverdue')}: ${row.leadsOverdue} • ${t('table.avgLeadsPerDay')}: ${row.avgLeadsPerDay.toFixed(
      1
    )} • ${t('table.eventsThisWeek')}: ${row.eventsThisWeek}`;
    doc.text(line, margin, y);
    y += 6;
  });
  doc.save(getReportFileName('team-load', 'pdf'));
}

export function exportCountrySegmentationCsv() {
  const dataset = state.tableData.countrySegmentation;
  if (!dataset || !dataset.countries || !dataset.countries.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const headers = [t('table.stage'), t('table.country'), t('table.created'), t('table.positiveReplies'), t('table.events')];
  const rows = [];
  dataset.segments.forEach((segment) => {
    dataset.countries.forEach((country) => {
      const data = dataset.crossTab?.[segment]?.[country];
      if (!data) return;
      rows.push([segment, country, data.created, data.positive, data.events]);
    });
  });
  downloadCsv(getReportFileName('country-segmentation', 'csv'), headers, rows);
}

export function exportCountrySegmentationPdf() {
  const dataset = state.tableData.countrySegmentation;
  if (!dataset || !dataset.countries || !dataset.countries.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const jsPDF = ensureJsPdf();
  if (!jsPDF) return;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const margin = 15;
  let y = 20;
  doc.setFontSize(16);
  doc.text(t('table.countrySegmentationTitle'), margin, y);
  y += 10;
  doc.setFontSize(10);
  dataset.segments.forEach((segment) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(segment, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    dataset.countries.forEach((country) => {
      const data = dataset.crossTab?.[segment]?.[country];
      if (!data) return;
      if (y > doc.internal.pageSize.getHeight() - 10) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${country}: ${t('table.created')} ${data.created}, ${t('table.positiveReplies')} ${data.positive}, ${t('table.events')} ${data.events}`,
        margin,
        y
      );
      y += 5;
    });
    y += 4;
  });
  doc.save(getReportFileName('country-segmentation', 'pdf'));
}

export function exportLeadTimelineCsv() {
  const timeline = state.exportTemplates.timeline || [];
  if (!timeline.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const headers = [
    '#',
    t('table.createdDate'),
    t('table.sentDate'),
    t('table.connectedDate'),
    t('table.positiveDate'),
    t('table.eventDate'),
    t('table.source'),
    t('table.generator')
  ];
  const rows = timeline.map((lead, index) => [
    index + 1,
    lead.createdDate ? lead.createdDate.toISOString().split('T')[0] : '—',
    lead.sentDate ? lead.sentDate.toISOString().split('T')[0] : '—',
    lead.connectedDate ? lead.connectedDate.toISOString().split('T')[0] : '—',
    lead.positiveDate ? lead.positiveDate.toISOString().split('T')[0] : '—',
    lead.eventDate ? lead.eventDate.toISOString().split('T')[0] : '—',
    lead.source || '—',
    lead.generator || '—'
  ]);
  const leadName = state.exportTemplates.timelineMeta?.leadName || 'lead';
  downloadCsv(getReportFileName(`timeline-${leadName}`, 'csv'), headers, rows);
}

export function exportLeadTimelinePdf() {
  const timeline = state.exportTemplates.timeline || [];
  if (!timeline.length) {
    alert(t('alerts.noDataToExport'));
    return;
  }
  const jsPDF = ensureJsPdf();
  if (!jsPDF) return;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const margin = 15;
  let y = 20;
  const leadName = state.exportTemplates.timelineMeta?.leadName || '';
  doc.setFontSize(16);
  doc.text(`${t('table.timelineDetailsTitle')} — ${leadName}`, margin, y);
  y += 10;
  doc.setFontSize(9);
  timeline.slice(0, 80).forEach((lead, index) => {
    if (y > doc.internal.pageSize.getHeight() - 10) {
      doc.addPage();
      y = 20;
    }
    const line = `${index + 1}. ${t('table.createdDate')}: ${lead.createdDate ? lead.createdDate.toLocaleDateString() : '—'} | ${t('table.sentDate')}: ${
      lead.sentDate ? lead.sentDate.toLocaleDateString() : '—'
    } | ${t('table.connectedDate')}: ${lead.connectedDate ? lead.connectedDate.toLocaleDateString() : '—'} | ${t('table.positiveDate')}: ${
      lead.positiveDate ? lead.positiveDate.toLocaleDateString() : '—'
    } | ${t('table.eventDate')}: ${lead.eventDate ? lead.eventDate.toLocaleDateString() : '—'} | ${t('table.source')}: ${lead.source || '—'}`;
    doc.text(line, margin, y);
    y += 6;
  });
  doc.save(getReportFileName(`timeline-${leadName || 'lead'}`, 'pdf'));
}

function bindExportButton(id, handler) {
  const btn = document.getElementById(id);
  if (btn && !btn.dataset.bound) {
    btn.addEventListener('click', handler);
    btn.dataset.bound = 'true';
  }
}

export function setupExportButtons() {
  bindExportButton('exportExcel', exportToExcel);
  bindExportButton('exportPDF', exportToPDF);
  bindExportButton('teamLoadExportCsv', exportTeamLoadCsv);
  bindExportButton('teamLoadExportPdf', exportTeamLoadPdf);
  bindExportButton('countrySegExportCsv', exportCountrySegmentationCsv);
  bindExportButton('countrySegExportPdf', exportCountrySegmentationPdf);
  bindExportButton('exportLeadTimelineCsv', exportLeadTimelineCsv);
  bindExportButton('exportLeadTimelinePdf', exportLeadTimelinePdf);
}
