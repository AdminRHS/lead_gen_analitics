import { state } from './state.js';
import { t, formatLocaleDateTime, getActiveTabLabel } from './i18nSupport.js';

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

export function setupExportButtons() {
  const excelBtn = document.getElementById('exportExcel');
  if (excelBtn && !excelBtn.dataset.bound) {
    excelBtn.addEventListener('click', exportToExcel);
    excelBtn.dataset.bound = 'true';
  }

  const pdfBtn = document.getElementById('exportPDF');
  if (pdfBtn && !pdfBtn.dataset.bound) {
    pdfBtn.addEventListener('click', exportToPDF);
    pdfBtn.dataset.bound = 'true';
  }
}
