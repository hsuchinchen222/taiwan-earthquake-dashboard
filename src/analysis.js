import Papa from 'papaparse';

export const DATA_FILE = '/data/taiwan_major_felt_earthquakes_2024-09-25_to_2026-09-25.csv';
const DATA_WINDOW_MATCH = /(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})/.exec(DATA_FILE);
const formatDate = (date) => date.replaceAll('-', '/');
export const DATA_WINDOW = DATA_WINDOW_MATCH
  ? { start: formatDate(DATA_WINDOW_MATCH[1]), end: formatDate(DATA_WINDOW_MATCH[2]) }
  : null;
export const REGION_LABELS = [
  '花蓮－臺東／東部帶',
  '嘉義－臺南帶',
  '宜蘭／東北部',
  '其他／孤立事件',
];

const REQUIRED_COLUMNS = [
  '報告編號',
  '發震時間_TST',
  '規模_ML',
  '最大震度',
  '最大震度序位_分析用',
  '緯度',
  '經度',
  '深度_km',
  '震央區域',
  'source_url',
];

function parseNumber(value, label, id) {
  const number = Number(String(value ?? '').trim());
  if (!Number.isFinite(number)) {
    throw new Error('事件 ' + id + ' 的「' + label + '」不是有效數字。');
  }
  return number;
}

function parseTimestamp(value, id) {
  const timestamp = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(timestamp);
  if (!match) throw new Error('事件 ' + id + ' 的發震時間格式不正確。');
  return {
    raw: timestamp,
    year: Number(match[1]),
    monthNumber: Number(match[2]),
    day: Number(match[3]),
    monthKey: match[1] + '-' + match[2],
    monthLabel: match[1] + '/' + match[2],
  };
}

export async function loadEarthquakes() {
  const response = await fetch(DATA_FILE, { cache: 'no-store' });
  if (!response.ok) throw new Error('CSV 讀取失敗（HTTP ' + response.status + '）。');
  const csvText = await response.text();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });
  if (parsed.errors.length) {
    throw new Error('CSV 格式錯誤：' + parsed.errors[0].message);
  }
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error('CSV 缺少必要欄位：' + missing.join('、'));

  const seenIds = new Set();
  const events = parsed.data.map((row) => {
    const id = String(row['報告編號'] ?? '').trim();
    if (!id) throw new Error('CSV 有一筆事件缺少報告編號。');
    if (seenIds.has(id)) throw new Error('CSV 報告編號重複：' + id);
    seenIds.add(id);
    const time = parseTimestamp(row['發震時間_TST'], id);
    const intensity = String(row['最大震度'] ?? '').trim();
    if (!intensity) throw new Error('事件 ' + id + ' 缺少最大震度。');
    const sourceUrl = String(row['source_url'] ?? '').trim();
    if (sourceUrl && !/^https:\/\/scweb\.cwa\.gov\.tw\//.test(sourceUrl)) {
      throw new Error('事件 ' + id + ' 的來源網址不是中央氣象署網址。');
    }
    return {
      id,
      timestamp: time.raw,
      year: time.year,
      monthNumber: time.monthNumber,
      monthKey: time.monthKey,
      monthLabel: time.monthLabel,
      magnitude: parseNumber(row['規模_ML'], '規模_ML', id),
      intensity,
      intensityRank: parseNumber(row['最大震度序位_分析用'], '最大震度序位_分析用', id),
      latitude: parseNumber(row['緯度'], '緯度', id),
      longitude: parseNumber(row['經度'], '經度', id),
      depth: parseNumber(row['深度_km'], '深度_km', id),
      area: String(row['震央區域'] ?? '').trim(),
      sourceUrl,
    };
  });
  if (!events.length) throw new Error('CSV 沒有可用的地震事件。');
  return assignSpatialGroups(events, 50);
}

function distanceKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = radians(b.longitude - a.longitude);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function groupLabel(group) {
  if (group.length < 2) return '其他／孤立事件';
  const latitude = group.reduce((sum, event) => sum + event.latitude, 0) / group.length;
  const longitude = group.reduce((sum, event) => sum + event.longitude, 0) / group.length;
  if (latitude >= 24.4 && longitude >= 121.2) return '宜蘭／東北部';
  if (longitude >= 121.2) return '花蓮－臺東／東部帶';
  if (longitude < 121.2) return '嘉義－臺南帶';
  return '其他／孤立事件';
}

export function assignSpatialGroups(events, distanceThresholdKm = 50) {
  const parents = events.map((_, index) => index);
  const find = (index) => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < events.length; left += 1) {
    for (let right = left + 1; right < events.length; right += 1) {
      if (distanceKm(events[left], events[right]) <= distanceThresholdKm) union(left, right);
    }
  }
  const groups = new Map();
  events.forEach((event, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(event);
  });
  const labels = new Map();
  groups.forEach((group, root) => labels.set(root, groupLabel(group)));
  return events.map((event, index) => ({ ...event, regionGroup: labels.get(find(index)) }));
}

function monthRange(events) {
  const keys = events.map((event) => event.monthKey).sort();
  if (!keys.length) return [];
  const windowStart = DATA_WINDOW ? DATA_WINDOW.start.slice(0, 7).replace('/', '-') : keys[0];
  const windowEnd = DATA_WINDOW ? DATA_WINDOW.end.slice(0, 7).replace('/', '-') : keys[keys.length - 1];
  const firstMonth = windowStart < keys[0] ? windowStart : keys[0];
  const lastMonth = windowEnd > keys[keys.length - 1] ? windowEnd : keys[keys.length - 1];
  const [startYear, startMonth] = firstMonth.split('-').map(Number);
  const [endYear, endMonth] = lastMonth.split('-').map(Number);
  const result = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push({
      key: String(year) + '-' + String(month).padStart(2, '0'),
      label: String(year) + '/' + String(month).padStart(2, '0'),
    });
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return result;
}

export function pearsonCorrelation(xValues, yValues) {
  if (xValues.length < 3 || xValues.length !== yValues.length) return null;
  const meanX = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  let numerator = 0;
  let squareX = 0;
  let squareY = 0;
  xValues.forEach((x, index) => {
    const dx = x - meanX;
    const dy = yValues[index] - meanY;
    numerator += dx * dy;
    squareX += dx * dx;
    squareY += dy * dy;
  });
  const denominator = Math.sqrt(squareX * squareY);
  return denominator ? numerator / denominator : null;
}

function averageRanks(values) {
  const sorted = values.map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = Array(values.length);
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const averageRank = ((start + 1) + end) / 2;
    for (let index = start; index < end; index += 1) ranks[sorted[index].index] = averageRank;
    start = end;
  }
  return ranks;
}

export function spearmanCorrelation(xValues, yValues) {
  if (xValues.length < 3 || xValues.length !== yValues.length) return null;
  return pearsonCorrelation(averageRanks(xValues), averageRanks(yValues));
}

export function linearRegression(xValues, yValues) {
  if (xValues.length < 2 || xValues.length !== yValues.length) return null;
  const meanX = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  let numerator = 0;
  let denominator = 0;
  xValues.forEach((x, index) => {
    numerator += (x - meanX) * (yValues[index] - meanY);
    denominator += (x - meanX) ** 2;
  });
  if (!denominator) return null;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}

function mostCommon(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
}

export function summarize(events, allEvents = events) {
  const monthlyCounts = new Map();
  events.forEach((event) => monthlyCounts.set(event.monthKey, (monthlyCounts.get(event.monthKey) ?? 0) + 1));
  const months = monthRange(allEvents).map((month) => ({
    ...month,
    count: monthlyCounts.get(month.key) ?? 0,
  }));
  const regions = [...new Set([...REGION_LABELS, ...events.map((event) => event.regionGroup)])]
    .map((label) => ({
      label,
      count: events.filter((event) => event.regionGroup === label).length,
    }))
    .filter((region) => region.count > 0)
    .sort((left, right) => right.count - left.count);
  const magnitudeValues = events.map((event) => event.magnitude);
  const depthValues = events.map((event) => event.depth);
  const intensityValues = events.map((event) => event.intensityRank);
  const peak = [...months].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))[0];
  const peakEvents = peak ? events.filter((event) => event.monthKey === peak.key) : [];
  const peakRegion = mostCommon(peakEvents, (event) => event.regionGroup);
  const maximumMagnitude = [...events].sort((left, right) => right.magnitude - left.magnitude)[0] ?? null;
  const maximumIntensity = [...events].sort((left, right) => right.intensityRank - left.intensityRank)[0] ?? null;
  const maximumDepth = [...events].sort((left, right) => right.depth - left.depth)[0] ?? null;
  const regression = linearRegression(magnitudeValues, depthValues);
  return {
    count: events.length,
    months,
    regions,
    peak: peak?.count > 0 ? peak : null,
    peakRegion,
    maximumMagnitude,
    maximumIntensity,
    maximumDepth,
    pearsonMagnitudeDepth: pearsonCorrelation(magnitudeValues, depthValues),
    spearmanMagnitudeIntensity: spearmanCorrelation(magnitudeValues, intensityValues),
    regression,
    dateStart: allEvents.map((event) => event.timestamp).sort()[0] ?? '',
    dateEnd: allEvents.map((event) => event.timestamp).sort().at(-1) ?? '',
  };
}

export function formatDateTime(timestamp) {
  return String(timestamp).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
}

export function formatCorrelation(value, prefix = '') {
  return value == null ? '樣本不足' : prefix + value.toFixed(3);
}
