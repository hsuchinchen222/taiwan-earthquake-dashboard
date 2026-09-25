import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  GraphicComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  PieChart,
  ScatterChart,
  GraphicComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export default function Chart({ option, onClick, label, className = '' }) {
  const chartRef = useRef(null);
  const clickRef = useRef(onClick);

  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chart.setOption(option, true);
    const handleClick = (params) => {
      chart.dispatchAction({ type: 'hideTip' });
      clickRef.current?.(params);
    };
    chart.on('click', handleClick);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartRef.current);
    return () => {
      observer.disconnect();
      chart.off('click', handleClick);
      chart.dispose();
    };
  }, [option]);

  return <div className={'chart-canvas ' + className} ref={chartRef} role="img" aria-label={label} />;
}
