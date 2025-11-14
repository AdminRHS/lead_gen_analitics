// Data aggregation functions for Lead Generation Dashboard

import { parseDdMmYyyyToDate, getIsoWeekInfo } from './utils.js';

export function buildAggregates(filteredRows) {
  const byDate = {};
  for (const row of filteredRows) {
    const dateKey = row.Date;
    if (!byDate[dateKey]) {
      byDate[dateKey] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        PositiveReplies: 0,
        Events: 0,
        Replies: 0
      };
    }
    byDate[dateKey].Created += Number(row["Created"] || 0);
    byDate[dateKey].SentRequests += Number(row["Sent Requests"] || 0);
    byDate[dateKey].Connected += Number(row["Connected"] || 0);
    byDate[dateKey].PositiveReplies += Number(row["Positive Replies"] || 0);
    byDate[dateKey].Events += Number(row["Events Created"] || 0);
    // Map Total replies → Replies series
    byDate[dateKey].Replies += Number(row["Total replies"] || 0);
  }
  const dates = Object.keys(byDate);
  return {
    dates,
    created: dates.map(d => byDate[d].Created),
    sent: dates.map(d => byDate[d].SentRequests),
    connected: dates.map(d => byDate[d].Connected),
    replies: dates.map(d => byDate[d].Replies),
    positive: dates.map(d => byDate[d].PositiveReplies),
    events: dates.map(d => byDate[d].Events)
  };
}

export function buildCountryAggregates(filteredRows) {
  const byCountry = {};
  for (const row of filteredRows) {
    const country = row.Country || 'Unknown';
    if (!byCountry[country]) {
      byCountry[country] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    byCountry[country].Created += Number(row["Created"] || 0);
    byCountry[country].SentRequests += Number(row["Sent Requests"] || 0);
    byCountry[country].Connected += Number(row["Connected"] || 0);
    byCountry[country].Replies += Number(row["Total replies"] || 0);
    byCountry[country].PositiveReplies += Number(row["Positive Replies"] || 0);
    byCountry[country].Events += Number(row["Events Created"] || 0);
  }
  const countries = Object.keys(byCountry);
  return {
    countries,
    created: countries.map(c => byCountry[c].Created),
    sent: countries.map(c => byCountry[c].SentRequests),
    connected: countries.map(c => byCountry[c].Connected),
    replies: countries.map(c => byCountry[c].Replies),
    positive: countries.map(c => byCountry[c].PositiveReplies),
    events: countries.map(c => byCountry[c].Events),
    conversionRates: countries.map(c => {
      const created = byCountry[c].Created;
      const events = byCountry[c].Events;
      return created > 0 ? (events / created) * 100 : 0;
    })
  };
}

export function buildWeeklyAggregates(filteredRows) {
  const byWeek = {};
  for (const row of filteredRows) {
    const dt = parseDdMmYyyyToDate(row.Date);
    if (!dt) continue;
    const { year, week } = getIsoWeekInfo(dt);
    const key = `${year}-W${String(week).padStart(2,'0')}`;
    if (!byWeek[key]) {
      byWeek[key] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    byWeek[key].Created += Number(row["Created"] || 0);
    byWeek[key].SentRequests += Number(row["Sent Requests"] || 0);
    byWeek[key].Connected += Number(row["Connected"] || 0);
    byWeek[key].Replies += Number(row["Total replies"] || 0);
    byWeek[key].PositiveReplies += Number(row["Positive Replies"] || 0);
    byWeek[key].Events += Number(row["Events Created"] || 0);
  }
  const keys = Object.keys(byWeek).sort((a,b) => {
    const [ay, aw] = a.split('-W').map(Number);
    const [by, bw] = b.split('-W').map(Number);
    if (ay !== by) return ay - by;
    return aw - bw;
  });
  return {
    weeks: keys,
    created: keys.map(k => byWeek[k].Created),
    sent: keys.map(k => byWeek[k].SentRequests),
    connected: keys.map(k => byWeek[k].Connected),
    replies: keys.map(k => byWeek[k].Replies),
    positive: keys.map(k => byWeek[k].PositiveReplies),
    events: keys.map(k => byWeek[k].Events)
  };
}

export function buildMonthlyAggregates(filteredRows) {
  const byMonth = {};
  for (const row of filteredRows) {
    const dt = parseDdMmYyyyToDate(row.Date);
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; // YYYY-MM
    if (!byMonth[key]) {
      byMonth[key] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    byMonth[key].Created += Number(row["Created"] || 0);
    byMonth[key].SentRequests += Number(row["Sent Requests"] || 0);
    byMonth[key].Connected += Number(row["Connected"] || 0);
    byMonth[key].Replies += Number(row["Total replies"] || 0);
    byMonth[key].PositiveReplies += Number(row["Positive Replies"] || 0);
    byMonth[key].Events += Number(row["Events Created"] || 0);
  }
  const keys = Object.keys(byMonth).sort();
  return {
    months: keys,
    created: keys.map(k => byMonth[k].Created),
    sent: keys.map(k => byMonth[k].SentRequests),
    connected: keys.map(k => byMonth[k].Connected),
    replies: keys.map(k => byMonth[k].Replies),
    positive: keys.map(k => byMonth[k].PositiveReplies),
    events: keys.map(k => byMonth[k].Events),
    conversionRates: keys.map(k => {
      const created = byMonth[k].Created;
      const events = byMonth[k].Events;
      return created > 0 ? (events / created) * 100 : 0;
    })
  };
}

export function buildLeaderboardAggregates(filteredRows) {
  // Aggregate by Name (lead generator) over the current filtered range
  const byName = {};
  for (const row of filteredRows) {
    const name = row.Name || 'Unknown';
    if (!byName[name]) {
      byName[name] = { Created: 0, SentRequests: 0, PositiveReplies: 0, Events: 0 };
    }
    byName[name].Created += Number(row["Created"] || 0);
    byName[name].SentRequests += Number(row["Sent Requests"] || 0);
    byName[name].PositiveReplies += Number(row["Positive Replies"] || 0);
    byName[name].Events += Number(row["Events Created"] || 0);
  }
  const names = Object.keys(byName);
  return {
    names,
    created: names.map(n => byName[n].Created),
    sent: names.map(n => byName[n].SentRequests),
    positive: names.map(n => byName[n].PositiveReplies),
    events: names.map(n => byName[n].Events),
    conversionRates: names.map(n => {
      const created = byName[n].Created;
      const events = byName[n].Events;
      return created > 0 ? (events / created) * 100 : 0;
    })
  };
}

export function buildSourceAggregates(filteredRows) {
  const bySource = {};
  for (const row of filteredRows) {
    const source = row.Source || 'Unknown';
    if (!bySource[source]) {
      bySource[source] = {
        created: 0,
        sentRequests: 0,
        connected: 0,
        totalReplies: 0,
        positiveReplies: 0,
        events: 0
      };
    }
    bySource[source].created += Number(row['Created'] || 0);
    bySource[source].sentRequests += Number(row['Sent Requests'] || 0);
    bySource[source].connected += Number(row['Connected'] || 0);
    bySource[source].totalReplies += Number(row['Total replies'] || 0);
    bySource[source].positiveReplies += Number(row['Positive Replies'] || 0);
    bySource[source].events += Number(row['Events Created'] || 0);
  }
  
  const sources = Object.keys(bySource);
  return {
    sources: sources,
    created: sources.map(s => bySource[s].created),
    sentRequests: sources.map(s => bySource[s].sentRequests),
    connected: sources.map(s => bySource[s].connected),
    totalReplies: sources.map(s => bySource[s].totalReplies),
    positiveReplies: sources.map(s => bySource[s].positiveReplies),
    events: sources.map(s => bySource[s].events),
    conversionRates: sources.map(s => {
      const created = bySource[s].created;
      const events = bySource[s].events;
      return created > 0 ? (events / created) * 100 : 0;
    })
  };
}

