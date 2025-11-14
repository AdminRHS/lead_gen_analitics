// Utility functions for Lead Generation Dashboard

export function parseDdMmYyyyToDate(str) {
  // expects DD/MM/YYYY
  const [dd, mm, yyyy] = (str || '').split('/').map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

export function toIsoDateInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export function validateData(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid data format: expected object');
  }
  
  if (!json.hasOwnProperty('data')) {
    throw new Error('Invalid data format: missing "data" property');
  }
  
  if (!Array.isArray(json.data)) {
    throw new Error('Invalid data format: "data" must be an array');
  }
  
  if (json.data.length === 0) {
    console.warn('Warning: data array is empty');
    return true; // Empty data is valid, just warn
  }
  
  // Validate first few records have expected structure
  const sampleSize = Math.min(5, json.data.length);
  const requiredFields = ['Date', 'Name', 'Country'];
  for (let i = 0; i < sampleSize; i++) {
    const record = json.data[i];
    if (!record || typeof record !== 'object') {
      throw new Error(`Invalid record at index ${i}: expected object`);
    }
    for (const field of requiredFields) {
      if (!record.hasOwnProperty(field)) {
        console.warn(`Warning: record at index ${i} missing field "${field}"`);
      }
    }
  }
  
  return true;
}

export function destroyIfExists(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    chartInstance.destroy();
  }
}

export function getIsoWeekInfo(dateObj) {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7, Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return { year, week: weekNo };
}

