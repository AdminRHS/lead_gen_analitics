const en = {
  common: {
    title: 'Lead Generation Dashboard',
    loading: 'Loading...',
    from: 'From',
    to: 'To',
    language: 'Language',
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    daySummary: 'Day Summary',
    apply: 'Apply',
    reset: 'Reset',
    lastUpdated: 'Last updated',
    cacheFromCache: '📦 From cache',
    cacheFromServer: '🔄 From server',
    refreshTooltip: 'Refresh data',
    close: 'Close',
    done: 'Done',
    exportCsv: 'Export CSV',
    exportExcel: '📊 Export Excel',
    exportPdf: '📄 Export PDF',
    unknown: 'Unknown'
  },
  tabs: {
    funnel: 'Funnel',
    countries: 'Countries',
    weekly: 'Weekly',
    monthly: 'Monthly',
    leaderboard: 'Leaderboard',
    source: 'Source Comparison'
  },
  charts: {
    labels: {
      conversionRatePercent: 'Conversion Rate (%)'
    },
    funnel: {
      createdToSent: 'Created → Sent Requests',
      sentToConnected: 'Sent Requests → Connected',
      connectedToReplies: 'Connected → Replies',
      repliesToPositive: 'Replies → Positive Replies',
      positiveToEvents: 'Positive Replies → Events'
    },
    countries: {
      conversionRate: 'Conversion Rate (Created → Events) by Country',
      createdToSent: 'Created → Sent Requests (by Country)',
      sentToConnected: 'Sent Requests → Connected (by Country)',
      connectedToReplies: 'Connected → Replies (by Country)',
      repliesToPositive: 'Replies → Positive Replies (by Country)',
      positiveToEvents: 'Positive Replies → Events (by Country)'
    },
    weekly: {
      createdToSent: 'Weekly: Created → Sent Requests',
      sentToConnected: 'Weekly: Sent Requests → Connected',
      connectedToReplies: 'Weekly: Connected → Replies',
      repliesToPositive: 'Weekly: Replies → Positive Replies',
      positiveToEvents: 'Weekly: Positive Replies → Events'
    },
    monthly: {
      conversionRate: 'Monthly: Conversion Rate (Created → Events)',
      createdToSent: 'Monthly: Created → Sent Requests',
      sentToConnected: 'Monthly: Sent Requests → Connected',
      connectedToReplies: 'Monthly: Connected → Replies',
      repliesToPositive: 'Monthly: Replies → Positive Replies',
      positiveToEvents: 'Monthly: Positive Replies → Events'
    },
    leaderboard: {
      conversionRate: 'Conversion Rate (Created → Events) by Lead Generator',
      created: 'Created by Lead Generator (month/range)',
      sent: 'Sent Requests by Lead Generator',
      positive: 'Positive Replies by Lead Generator',
      events: 'Events Created by Lead Generator'
    },
    source: {
      conversionRate: 'Source Comparison: Conversion Rate (Created → Events)',
      createdToSent: 'Source Comparison: Created → Sent Requests',
      sentToConnected: 'Source Comparison: Sent Requests → Connected',
      connectedToReplies: 'Source Comparison: Connected → Total Replies',
      repliesToPositive: 'Source Comparison: Total Replies → Positive Replies',
      positiveToEvents: 'Source Comparison: Positive Replies → Events'
    },
    modal: {
      monthlyCreatedEvents: 'Monthly Created vs Events'
    }
  },
  modals: {
    pickDate: 'Pick a date:',
    sortBy: 'Sort by:',
    daySummary: 'Day Summary',
    countryInsight: 'Country Insight',
    leadInsight: 'Lead Insight',
    topGenerators: 'Top 5 Generators',
    topCountries: 'Top 5 Countries'
  },
  table: {
    name: 'Name',
    country: 'Country',
    created: 'Created',
    sentRequests: 'Sent Requests',
    connected: 'Connected',
    replies: 'Total Replies',
    positiveReplies: 'Positive Replies',
    events: 'Events',
    total: 'Total',
    metric: 'Metric',
    value: 'Value',
    crEvents: 'CR (Events/Created)',
    csRate: 'C→S (Connected/Sent)',
    prRate: 'P→R (Positive/Replies)',
    crShort: 'CR'
  },
  alerts: {
    noDataLoaded: 'No data available. Please wait for data to load.',
    invalidDates: 'Please select valid dates.',
    excelLibraryMissing: 'Excel library not loaded. Please refresh the page.',
    pdfLibraryMissing: 'PDF library not loaded. Please refresh the page.',
    noDataForDay: 'No data available for selected day.',
    exportExcelError: 'Error exporting to Excel: ',
    exportPdfError: 'Error exporting to PDF: ',
    dataNotLoaded: 'Data not loaded yet. Please wait for data to load.',
    noDataToExport: 'No data available to export. Please wait for data to load.'
  },
  errors: {
    dataLoadTitle: 'Data load error',
    dataLoadDescription: 'Please check the browser console for details and try refreshing the page.',
    cacheFallbackTitle: '⚠️ Warning',
    cacheFallbackMessage: 'Unable to fetch data from the server. Using cached data.',
    cacheFallbackHint: 'Try refreshing the page or press the refresh button.',
    dataLoadShort: '❌ Data load error'
  },
  pdf: {
    daySummary: 'Day Summary',
    leadGenDashboard: 'Lead Generation Dashboard',
    date: 'Date',
    exported: 'Exported',
    dateRange: 'Date Range',
    activeTab: 'Active Tab',
    summaryTotals: 'Summary Totals',
    summaryByName: 'Summary by Name',
    topCountries: 'Top Countries',
    topGenerators: 'Top Lead Generators'
  }
};

export default en;

