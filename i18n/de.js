const de = {
  common: {
    title: 'Lead-Generierungs-Dashboard',
    loading: 'Wird geladen...',
    from: 'Von',
    to: 'Bis',
    language: 'Sprache',
    themeLight: 'Heller Modus',
    themeDark: 'Dunkler Modus',
    daySummary: 'Tagesübersicht',
    apply: 'Anwenden',
    reset: 'Zurücksetzen',
    lastUpdated: 'Zuletzt aktualisiert',
    cacheFromCache: '📦 Aus dem Cache',
    cacheFromServer: '🔄 Vom Server',
    refreshTooltip: 'Daten aktualisieren',
    close: 'Schließen',
    done: 'Fertig',
    exportCsv: 'CSV exportieren',
    exportExcel: '📊 Excel exportieren',
    exportPdf: '📄 PDF exportieren',
    unknown: 'Unbekannt'
  },
  tabs: {
    funnel: 'Funnel',
    countries: 'Länder',
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    leaderboard: 'Leaderboard',
    source: 'Quellenvergleich'
  },
  charts: {
    labels: {
      conversionRatePercent: 'Konversionsrate (%)'
    },
    funnel: {
      createdToSent: 'Erstellt → Gesendete Anfragen',
      sentToConnected: 'Gesendet → Vernetzt',
      connectedToReplies: 'Vernetzt → Antworten',
      repliesToPositive: 'Antworten → Positive Antworten',
      positiveToEvents: 'Positive Antworten → Events'
    },
    countries: {
      conversionRate: 'Conversion Rate (Erstellt → Events) nach Ländern',
      createdToSent: 'Erstellt → Gesendet (nach Ländern)',
      sentToConnected: 'Gesendet → Vernetzt (nach Ländern)',
      connectedToReplies: 'Vernetzt → Antworten (nach Ländern)',
      repliesToPositive: 'Antworten → Positive (nach Ländern)',
      positiveToEvents: 'Positive → Events (nach Ländern)'
    },
    weekly: {
      createdToSent: 'Woche: Erstellt → Gesendet',
      sentToConnected: 'Woche: Gesendet → Vernetzt',
      connectedToReplies: 'Woche: Vernetzt → Antworten',
      repliesToPositive: 'Woche: Antworten → Positive',
      positiveToEvents: 'Woche: Positive → Events'
    },
    monthly: {
      conversionRate: 'Monat: Conversion Rate (Erstellt → Events)',
      createdToSent: 'Monat: Erstellt → Gesendet',
      sentToConnected: 'Monat: Gesendet → Vernetzt',
      connectedToReplies: 'Monat: Vernetzt → Antworten',
      repliesToPositive: 'Monat: Antworten → Positive',
      positiveToEvents: 'Monat: Positive → Events'
    },
    leaderboard: {
      conversionRate: 'Conversion Rate (Erstellt → Events) je Lead',
      created: 'Erstellt nach Lead (Zeitraum)',
      sent: 'Gesendete Anfragen nach Lead',
      positive: 'Positive Antworten nach Lead',
      events: 'Erstellte Events nach Lead'
    },
    source: {
      conversionRate: 'Quellenvergleich: Conversion Rate (Erstellt → Events)',
      createdToSent: 'Quellenvergleich: Erstellt → Gesendet',
      sentToConnected: 'Quellenvergleich: Gesendet → Vernetzt',
      connectedToReplies: 'Quellenvergleich: Vernetzt → Antworten',
      repliesToPositive: 'Quellenvergleich: Antworten → Positive',
      positiveToEvents: 'Quellenvergleich: Positive → Events'
    },
    modal: {
      monthlyCreatedEvents: 'Monatlich Erstellt vs Events'
    }
  },
  modals: {
    pickDate: 'Datum wählen:',
    sortBy: 'Sortieren nach:',
    daySummary: 'Tagesübersicht',
    countryInsight: 'Länderanalyse',
    leadInsight: 'Lead-Analyse',
    topGenerators: 'Top 5 Generatoren',
    topCountries: 'Top 5 Länder'
  },
  table: {
    name: 'Name',
    country: 'Land',
    created: 'Erstellt',
    sentRequests: 'Gesendete Anfragen',
    connected: 'Vernetzt',
    replies: 'Gesamtantworten',
    positiveReplies: 'Positive Antworten',
    events: 'Events',
    total: 'Summe',
    metric: 'Kennzahl',
    value: 'Wert',
    crEvents: 'CR (Events/Erstellt)',
    csRate: 'C→S (Vernetzt/Gesendet)',
    prRate: 'P→R (Positive/Antworten)',
    crShort: 'CR'
  },
  alerts: {
    noDataLoaded: 'Keine Daten verfügbar. Bitte warten.',
    invalidDates: 'Bitte gültige Daten auswählen.',
    excelLibraryMissing: 'Excel-Bibliothek nicht geladen. Seite aktualisieren.',
    pdfLibraryMissing: 'PDF-Bibliothek nicht geladen. Seite aktualisieren.',
    noDataForDay: 'Keine Daten für den gewählten Tag.',
    exportExcelError: 'Fehler beim Excel-Export: ',
    exportPdfError: 'Fehler beim PDF-Export: ',
    dataNotLoaded: 'Daten noch nicht geladen. Bitte warten.',
    noDataToExport: 'Keine Daten zum Exportieren. Bitte warten.'
  },
  errors: {
    dataLoadTitle: 'Fehler beim Laden der Daten',
    dataLoadDescription: 'Bitte Konsole prüfen und Seite neu laden.',
    cacheFallbackTitle: '⚠️ Hinweis',
    cacheFallbackMessage: 'Serverdaten konnten nicht geladen werden. Zwischengespeicherte Daten werden genutzt.',
    cacheFallbackHint: 'Versuche die Seite neu zu laden oder den Aktualisierungsbutton zu nutzen.',
    dataLoadShort: '❌ Ladefehler'
  },
  pdf: {
    daySummary: 'Tagesübersicht',
    leadGenDashboard: 'Lead-Generierungs-Dashboard',
    date: 'Datum',
    exported: 'Exportiert',
    dateRange: 'Datumsbereich',
    activeTab: 'Aktiver Tab',
    summaryTotals: 'Summen',
    summaryByName: 'Zusammenfassung nach Namen',
    topCountries: 'Top-Länder',
    topGenerators: 'Top-Leads'
  }
};

export default de;

