// Data aggregation functions for Lead Generation Dashboard

import { parseDdMmYyyyToDate, getIsoWeekInfo } from './utils.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
      byName[name] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    byName[name].Created += Number(row["Created"] || 0);
    byName[name].SentRequests += Number(row["Sent Requests"] || 0);
    byName[name].Connected += Number(row["Connected"] || 0);
    byName[name].Replies += Number(row["Total replies"] || 0);
    byName[name].PositiveReplies += Number(row["Positive Replies"] || 0);
    byName[name].Events += Number(row["Events Created"] || 0);
  }
  const names = Object.keys(byName);
  return {
    names,
    created: names.map(n => byName[n].Created),
    sent: names.map(n => byName[n].SentRequests),
    connected: names.map(n => byName[n].Connected),
    replies: names.map(n => byName[n].Replies),
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
        events: 0,
        minDate: null,
        eventWeightedDays: 0,
        eventsForAvg: 0
      };
    }
    const entry = bySource[source];
    const dateObj = parseDdMmYyyyToDate(row.Date);
    if (dateObj instanceof Date && !isNaN(dateObj.valueOf())) {
      if (!entry.minDate || dateObj < entry.minDate) {
        entry.minDate = dateObj;
      }
    }

    const createdVal = Number(row['Created'] || 0);
    const sentVal = Number(row['Sent Requests'] || 0);
    const connectedVal = Number(row['Connected'] || 0);
    const repliesVal = Number(row['Total replies'] || 0);
    const positiveVal = Number(row['Positive Replies'] || 0);
    const eventsVal = Number(row['Events Created'] || 0);

    entry.created += createdVal;
    entry.sentRequests += sentVal;
    entry.connected += connectedVal;
    entry.totalReplies += repliesVal;
    entry.positiveReplies += positiveVal;
    entry.events += eventsVal;

    if (eventsVal > 0 && entry.minDate && dateObj instanceof Date && !isNaN(dateObj.valueOf())) {
      const diffDays = Math.max(0, (dateObj - entry.minDate) / MS_PER_DAY);
      entry.eventWeightedDays += diffDays * eventsVal;
      entry.eventsForAvg += eventsVal;
    }
  }
  
  const sources = Object.keys(bySource);
  return {
    sources,
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
    }),
    avgDaysToEvent: sources.map(s => {
      const entry = bySource[s];
      return entry.eventsForAvg > 0 ? entry.eventWeightedDays / entry.eventsForAvg : null;
    })
  };
}

export function buildFunnelSummary(filteredRows = []) {
  const totals = {
    Created: 0,
    SentRequests: 0,
    Connected: 0,
    Replies: 0,
    PositiveReplies: 0,
    Events: 0
  };

  for (const row of filteredRows) {
    totals.Created += Number(row['Created'] || 0);
    totals.SentRequests += Number(row['Sent Requests'] || 0);
    totals.Connected += Number(row['Connected'] || 0);
    totals.Replies += Number(row['Total replies'] || 0);
    totals.PositiveReplies += Number(row['Positive Replies'] || 0);
    totals.Events += Number(row['Events Created'] || 0);
  }

  return totals;
}

export function buildLeadGeneratorQuality(filteredRows = []) {
  if (!filteredRows || filteredRows.length === 0) {
    return { rows: [], weeksInRange: 0 };
  }

  const datedRows = filteredRows
    .map((row) => ({ row, date: parseDdMmYyyyToDate(row.Date) }))
    .filter(({ date }) => date instanceof Date && !isNaN(date.valueOf()))
    .sort((a, b) => a.date - b.date);

  if (datedRows.length === 0) {
    return { rows: [], weeksInRange: 0 };
  }

  const minDate = datedRows[0].date;
  const maxDate = datedRows[datedRows.length - 1].date;
  const totalDays = Math.max(1, Math.round((maxDate - minDate) / MS_PER_DAY) + 1);
  const weeksInRange = totalDays / 7;

  const byName = {};

  datedRows.forEach(({ row, date }) => {
    const name = row.Name || 'Unknown';
    if (!byName[name]) {
      byName[name] = {
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0,
        firstActivity: date,
        replyLagWeighted: 0,
        totalRepliesForLag: 0
      };
    }
    const stats = byName[name];
    if (!stats.firstActivity || date < stats.firstActivity) {
      stats.firstActivity = date;
    }

    stats.Created += Number(row['Created'] || 0);
    stats.SentRequests += Number(row['Sent Requests'] || 0);
    stats.Connected += Number(row['Connected'] || 0);
    const replies = Number(row['Total replies'] || 0);
    stats.Replies += replies;
    stats.PositiveReplies += Number(row['Positive Replies'] || 0);
    stats.Events += Number(row['Events Created'] || 0);

    if (replies > 0 && stats.firstActivity) {
      const lagDays = Math.max(0, (date - stats.firstActivity) / MS_PER_DAY);
      stats.replyLagWeighted += lagDays * replies;
      stats.totalRepliesForLag += replies;
    }
  });

  const rows = Object.keys(byName).map((name) => {
    const stats = byName[name];
    const avgResponseTimeDays =
      stats.totalRepliesForLag > 0 ? stats.replyLagWeighted / stats.totalRepliesForLag : null;
    const positiveRate = stats.SentRequests > 0 ? stats.PositiveReplies / stats.SentRequests : 0;
    const createdToPositive = stats.Created > 0 ? stats.PositiveReplies / stats.Created : 0;
    const positiveToEvents = stats.PositiveReplies > 0 ? stats.Events / stats.PositiveReplies : 0;
    const eventsPerWeek = weeksInRange > 0 ? stats.Events / weeksInRange : stats.Events;

    return {
      name,
      created: stats.Created,
      sent: stats.SentRequests,
      connected: stats.Connected,
      replies: stats.Replies,
      positive: stats.PositiveReplies,
      events: stats.Events,
      avgResponseTimeDays,
      positiveRate,
      createdToPositive,
      positiveToEvents,
      eventsPerWeek
    };
  });

  return { rows, weeksInRange };
}

export function buildDailySnapshots(filteredRows = []) {
  const byDate = {};

  for (const row of filteredRows) {
    const dateObj = parseDdMmYyyyToDate(row.Date);
    if (!(dateObj instanceof Date) || isNaN(dateObj.valueOf())) continue;
    const isoDate = dateObj.toISOString().slice(0, 10);
    if (!byDate[isoDate]) {
      byDate[isoDate] = {
        date: dateObj,
        Created: 0,
        SentRequests: 0,
        Connected: 0,
        Replies: 0,
        PositiveReplies: 0,
        Events: 0
      };
    }
    const stats = byDate[isoDate];
    stats.Created += Number(row['Created'] || 0);
    stats.SentRequests += Number(row['Sent Requests'] || 0);
    stats.Connected += Number(row['Connected'] || 0);
    stats.Replies += Number(row['Total replies'] || 0);
    stats.PositiveReplies += Number(row['Positive Replies'] || 0);
    stats.Events += Number(row['Events Created'] || 0);
  }

  const keys = Object.keys(byDate).sort();
  const rows = keys.map((iso) => {
    const stats = byDate[iso];
    const conversionRate = stats.Created > 0 ? (stats.Events / stats.Created) * 100 : 0;
    return {
      isoDate: iso,
      date: stats.date,
      created: stats.Created,
      sent: stats.SentRequests,
      connected: stats.Connected,
      replies: stats.Replies,
      positive: stats.PositiveReplies,
      events: stats.Events,
      conversionRate,
      deltaFromPrev: null
    };
  });

  rows.forEach((row, idx) => {
    if (idx === 0) {
      row.deltaFromPrev = null;
      return;
    }
    const prev = rows[idx - 1].conversionRate;
    row.deltaFromPrev = prev !== undefined && prev !== null ? row.conversionRate - prev : null;
  });

  return { rows };
}

export function buildLeadAgingBuckets(filteredRows = []) {
  const stageConfig = [
    { key: 'SentRequests', source: 'Sent Requests' },
    { key: 'Connected', source: 'Connected' },
    { key: 'Replies', source: 'Total replies' },
    { key: 'PositiveReplies', source: 'Positive Replies' },
    { key: 'Events', source: 'Events Created' }
  ];

  const buckets = [
    { key: 'bucket0to3', min: 0, max: 3 },
    { key: 'bucket4to7', min: 4, max: 7 },
    { key: 'bucket8plus', min: 8, max: Infinity }
  ];

  const datedRows = filteredRows
    .map((row) => ({ row, date: parseDdMmYyyyToDate(row.Date) }))
    .filter(({ date }) => date instanceof Date && !isNaN(date.valueOf()))
    .sort((a, b) => a.date - b.date);

  const maxDate = datedRows.length ? datedRows[datedRows.length - 1].date : new Date();

  const totals = {};
  stageConfig.forEach(({ key }) => {
    totals[key] = buckets.reduce((acc, bucket) => {
      acc[bucket.key] = 0;
      return acc;
    }, {});
  });

  datedRows.forEach(({ row, date }) => {
    const ageDays = Math.max(0, Math.round((maxDate - date) / MS_PER_DAY));
    const bucket = buckets.find((b) => ageDays >= b.min && ageDays <= b.max) || buckets[buckets.length - 1];

    stageConfig.forEach(({ key, source }) => {
      const value = Number(row[source] || row[key] || 0);
      if (value > 0) {
        totals[key][bucket.key] += value;
      }
    });
  });

  const rows = stageConfig.map(({ key }) => {
    const counts = totals[key];
    const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
    return {
      stageKey: key,
      counts,
      total
    };
  });

  return { buckets, rows };
}

export function buildTimingStats(filteredRows = []) {
  const datedRows = filteredRows
    .map((row) => ({ row, date: parseDdMmYyyyToDate(row.Date) }))
    .filter(({ date }) => date instanceof Date && !isNaN(date.valueOf()))
    .sort((a, b) => a.date - b.date);

  if (datedRows.length === 0) {
    return { steps: [] };
  }

  const stepConfigs = [
    {
      key: 'createdToSent',
      labelKey: 'Created → Sent',
      fromField: 'Created',
      toField: 'Sent Requests'
    },
    {
      key: 'sentToConnected',
      labelKey: 'Sent → Connected',
      fromField: 'Sent Requests',
      toField: 'Connected'
    },
    {
      key: 'connectedToPositive',
      labelKey: 'Connected → Positive',
      fromField: 'Connected',
      toField: 'Positive Replies'
    },
    {
      key: 'positiveToEvent',
      labelKey: 'Positive → Event',
      fromField: 'Positive Replies',
      toField: 'Events Created'
    }
  ];

  const steps = stepConfigs.map((config) => {
    const intervals = [];
    let cumulativeFrom = 0;
    let cumulativeTo = 0;
    const fromEvents = [];
    const toEvents = [];

    for (let i = 0; i < datedRows.length; i++) {
      const current = datedRows[i];
      const fromValue = Number(current.row[config.fromField] || 0);
      const toValue = Number(current.row[config.toField] || 0);
      const prevCumulativeFrom = cumulativeFrom;
      const prevCumulativeTo = cumulativeTo;

      cumulativeFrom += fromValue;
      cumulativeTo += toValue;

      const newFrom = cumulativeFrom - prevCumulativeFrom;
      const newTo = cumulativeTo - prevCumulativeTo;

      if (newFrom > 0) {
        for (let k = 0; k < newFrom; k++) {
          fromEvents.push({ date: current.date, index: prevCumulativeFrom + k });
        }
      }

      if (newTo > 0) {
        for (let k = 0; k < newTo; k++) {
          toEvents.push({ date: current.date, index: prevCumulativeTo + k });
        }
      }
    }

    if (fromEvents.length === 0 || toEvents.length === 0) {
      return {
        key: config.key,
        labelKey: config.labelKey,
        median: null,
        average: null,
        fastest: null,
        slowest: null,
        percentile90: null
      };
    }

    for (let i = 0; i < Math.min(fromEvents.length, toEvents.length); i++) {
      const fromEvent = fromEvents[i];
      let toEvent = toEvents[i];
      
      let j = i;
      while (j < toEvents.length && toEvents[j].date <= fromEvent.date) {
        j++;
      }
      if (j < toEvents.length) {
        toEvent = toEvents[j];
      }

      const daysDiff = Math.max(0, Math.round((toEvent.date - fromEvent.date) / MS_PER_DAY));
      if (daysDiff >= 0 && daysDiff <= 365) {
        intervals.push(daysDiff);
      }
    }

    if (intervals.length === 0) {
      return {
        key: config.key,
        labelKey: config.labelKey,
        median: null,
        average: null,
        fastest: null,
        slowest: null,
        percentile90: null
      };
    }

    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const average = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];
    const percentile90Index = Math.floor(sorted.length * 0.9);
    const percentile90 = sorted[percentile90Index];

    return {
      key: config.key,
      labelKey: config.labelKey,
      median,
      average,
      fastest,
      slowest,
      percentile90
    };
  });

  return { steps };
}

