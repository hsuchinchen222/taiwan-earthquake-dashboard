import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  IconActivity,
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconCalendarMonth,
  IconChartBar,
  IconChartDonut,
  IconChartScatter,
  IconDatabase,
  IconExternalLink,
  IconHome,
  IconInfoCircle,
  IconMapPin,
  IconRefresh,
  IconTrendingUp,
  IconWaveSine,
  IconX,
} from '@tabler/icons-react';
import { DATA_WINDOW, formatCorrelation, formatDateTime, loadEarthquakes, summarize } from './analysis.js';
import './styles.css';

const EChart = lazy(() => import('./Chart.jsx'));

const CHART_COLORS = ['#3984ec', '#2dbfae', '#f5a13b', '#a8b5c8'];
const REGION_COLOR = {
  '花蓮－臺東／東部帶': CHART_COLORS[0],
  '嘉義－臺南帶': CHART_COLORS[1],
  '宜蘭／東北部': CHART_COLORS[2],
  '其他／孤立事件': CHART_COLORS[3],
};

function Chart({ option, onClick, label, className = '' }) {
  return (
    <Suspense fallback={<div className={'chart-canvas chart-loading ' + className}>正在繪製圖表…</div>}>
      <EChart option={option} onClick={onClick} label={label} className={className} />
    </Suspense>
  );
}

function KpiCard({ icon: Icon, title, value, suffix, footnote, tone, testId }) {
  return (
    <article className={'kpi-card tone-' + tone} data-testid={testId}>
      <div className="kpi-icon" aria-hidden="true"><Icon size={25} stroke={1.9} /></div>
      <div className="kpi-copy">
        <p className="kpi-title">{title}</p>
        <p className="kpi-value">{value}<span className="kpi-suffix">{suffix}</span></p>
        <p className="kpi-footnote">{footnote}</p>
      </div>
    </article>
  );
}

function ChartPanel({ icon: Icon, title, helper, badge, children, className = '' }) {
  return (
    <section className={'panel chart-panel ' + className}>
      <header className="panel-heading">
        <div className="panel-title-wrap">
          <Icon className="panel-icon" size={23} stroke={1.9} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        {badge ? <div className="chart-badge">{badge}</div> : <p className="panel-helper">{helper}</p>}
      </header>
      {children}
    </section>
  );
}

function FilterPopover({ events, filters, setFilters, onClose }) {
  const regions = [...new Set(events.map((event) => event.regionGroup))];
  const months = [...new Map(events.map((event) => [event.monthKey, event.monthLabel])).entries()]
    .sort(([left], [right]) => left.localeCompare(right));
  return (
    <div className="filter-popover" role="dialog" aria-label="地震資料篩選">
      <div className="filter-popover-heading">
        <div>
          <strong>資料篩選</strong>
          <p>所有圖表會同步更新</p>
        </div>
        <button className="icon-button" type="button" aria-label="關閉篩選" onClick={onClose}>
          <IconX size={18} />
        </button>
      </div>
      <label className="filter-field">
        <span>區域群聚</span>
        <select value={filters.region} onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}>
          <option value="all">全部區域</option>
          {regions.map((region) => <option value={region} key={region}>{region}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>月份</span>
        <select value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}>
          <option value="all">全部月份</option>
          {months.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>最低規模</span>
        <select value={filters.minMagnitude} onChange={(event) => setFilters((current) => ({ ...current, minMagnitude: Number(event.target.value) }))}>
          <option value="0">不限規模</option>
          <option value="4">M4.0 以上</option>
          <option value="5">M5.0 以上</option>
          <option value="6">M6.0 以上</option>
        </select>
      </label>
      <button className="filter-reset" type="button" onClick={() => setFilters({ region: 'all', month: 'all', minMagnitude: 0 })}>
        <IconRefresh size={16} /> 清除所有篩選
      </button>
    </div>
  );
}

function makeMonthOption(stats) {
  const months = stats.months;
  const maximum = Math.max(0, ...months.map((month) => month.count));
  const interval = Math.max(1, Math.ceil(months.length / 8));
  return {
    animationDuration: 250,
    grid: { left: 43, right: 12, top: 35, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#12345a',
      borderWidth: 0,
      textStyle: { color: '#fff', fontFamily: 'inherit', fontSize: 12 },
      formatter: (params) => {
        const point = params?.[0];
        return point ? point.name + '<br/><b>' + point.value + ' 筆</b>' : '';
      },
    },
    xAxis: {
      type: 'category',
      data: months.map((month) => month.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#c7d5e5' } },
      axisTick: { show: false },
      axisLabel: { color: '#5d6f84', interval: interval - 1, margin: 14, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.max(4, maximum + (maximum % 2)),
      minInterval: 1,
      splitNumber: 4,
      name: '事件數（筆）',
      nameTextStyle: { color: '#65778c', align: 'left', padding: [0, 0, 7, -31], fontSize: 11 },
      axisLabel: { color: '#5d6f84', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e6edf5' } },
    },
    series: [{
      name: '事件數',
      type: 'line',
      data: months.map((month) => ({ name: month.label, value: month.count, monthKey: month.key })),
      symbol: 'circle',
      symbolSize: 7,
      smooth: false,
      lineStyle: { color: CHART_COLORS[0], width: 2.2 },
      itemStyle: { color: CHART_COLORS[0], borderColor: '#fff', borderWidth: 1.5 },
      areaStyle: { color: 'rgba(57,132,236,0.08)' },
      emphasis: { scale: 1.5, focus: 'series' },
      markPoint: maximum > 0 ? {
        symbol: 'circle',
        symbolSize: 34,
        itemStyle: { color: '#e34d67' },
        label: { color: '#fff', fontSize: 10, formatter: (params) => '最高 ' + params.value + ' 筆' },
        data: [{ type: 'max', name: '樣本高峰' }],
      } : undefined,
    }],
  };
}

function makeRegionOption(stats) {
  return {
    animationDuration: 250,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#12345a',
      borderWidth: 0,
      textStyle: { color: '#fff', fontFamily: 'inherit', fontSize: 12 },
      formatter: (params) => params.name + '<br/><b>' + params.value + ' 筆（' + params.percent + '%）</b>',
    },
    color: CHART_COLORS,
    graphic: [{
      type: 'text',
      left: 'center',
      top: '35%',
      style: {
        text: String(stats.count) + '\n筆',
        textAlign: 'center',
        fill: '#17365b',
        font: '700 21px "Noto Sans TC", "Microsoft JhengHei", sans-serif',
        lineHeight: 25,
      },
      silent: true,
    }],
    series: [{
      name: '區域群聚',
      type: 'pie',
      radius: ['45%', '95%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 3 },
      label: { show: true, position: 'inside', color: '#fff', fontSize: 12, formatter: (params) => params.percent.toFixed(1) + '%' },
      labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
      data: stats.regions.map((region) => ({ name: region.label, value: region.count })),
    }],
  };
}

function makeScatterOption(events, stats) {
  if (!events.length) return { series: [] };
  const magnitudes = events.map((event) => event.magnitude);
  const depths = events.map((event) => event.depth);
  const minimumMagnitude = Math.floor(Math.min(...magnitudes));
  const maximumMagnitude = Math.ceil(Math.max(...magnitudes));
  const maximumDepth = Math.max(25, Math.ceil(Math.max(...depths) / 25) * 25);
  const trend = stats.regression;
  const trendData = trend ? [[
    { coord: [minimumMagnitude, Math.max(0, trend.slope * minimumMagnitude + trend.intercept)] },
    { coord: [maximumMagnitude, Math.max(0, trend.slope * maximumMagnitude + trend.intercept)] },
  ]] : [];
  return {
    animationDuration: 250,
    grid: { left: 44, right: 12, top: 22, bottom: 45 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#12345a',
      borderWidth: 0,
      textStyle: { color: '#fff', fontFamily: 'inherit', fontSize: 12 },
      formatter: (params) => {
        const event = params.data?.event;
        if (!event) return '';
        return '<b>' + event.id + '</b><br/>規模 M' + event.magnitude.toFixed(1)
          + '<br/>深度 ' + event.depth.toFixed(1) + ' km'
          + '<br/>最大震度 ' + event.intensity
          + '<br/>' + event.regionGroup;
      },
    },
    xAxis: {
      type: 'value',
      min: minimumMagnitude,
      max: Math.max(minimumMagnitude + 1, maximumMagnitude),
      name: '規模 ML',
      nameLocation: 'middle',
      nameGap: 29,
      nameTextStyle: { color: '#5d6f84', fontSize: 11 },
      axisLabel: { color: '#5d6f84', fontSize: 11 },
      axisLine: { lineStyle: { color: '#c7d5e5' } },
      splitLine: { lineStyle: { color: '#e6edf5' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: maximumDepth,
      interval: maximumDepth / 5,
      name: '深度（km）',
      nameTextStyle: { color: '#5d6f84', align: 'left', padding: [0, 0, 7, -30], fontSize: 11 },
      axisLabel: { color: '#5d6f84', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e6edf5' } },
    },
    series: [{
      name: '地震事件',
      type: 'scatter',
      data: events.map((event) => ({
        value: [event.magnitude, event.depth],
        event,
        itemStyle: { color: REGION_COLOR[event.regionGroup] ?? CHART_COLORS[0] },
      })),
      symbolSize: 9,
      emphasis: { scale: 1.7 },
      markLine: trend ? {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#8b9bb0', type: 'dashed', width: 1.4 },
        label: { show: false },
        data: trendData,
      } : undefined,
    }],
  };
}

function correlationDescription(value) {
  if (value == null) return '樣本不足，暫不計算';
  const strength = Math.abs(value) < 0.3 ? '弱' : Math.abs(value) < 0.5 ? '中度' : '較強';
  return (value >= 0 ? strength + '正相關' : strength + '負相關');
}

function DetailDialog({ event, onClose }) {
  useEffect(() => {
    const closeOnEscape = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  if (!event) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose(); }}>
      <section className="event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title">
        <header className="dialog-header">
          <div>
            <p className="eyebrow">地震事件明細</p>
            <h2 id="event-dialog-title">{event.id}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="關閉事件明細"><IconX size={20} /></button>
        </header>
        <p className="dialog-area">{event.regionGroup} · {event.area}</p>
        <dl className="event-facts">
          <div><dt>發震時間</dt><dd>{formatDateTime(event.timestamp)}</dd></div>
          <div><dt>規模</dt><dd>M{event.magnitude.toFixed(1)}</dd></div>
          <div><dt>最大震度</dt><dd>{event.intensity}</dd></div>
          <div><dt>深度</dt><dd>{event.depth.toFixed(1)} km</dd></div>
          <div><dt>位置</dt><dd>{event.latitude.toFixed(2)}°N, {event.longitude.toFixed(2)}°E</dd></div>
        </dl>
        {event.sourceUrl ? (
          <a className="source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">
            查看中央氣象署原始報告 <IconExternalLink size={17} />
          </a>
        ) : <p className="muted">CSV 未提供此事件的來源連結。</p>}
      </section>
    </div>
  );
}

function App() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ region: 'all', month: 'all', minMagnitude: 0 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    let active = true;
    loadEarthquakes()
      .then((data) => {
        if (!active) return;
        setEvents(data);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message || 'CSV 讀取失敗。');
        setStatus('error');
      });
    return () => { active = false; };
  }, []);

  const visibleEvents = useMemo(() => events.filter((event) => (
    (filters.region === 'all' || event.regionGroup === filters.region)
    && (filters.month === 'all' || event.monthKey === filters.month)
    && event.magnitude >= filters.minMagnitude
  )), [events, filters]);
  const stats = useMemo(() => summarize(visibleEvents, events), [visibleEvents, events]);
  const monthOption = useMemo(() => makeMonthOption(stats), [stats]);
  const regionOption = useMemo(() => makeRegionOption(stats), [stats]);
  const scatterOption = useMemo(() => makeScatterOption(visibleEvents, stats), [visibleEvents, stats]);

  const activeFilterCount = Number(filters.region !== 'all') + Number(filters.month !== 'all') + Number(filters.minMagnitude > 0);
  const dateStart = stats.dateStart ? formatDateTime(stats.dateStart).slice(0, 10).replaceAll('/', '/') : '—';
  const dateEnd = stats.dateEnd ? formatDateTime(stats.dateEnd).slice(0, 10).replaceAll('/', '/') : '—';
  const dataWindow = DATA_WINDOW ?? { start: dateStart, end: dateEnd };
  const leadingRegion = stats.regions[0];
  const correlationText = formatCorrelation(stats.pearsonMagnitudeDepth);
  const strongestMagnitude = stats.maximumMagnitude;
  const peakText = stats.peak?.label ?? '—';
  const peakEventsText = stats.peak ? stats.peak.count + ' 筆' : '0 筆';

  const handleMonthClick = (params) => {
    const monthKey = params?.data?.monthKey;
    if (!monthKey) return;
    setFilters((current) => ({ ...current, month: current.month === monthKey ? 'all' : monthKey }));
  };
  const handleRegionClick = (params) => {
    const region = params?.name;
    if (!region) return;
    setFilters((current) => ({ ...current, region: current.region === region ? 'all' : region }));
  };
  const handleScatterClick = (params) => {
    if (params?.data?.event) setSelectedEvent(params.data.event);
  };

  if (status === 'loading') {
    return <main className="loading-screen"><div className="loading-mark"><IconActivity size={26} /></div><p>正在讀取 CSV 地震樣本…</p></main>;
  }
  if (status === 'error') {
    return (
      <main className="load-error">
        <IconAlertTriangle size={30} />
        <h1>無法載入地震資料</h1>
        <p>{error}</p>
        <p>請確認 CSV 位於 <code>public/data/</code>，並使用本機開發伺服器開啟頁面。</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell" data-testid="dashboard">
      <header className="hero">
        <img className="hero-art" src="/assets/taiwan-city-banner.png" alt="" />
        <div className="hero-copy">
          <div className="hero-title-row">
            <IconWaveSine className="hero-wave" size={54} stroke={1.5} aria-hidden="true" />
            <h1>台灣地震觀測</h1>
          </div>
          <div className="hero-subtitle">
            <span>資料期間：{dataWindow.start} – {dataWindow.end}</span>
            <span className="subtitle-divider" aria-hidden="true">|</span>
            <span>主要有感地震分析樣本（{events.length} 筆）</span>
            <span className="sample-badge">非完整地震目錄</span>
          </div>
        </div>
        <div className="hero-actions">
          <button
            className={'filter-trigger' + (activeFilterCount ? ' is-active' : '')}
            type="button"
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <IconAdjustmentsHorizontal size={18} />
            篩選資料
            {activeFilterCount > 0 ? <span className="filter-count">{activeFilterCount}</span> : null}
          </button>
          <p>點選圖表可查看或篩選</p>
        </div>
        {filterOpen ? <FilterPopover events={events} filters={filters} setFilters={setFilters} onClose={() => setFilterOpen(false)} /> : null}
      </header>

      <section className="kpi-grid" aria-label="樣本摘要指標">
        <KpiCard icon={IconDatabase} title="近兩年樣本事件數" value={stats.count} suffix="筆" footnote={dataWindow.start + ' – ' + dataWindow.end} tone="blue" testId="kpi-events" />
        <KpiCard icon={IconActivity} title="最大規模" value={strongestMagnitude ? 'M' + strongestMagnitude.magnitude.toFixed(1) : '—'} suffix="" footnote={strongestMagnitude ? '發生於 ' + strongestMagnitude.monthLabel : '目前篩選沒有事件'} tone="rose" testId="kpi-magnitude" />
        <KpiCard icon={IconAlertTriangle} title="最大震度" value={stats.maximumIntensity?.intensity ?? '—'} suffix="" footnote="依 CSV 震度序位計算" tone="orange" testId="kpi-intensity" />
        <KpiCard icon={IconMapPin} title="最大群聚區域" value={leadingRegion?.label ?? '—'} suffix={leadingRegion ? '（' + leadingRegion.count + ' 筆）' : ''} footnote="座標相距約 50 公里內的連通群聚" tone="teal" testId="kpi-region" />
        <KpiCard icon={IconCalendarMonth} title="月份高峰" value={peakText} suffix={stats.peak ? '（' + stats.peak.count + ' 筆）' : ''} footnote="依目前篩選結果計算" tone="violet" testId="kpi-peak" />
      </section>

      {activeFilterCount > 0 ? (
        <div className="active-filters" data-testid="active-filters">
          <span>目前顯示 {stats.count} 筆</span>
          {filters.region !== 'all' ? <span className="filter-chip">{filters.region}</span> : null}
          {filters.month !== 'all' ? <span className="filter-chip">{filters.month.replace('-', '/')}</span> : null}
          {filters.minMagnitude > 0 ? <span className="filter-chip">M{filters.minMagnitude}.0 以上</span> : null}
          <button type="button" onClick={() => setFilters({ region: 'all', month: 'all', minMagnitude: 0 })}>清除</button>
        </div>
      ) : null}

      <section className="chart-grid" aria-label="地震資料圖表">
        <ChartPanel icon={IconChartBar} title="月份趨勢" helper="事件數（筆）· 點選月份篩選" className="trend-panel">
          {stats.count ? <Chart option={monthOption} onClick={handleMonthClick} label="依月份彙總的地震事件折線圖，可點選月份篩選" className="trend-chart" /> : <div className="empty-chart">目前篩選沒有事件</div>}
        </ChartPanel>

        <ChartPanel icon={IconChartDonut} title="震央區域分布" helper="事件數（筆）· 占比">
          {stats.count ? <Chart option={regionOption} onClick={handleRegionClick} label="地震空間群聚環形圖，可點選群聚篩選" className="region-chart" /> : <div className="empty-chart">目前篩選沒有事件</div>}
          <div className="region-legend" aria-label="區域群聚明細">
            {stats.regions.map((region, index) => {
              const share = stats.count ? (region.count / stats.count * 100).toFixed(1) : '0.0';
              const selected = filters.region === region.label;
              return (
                <button
                  key={region.label}
                  className={'legend-row' + (selected ? ' selected' : '')}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, region: current.region === region.label ? 'all' : region.label }))}
                  aria-pressed={selected}
                >
                  <span className="legend-swatch" style={{ backgroundColor: REGION_COLOR[region.label] ?? CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="legend-label">{region.label}</span>
                  <span className="legend-count">{region.count}</span>
                  <span className="legend-share">({share}%)</span>
                </button>
              );
            })}
            {stats.regions.length === 0 ? <p className="empty-legend">無群聚資料</p> : null}
          </div>
        </ChartPanel>

        <ChartPanel
          icon={IconChartScatter}
          title="規模 vs 深度"
          badge={<><strong>Pearson r = {correlationText}</strong><span>{correlationDescription(stats.pearsonMagnitudeDepth)}</span></>}
          className="scatter-panel"
        >
          {stats.count ? <Chart option={scatterOption} onClick={handleScatterClick} label="每筆地震的規模與深度散點圖；點選資料點查看事件明細" className="scatter-chart" /> : <div className="empty-chart">目前篩選沒有事件</div>}
          <p className="chart-footnote">點選任一資料點，查看事件與中央氣象署來源</p>
        </ChartPanel>
      </section>

      <section className="panel insights-panel" aria-labelledby="insights-title">
        <header className="insights-heading">
          <IconInfoCircle size={22} aria-hidden="true" />
          <h2 id="insights-title">5 個重要洞察</h2>
          <span>依目前顯示樣本計算</span>
        </header>
        <div className="insight-grid">
          <article className="insight-card insight-blue">
            <span className="insight-number">1</span>
            <div><h3>事件最多的空間群聚</h3><p>{leadingRegion ? leadingRegion.label + '，' + leadingRegion.count + ' 筆（' + (leadingRegion.count / Math.max(stats.count, 1) * 100).toFixed(1) + '%）' : '目前沒有群聚資料'}</p></div>
            <IconMapPin className="insight-icon" size={24} aria-hidden="true" />
          </article>
          <article className="insight-card insight-rose">
            <span className="insight-number">2</span>
            <div><h3>{stats.peak ? stats.peak.label + ' 為月份高峰' : '目前沒有月份高峰'}</h3><p>{stats.peak ? '共 ' + stats.peak.count + ' 筆' + (stats.peakRegion ? '，當月最多事件位於' + stats.peakRegion[0] : '') : '請調整篩選條件'}</p></div>
            <IconChartBar className="insight-icon" size={24} aria-hidden="true" />
          </article>
          <article className="insight-card insight-teal">
            <span className="insight-number">3</span>
            <div><h3>規模與深度</h3><p>Pearson r = {correlationText}，{correlationDescription(stats.pearsonMagnitudeDepth)}</p></div>
            <IconTrendingUp className="insight-icon" size={24} aria-hidden="true" />
          </article>
          <article className="insight-card insight-orange">
            <span className="insight-number">4</span>
            <div><h3>規模與最大震度</h3><p>Spearman ρ = {formatCorrelation(stats.spearmanMagnitudeIntensity)}，{correlationDescription(stats.spearmanMagnitudeIntensity)}</p></div>
            <IconHome className="insight-icon" size={24} aria-hidden="true" />
          </article>
          <article className="insight-card insight-violet">
            <span className="insight-number">5</span>
            <div><h3>最大規模事件的震度</h3><p>{strongestMagnitude ? 'M' + strongestMagnitude.magnitude.toFixed(1) + ' 事件的最大震度為 ' + strongestMagnitude.intensity + '；規模不等同體感' : '目前沒有事件'}</p></div>
            <IconWaveSine className="insight-icon" size={24} aria-hidden="true" />
          </article>
        </div>
        <div className="insight-note">
          <IconInfoCircle size={18} aria-hidden="true" />

        </div>
      </section>

      <p className="footer-caption">資料欄位含中央氣象署事件來源連結 · 空間群聚以 CSV 座標依 50 km 距離連通分組</p>
      <DetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
