export const LANGUAGE_STORAGE_KEY = 'leadGenDashboardLang';
export const THEME_STORAGE_KEY = 'leadGenDashboardTheme';

export const supportedLanguages = ['en', 'uk', 'ru', 'de'];
export const languageDisplayNames = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  de: 'Deutsch'
};

export const DAY_SUMMARY_METRICS = [
  { key: 'Created', labelKey: 'table.created' },
  { key: 'SentRequests', labelKey: 'table.sentRequests' },
  { key: 'Connected', labelKey: 'table.connected' },
  { key: 'PositiveReplies', labelKey: 'table.positiveReplies' },
  { key: 'Events', labelKey: 'table.events' }
];

export const metricTranslationMap = {
  Created: 'table.created',
  'Sent Requests': 'table.sentRequests',
  SentRequests: 'table.sentRequests',
  Connected: 'table.connected',
  Replies: 'table.replies',
  'Total replies': 'table.replies',
  'Total Replies': 'table.replies',
  'Positive Replies': 'table.positiveReplies',
  PositiveReplies: 'table.positiveReplies',
  Events: 'table.events',
  'Events Created': 'table.events',
  'Conversion Rate (%)': 'charts.labels.conversionRatePercent'
};
