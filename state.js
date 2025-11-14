// Shared state for Lead Generation Dashboard

export const chartRefs = {
  createdFound: null,
  sentConnected: null,
  connectedReplies: null,
  repliesPositive: null,
  positiveEvents: null,
  // Countries (new paired charts)
  countryCreatedFound: null,
  countrySentConnected: null,
  countryConnectedReplies: null,
  countryRepliesPositive: null,
  countryPositiveEvents: null,
  // Countries (legacy single charts, kept for safety)
  countryConnected: null,
  countryReplies: null,
  countryPositive: null,
  countryEvents: null,
  weekCreatedFound: null,
  weekSentConnected: null,
  weekConnectedReplies: null,
  weekRepliesPositive: null,
  weekPositiveEvents: null,
  monthCreatedFound: null,
  monthSentConnected: null,
  monthConnectedReplies: null,
  monthRepliesPositive: null,
  monthPositiveEvents: null,
  // Leaderboard chart refs
  lbCreated: null,
  lbSent: null,
  lbPositive: null,
  lbEvents: null,
  // Conversion rate chart refs
  monthConversionRate: null,
  countryConversionRate: null,
  lbConversionRate: null,
  // Country modal chart ref
  countryMonthlyPaired: null,
  // Lead modal chart ref
  leadMonthlyPaired: null,
  // Source comparison chart refs
  sourceConversionRate: null,
  sourceCreatedToSent: null,
  sourceSentToConnected: null,
  sourceConnectedToReplies: null,
  sourceRepliesToPositive: null,
  sourcePositiveToEvents: null
};

export let lastFilteredRows = [];
export let currentDayData = null;

