import React, { useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BurnRatePoint } from '../types/matrix';
import { Language } from '../i18n/translations';
import { TrendingUp, AlertTriangle, Activity, Zap, Maximize2, Minimize2, Clock } from 'lucide-react';
import { calculate60mStats } from '../utils/finOpsHistory';

interface TokenBurnChartProps {
  history: BurnRatePoint[];
  currentBurnRate: number;
  language: Language;
  agentTag?: string;
  isRealWorkspace?: boolean;
}

type MetricUnit = 'usd' | 'tokens';
type TimeRange = '60m' | '30m' | '15m';

export const TokenBurnChart: React.FC<TokenBurnChartProps> = ({
  history,
  currentBurnRate,
  language,
  agentTag = 'ACTIVE AGENT',
  isRealWorkspace = false,
}) => {
  const isZh = language === 'zh';
  const containerRef = useRef<HTMLDivElement>(null);

  // User state
  const [unit, setUnit] = useState<MetricUnit>('usd');
  const [range, setRange] = useState<TimeRange>('60m');
  const [hoveredPoint, setHoveredPoint] = useState<BurnRatePoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Filter history based on time range
  const filteredData = useMemo(() => {
    if (!history || history.length === 0) return [];
    const minMinute = range === '15m' ? -15 : range === '30m' ? -30 : -60;
    return history.filter((d) => d.minute >= minMinute);
  }, [history, range]);

  const stats = useMemo(() => calculate60mStats(history), [history]);

  // Chart dimensions
  const width = 860;
  const height = isExpanded ? 180 : 80;
  const margin = { top: 18, right: 35, bottom: 26, left: 45 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // X scale: minute (e.g. -60 to 0)
  const minMinute = range === '15m' ? -15 : range === '30m' ? -30 : -60;
  const xScale = useMemo(() => {
    return d3.scaleLinear().domain([minMinute, 0]).range([0, innerWidth]);
  }, [minMinute, innerWidth]);

  // Y scale: burn rate ($/min or tokens/min)
  const yScale = useMemo(() => {
    if (filteredData.length === 0) return d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

    if (unit === 'usd') {
      const maxVal = d3.max(filteredData, (d) => d.burnRate) ?? 0.25;
      const upper = Math.max(0.1, maxVal * 1.25);
      return d3.scaleLinear().domain([0, upper]).range([innerHeight, 0]).nice();
    } else {
      const maxVal = d3.max(filteredData, (d) => d.tokensPerMin) ?? 8000;
      const upper = Math.max(3000, maxVal * 1.25);
      return d3.scaleLinear().domain([0, upper]).range([innerHeight, 0]).nice();
    }
  }, [filteredData, unit, innerHeight]);

  // Line & Area generators
  const lineGenerator = useMemo(() => {
    return d3
      .line<BurnRatePoint>()
      .x((d) => xScale(d.minute))
      .y((d) => yScale(unit === 'usd' ? d.burnRate : d.tokensPerMin))
      .curve(d3.curveMonotoneX);
  }, [xScale, yScale, unit]);

  const areaGenerator = useMemo(() => {
    return d3
      .area<BurnRatePoint>()
      .x((d) => xScale(d.minute))
      .y0(innerHeight)
      .y1((d) => yScale(unit === 'usd' ? d.burnRate : d.tokensPerMin))
      .curve(d3.curveMonotoneX);
  }, [xScale, yScale, innerHeight, unit]);

  const linePath = useMemo(() => {
    if (filteredData.length === 0) return '';
    return lineGenerator(filteredData) || '';
  }, [filteredData, lineGenerator]);

  const areaPath = useMemo(() => {
    if (filteredData.length === 0) return '';
    return areaGenerator(filteredData) || '';
  }, [filteredData, areaGenerator]);

  // Threshold alarm value ($0.25/min or ~8,300 tokens/min)
  const thresholdVal = unit === 'usd' ? 0.25 : 8333;
  const thresholdY = yScale(thresholdVal);
  const isAboveThreshold = stats.peakRate >= 0.25;

  // Peak Point
  const peakPoint = useMemo(() => {
    if (filteredData.length === 0) return null;
    return filteredData.reduce((prev, curr) => (curr.burnRate > prev.burnRate ? curr : prev), filteredData[0]);
  }, [filteredData]);

  // Current (latest) point
  const latestPoint = filteredData[filteredData.length - 1] ?? null;

  // X Ticks
  const xTicks = useMemo(() => {
    if (range === '15m') return [-15, -10, -5, 0];
    if (range === '30m') return [-30, -20, -10, 0];
    return [-60, -45, -30, -15, 0];
  }, [range]);

  // Y Ticks
  const yTicks = useMemo(() => {
    return yScale.ticks(isExpanded ? 4 : 2);
  }, [yScale, isExpanded]);

  // Bisector for interactive mouse hover
  const bisectMinute = useMemo(() => {
    return d3.bisector<BurnRatePoint, number>((d) => d.minute).center;
  }, []);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || filteredData.length === 0) return;
    const svgRect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    const innerX = mouseX - margin.left;

    if (innerX < 0 || innerX > innerWidth) {
      setHoveredPoint(null);
      setHoverPos(null);
      return;
    }

    const hoveredMinute = xScale.invert(innerX);
    const index = bisectMinute(filteredData, hoveredMinute);
    const point = filteredData[index];

    if (point) {
      setHoveredPoint(point);
      setHoverPos({
        x: xScale(point.minute) + margin.left,
        y: yScale(unit === 'usd' ? point.burnRate : point.tokensPerMin) + margin.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverPos(null);
  };

  // Glowing Neon-Cyan cyberpunk theme
  const themeColor = '#00f0ff';
  const themeGlow = 'rgba(0, 240, 255, 0.65)';
  const themeRgb = '0, 240, 255';

  return (
    <div
      ref={containerRef}
      className="bg-[#03080e]/95 border border-cyan-900/50 shadow-[0_0_20px_rgba(0,240,255,0.12)] rounded-md p-2.5 font-mono text-[10px] select-none transition-all duration-300"
    >
      {/* 1. Header Toolbar with Controls & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-1.5 border-b border-cyan-950/70">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider text-[10.5px] drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]">
            <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>{isZh ? '60分钟历史 Token 燃烧速率趋势' : '60-MIN HISTORICAL TOKEN BURN RATE'}</span>
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.25)]">
            D3.js ENGINE
          </span>
          <span className="text-cyan-600/80 text-[9px] hidden sm:inline">[{agentTag}]</span>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-1.5">
          {/* Time range selector */}
          <div className="flex items-center bg-[#050f18] rounded border border-cyan-950 p-0.5 text-[9px]">
            {(['60m', '30m', '15m'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  range === r
                    ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
                    : 'text-slate-400 hover:text-cyan-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Unit Toggle: USD/min vs Tokens/min */}
          <div className="flex items-center bg-[#050f18] rounded border border-cyan-950 p-0.5 text-[9px]">
            <button
              onClick={() => setUnit('usd')}
              className={`px-1.5 py-0.5 rounded transition-all ${
                unit === 'usd'
                  ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
                  : 'text-slate-400 hover:text-cyan-200'
              }`}
            >
              $/min
            </button>
            <button
              onClick={() => setUnit('tokens')}
              className={`px-1.5 py-0.5 rounded transition-all ${
                unit === 'tokens'
                  ? 'bg-teal-500/25 text-teal-300 font-bold border border-teal-400/50 shadow-[0_0_8px_rgba(20,184,166,0.35)]'
                  : 'text-slate-400 hover:text-teal-200'
              }`}
            >
              tok/min
            </button>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Chart' : 'Expand Chart'}
            className="p-1 rounded bg-[#050f18] border border-cyan-950 text-slate-400 hover:text-cyan-300 transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 2. Statistical Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-[9.5px]">
        {/* Current Burn Rate */}
        <div className="bg-[#050e18] border border-cyan-950/80 px-2 py-1 rounded flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shadow-[0_0_6px_#00f0ff]" />
            <span>{isZh ? '当前燃烧率' : 'Live Burn Rate'}:</span>
          </span>
          <span className="font-extrabold text-cyan-300 font-mono drop-shadow-[0_0_5px_rgba(0,240,255,0.6)]">
            ${currentBurnRate.toFixed(2)}/m
          </span>
        </div>

        {/* 60m Peak */}
        <div className="bg-[#070a10] border border-slate-800/80 px-2 py-1 rounded flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-rose-400" />
            <span>{isZh ? '60m 峰值' : '60m Peak'}:</span>
          </span>
          <span className="font-bold text-rose-300 font-mono">
            ${stats.peakRate.toFixed(2)}/m{' '}
            <span className="text-[8.5px] font-normal text-slate-500">
              ({stats.peakMinute === 0 ? 'NOW' : `${stats.peakMinute}m`})
            </span>
          </span>
        </div>

        {/* 60m Average */}
        <div className="bg-[#070a10] border border-slate-800/80 px-2 py-1 rounded flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-teal-400" />
            <span>{isZh ? '60m 均值' : '60m Avg'}:</span>
          </span>
          <span className="font-bold text-teal-300 font-mono">${stats.avgRate.toFixed(2)}/m</span>
        </div>

        {/* 60m Total Cost */}
        <div className="bg-[#070a10] border border-slate-800/80 px-2 py-1 rounded flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-purple-400" />
            <span>{isZh ? '60m 消耗' : '60m Cost'}:</span>
          </span>
          <span className="font-bold text-purple-300 font-mono">${stats.totalCost60m.toFixed(3)}</span>
        </div>
      </div>

      {/* 3. D3 SVG Visualization */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Neon Glow Filter */}
            <filter id="d3-burn-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={themeGlow} />
            </filter>

            {/* Gradient Area Fill */}
            <linearGradient id="d3-burn-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(${themeRgb})`} stopOpacity="0.35" />
              <stop offset="50%" stopColor={`rgb(${themeRgb})`} stopOpacity="0.12" />
              <stop offset="100%" stopColor={`rgb(${themeRgb})`} stopOpacity="0.0" />
            </linearGradient>

            {/* Threshold Line Gradient */}
            <linearGradient id="threshold-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Background Grid & Axes */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Grid Lines */}
            {yTicks.map((tickVal, i) => {
              const y = yScale(tickVal);
              return (
                <g key={`y-grid-${i}`} className="opacity-30">
                  <line
                    x1={0}
                    y1={y}
                    x2={innerWidth}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray="2 3"
                    strokeWidth={0.8}
                  />
                  <text
                    x={-8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {unit === 'usd' ? `$${tickVal.toFixed(2)}` : `${(tickVal / 1000).toFixed(1)}k`}
                  </text>
                </g>
              );
            })}

            {/* Vertical Time Grid Lines */}
            {xTicks.map((tickMin, i) => {
              const x = xScale(tickMin);
              return (
                <g key={`x-grid-${i}`} className="opacity-40">
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={innerHeight}
                    stroke="#1e293b"
                    strokeDasharray="2 3"
                    strokeWidth={0.8}
                  />
                  <text
                    x={x}
                    y={innerHeight + 15}
                    textAnchor="middle"
                    fill={tickMin === 0 ? '#00f0ff' : '#64748b'}
                    fontWeight={tickMin === 0 ? 'bold' : 'normal'}
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {tickMin === 0 ? 'NOW' : `T${tickMin}m`}
                  </text>
                </g>
              );
            })}

            {/* Threshold Line (if in visible range) */}
            {thresholdY >= 0 && thresholdY <= innerHeight && isExpanded && (
              <g className="transition-all duration-300">
                <line
                  x1={0}
                  y1={thresholdY}
                  x2={innerWidth}
                  y2={thresholdY}
                  stroke="url(#threshold-grad)"
                  strokeDasharray="4 3"
                  strokeWidth={1.2}
                />
                <rect
                  x={innerWidth - 110}
                  y={thresholdY - 12}
                  width={110}
                  height={12}
                  fill="#1c070c"
                  rx={2}
                  stroke="#be123c"
                  strokeWidth={0.6}
                />
                <text
                  x={innerWidth - 5}
                  y={thresholdY - 3}
                  textAnchor="end"
                  fill="#f43f5e"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ⚠ ALARM LIMIT ($0.25/m)
                </text>
              </g>
            )}

            {/* Area Fill */}
            <path d={areaPath} fill="url(#d3-burn-gradient)" />

            {/* Glowing D3 Curve with Neon Cyan */}
            <path
              d={linePath}
              fill="none"
              stroke={themeColor}
              strokeWidth={2}
              filter="url(#d3-burn-glow)"
              className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]"
            />

            {/* Peak Marker Badge */}
            {peakPoint && isExpanded && (
              <g
                transform={`translate(${xScale(peakPoint.minute)}, ${yScale(
                  unit === 'usd' ? peakPoint.burnRate : peakPoint.tokensPerMin
                )})`}
              >
                <circle r={3.5} fill="#fb7185" stroke="#ffe4e6" strokeWidth={1} />
                <line x1={0} y1={-4} x2={0} y2={-14} stroke="#fb7185" strokeWidth={0.8} />
                <rect x={-26} y={-24} width={52} height={11} rx={2} fill="#1c070c" stroke="#f43f5e" strokeWidth={0.6} />
                <text x={0} y={-16} textAnchor="middle" fill="#fda4af" fontSize="7" fontWeight="bold">
                  ▲ PEAK ${peakPoint.burnRate.toFixed(2)}
                </text>
              </g>
            )}

            {/* Current NOW Point Pulse Indicator */}
            {latestPoint && (
              <g
                transform={`translate(${xScale(latestPoint.minute)}, ${yScale(
                  unit === 'usd' ? latestPoint.burnRate : latestPoint.tokensPerMin
                )})`}
              >
                <circle r={8} fill={themeColor} opacity={0.35} className="animate-ping" />
                <circle r={4} fill={themeColor} stroke="#ffffff" strokeWidth={1.4} filter="url(#d3-burn-glow)" />
              </g>
            )}

            {/* Interactive Crosshair & Hover Tooltip Marker */}
            {hoveredPoint && hoverPos && (
              <g>
                {/* Vertical Laser Crosshair */}
                <line
                  x1={xScale(hoveredPoint.minute)}
                  y1={0}
                  x2={xScale(hoveredPoint.minute)}
                  y2={innerHeight}
                  stroke="#00f0ff"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.85}
                  filter="url(#d3-burn-glow)"
                />
                {/* Point Cursor Indicator */}
                <circle
                  cx={xScale(hoveredPoint.minute)}
                  cy={yScale(unit === 'usd' ? hoveredPoint.burnRate : hoveredPoint.tokensPerMin)}
                  r={5}
                  fill="#00f0ff"
                  stroke="#03080e"
                  strokeWidth={2}
                  filter="url(#d3-burn-glow)"
                />
              </g>
            )}
          </g>
        </svg>

        {/* Floating Cyberpunk Tooltip HUD Card */}
        {hoveredPoint && hoverPos && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: Math.max(70, Math.min(width - 70, hoverPos.x)),
              top: Math.max(30, hoverPos.y),
            }}
          >
            <div className="bg-[#030912]/95 border border-cyan-400/80 shadow-[0_0_20px_rgba(0,240,255,0.4)] rounded-md px-2.5 py-1.5 text-[9.5px] text-slate-200 backdrop-blur-md min-w-[130px]">
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-1 font-mono">
                <span className="text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.6)]">
                  {hoveredPoint.minute === 0 ? 'NOW' : `T${hoveredPoint.minute}m`}
                </span>
                <span className="text-[8.5px] text-cyan-200/70">
                  {new Date(hoveredPoint.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <div className="space-y-0.5 font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span>{isZh ? '燃烧率' : 'Rate'}:</span>
                  <span className="font-extrabold text-cyan-300 drop-shadow-[0_0_4px_rgba(0,240,255,0.5)]">
                    ${hoveredPoint.burnRate.toFixed(2)}/min
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[8.5px]">
                  <span>{isZh ? 'Token 速率' : 'Velocity'}:</span>
                  <span className="text-teal-300 font-semibold">
                    ~{(hoveredPoint.tokensPerMin / 1000).toFixed(1)}k tok/min
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[8.5px]">
                  <span>{isZh ? '累计至此时' : 'Cumul. Cost'}:</span>
                  <span className="text-purple-300 font-semibold">
                    ${hoveredPoint.costCumulative.toFixed(3)}
                  </span>
                </div>
                {hoveredPoint.eventTag && (
                  <div className="pt-0.5 mt-0.5 border-t border-cyan-950 flex justify-between items-center">
                    <span className="text-[8px] text-slate-400">{isZh ? '事件' : 'Event'}:</span>
                    <span
                      className={`text-[8px] font-bold px-1 rounded ${
                        hoveredPoint.eventTag === 'PEAK'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : hoveredPoint.eventTag === 'TOOL_USE'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      [{hoveredPoint.eventTag}]
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Footer Info & Warning Status */}
      <div className="mt-1 flex flex-wrap items-center justify-between text-[8.5px] text-slate-500 pt-1 border-t border-cyan-950">
        <div className="flex items-center gap-2">
          <span>{isZh ? '遥测窗口: 实时向前滑移 60 分钟' : 'Window: Rolling 60-Minute Real-Time Horizon'}</span>
          {isAboveThreshold && (
            <span className="flex items-center gap-1 text-rose-400 font-semibold animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{isZh ? '区间内存在高费率峰值' : 'High-rate surge detected in window'}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-400 shadow-[0_0_6px_#00f0ff] inline-block" />
            <span className="text-cyan-300/80">{isZh ? '燃烧轨迹' : 'Burn Trajectory'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-rose-500 stroke-dasharray inline-block" />
            <span>{isZh ? '警报阈值 ($0.25)' : 'Alarm Threshold ($0.25)'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
