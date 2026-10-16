/** @license SPDX-License-Identifier: Apache-2.0 */
import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Box, Check, ChevronRight, CircleHelp, Crosshair, Expand, FileCode2, Focus, GitBranch, Layers3, Maximize2, Minimize2, MousePointer2, Network, Orbit, Pause, Play, Radio, RotateCcw, Search, ShieldAlert, Terminal, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { BlackBoxStage, MatrixMode, RealSystemStatus, WsConnectionState } from '../types/matrix';
import type { Language } from '../i18n/translations';
import { NODES, EDGES, matchesNode, nodeState, type Layout, type NodeId } from './topology/model';
import { TopologyScene, type SceneHandle } from './topology/TopologyScene';
import './topology/topology.css';

interface Props {
  language: Language;
  mode: MatrixMode;
  activeStage?: BlackBoxStage;
  isBlocked?: boolean;
  isRealWorkspace?: boolean;
  connectionState?: WsConnectionState;
  systemStatus?: RealSystemStatus | null;
  workspaceName?: string;
  onSelectStage?: (stage: BlackBoxStage) => void;
  onOpenDrillDown?: (stage: BlackBoxStage) => void;
  onTriggerTrace?: () => void;
  onTriggerDenial?: () => void;
  onTriggerHook?: () => void;
}
const icons = { prompt: Layers3, core: Box, hook: Network, gate: ShieldAlert, shell: Terminal, files: FileCode2, feedback: RotateCcw };

export const Agent3dArchitectureTopology: React.FC<Props> = ({ language, mode, activeStage, isBlocked = false, isRealWorkspace = false, connectionState = 'offline', systemStatus, workspaceName, onSelectStage, onOpenDrillDown, onTriggerTrace }) => {
  const zh = language === 'zh';
  const t = (a: string, b: string) => zh ? a : b;
  const index = zh ? 0 : 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle>(null);
  const [selected, setSelected] = useState<NodeId>('core');
  const [layout, setLayout] = useState<Layout>('layered');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(false);
  const [labels, setLabels] = useState(true);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [autoRotate, setAutoRotate] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [help, setHelp] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [renderStats, setRenderStats] = useState({ fps: 0, quality: 'auto' });
  const node = NODES.find(n => n.id === selected)!;
  const Icon = icons[selected];
  const state = nodeState(node, activeStage, isBlocked);
  const filtered = NODES.filter(n => matchesNode(n, query));
  const connections = EDGES.filter(e => e.from === selected || e.to === selected);
  const live = isRealWorkspace && connectionState === 'connected';
  const sourceLabel = live ? t('网关已连接', 'Gateway connected') : isRealWorkspace ? t('网关未连接', 'Gateway disconnected') : t('演示视图', 'Demo view');
  const sourceCode = live ? 'CONNECTED' : isRealWorkspace ? 'OFFLINE' : 'DEMO';
  const statusLabel = (s: string) => ({ active: t('最近观测阶段', 'Last observed stage'), blocked: t('等待审批', 'Awaiting approval'), waiting: t('执行挂起', 'On hold'), ready: t('架构节点', 'Architecture node') }[s] || s);
  const selectNode = (id: NodeId) => { setSelected(id); onSelectStage?.(NODES.find(n => n.id === id)!.stage); };

  useEffect(() => {
    if (!fullscreen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; rootRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
      if (event.key !== 'Tab') return;
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === rootRef.current)) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [fullscreen]);
  useEffect(() => { if (!exportMessage) return; const timer = window.setTimeout(() => setExportMessage(''), 3500); return () => window.clearTimeout(timer); }, [exportMessage]);

  const exportGraph = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), kind: 'architecture-map', workspace: workspaceName, layout, selectedNode: selected, source: live ? 'gateway' : isRealWorkspace ? 'offline' : 'demo', blocked: isBlocked, nodes: NODES.map(n => ({ id: n.id, stage: n.stage, label: n.label[index], state: nodeState(n, activeStage, isBlocked), position: n.positions[layout] })), edges: EDGES.map(e => ({ ...e, blocked: isBlocked && !!e.downstream })) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'agent-topology.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setExportMessage(t('拓扑已导出', 'Topology exported'));
  };

  return <div ref={rootRef} tabIndex={-1} className={`topology-console ${fullscreen ? 'topology-fullscreen' : ''}`} aria-label={t('Agent 运行拓扑', 'Agent runtime topology')}>
    <header className="topology-header">
      <div className="topology-heading"><div className="topology-brand"><Network size={20} /></div><div><div className="topology-eyebrow">AGENT MATRIX <span>/</span> OBSERVABILITY</div><h2>{t('运行拓扑', 'Runtime topology')}<span className="topology-version">3D</span></h2></div></div>
      <div className="topology-header-actions"><span className={`topology-source ${live ? 'is-live' : ''}`}><Radio size={12} />{sourceLabel}</span><button className="topology-button" onClick={exportGraph}><ArrowDownToLine size={14} />{t('导出', 'Export')}</button><button className="topology-icon-button" aria-label={t('操作指南', 'Interaction guide')} aria-expanded={help} onClick={() => setHelp(!help)}><CircleHelp size={16} /></button><button className="topology-icon-button" aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏', 'Fullscreen')} onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
    </header>
    <div className="topology-summary"><span><GitBranch size={13} /><b>{workspaceName || 'Agent workspace'}</b></span><span className="topology-summary-separator" /><span>{t('架构节点', 'NODES')} <b>07</b></span><span>{t('有向链路', 'EDGES')} <b>08</b></span><span className={isBlocked ? 'topology-text-amber' : 'topology-text-green'}><i className={`topology-dot ${isBlocked ? 'is-amber' : ''}`} />{isBlocked ? t('权限阻断 · 下游挂起', 'Permission blocked · downstream held') : (live ? t('未观测到阻断', 'No block observed') : t('逻辑调用路径', 'Logical call path'))}</span><span className="topology-summary-note">{t('架构映射 · 非基础设施自动发现', 'Architecture map · not infrastructure discovery')}</span></div>
    <div className="topology-workbench">
      <aside className="topology-sidebar" aria-label={t('节点目录', 'Node directory')}>
        <div className="topology-section-heading">{t('节点目录', 'EXPLORER')}<span>{filtered.length} / 7</span></div>
        <label className="topology-search"><Search size={14} /><input aria-label={t('搜索节点', 'Search nodes')} placeholder={t('搜索节点 / 类型…', 'Find node / type…')} value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label={t('清空搜索', 'Clear search')} onClick={() => setQuery('')}><X size={12} /></button>}</label>
        <div className="topology-node-list">{filtered.map(n => {
          const ItemIcon = icons[n.id]; const ns = nodeState(n, activeStage, isBlocked);
          return <button key={n.id} className={`topology-node-item ${selected === n.id ? 'is-selected' : ''}`} aria-pressed={selected === n.id} onClick={() => selectNode(n.id)} style={{ '--node-color': n.color } as React.CSSProperties}><span className="topology-node-icon"><ItemIcon size={16} /></span><span><b>{n.label[index]}</b><small>{n.code} <span>·</span> {n.category[index]}</small></span><i className={`topology-state-dot is-${ns}`} /></button>;
        })}{filtered.length === 0 && <div className="topology-empty">{t('没有匹配的节点', 'No matching nodes')}<button onClick={() => setQuery('')}>{t('清空筛选', 'Clear filter')}</button></div>}</div>
        <div className="topology-sidebar-bottom"><span className="topology-eyebrow">RUNTIME PROVIDER</span><b><Box size={14} />{mode === 'claude' ? 'Claude Code' : mode === 'codex' ? 'OpenAI Codex' : 'Hybrid runtime'}</b><p>{t('节点描述逻辑职责；执行状态来自当前工作区。', 'Nodes describe logical responsibilities. State follows the current workspace.')}</p></div>
      </aside>
      <section className="topology-viewport" aria-label={t('交互式三维拓扑', 'Interactive 3D topology')}>
        <div className="topology-scene-toolbar"><div className="topology-segment" aria-label={t('拓扑布局', 'Topology layout')}><button aria-pressed={layout === 'layered'} onClick={() => setLayout('layered')}><Layers3 size={13} />{t('分层架构', 'Layered')}</button><button aria-pressed={layout === 'orbit'} onClick={() => setLayout('orbit')}><Orbit size={13} />{t('环形视图', 'Orbit')}</button></div><span className="topology-scene-caption">{t('逻辑调用路径', 'LOGICAL CALL FLOW')}</span></div>
        <TopologyScene ref={sceneRef} language={language} layout={layout} selected={selected} activeStage={activeStage} blocked={isBlocked} query={query} focus={focus} labels={labels} paused={paused} autoRotate={autoRotate} onSelect={selectNode} onStats={setRenderStats} />
        <div className="topology-canvas-tools"><button className={`topology-icon-button ${focus ? 'is-on' : ''}`} aria-label={t('仅突出相邻节点', 'Highlight neighborhood')} aria-pressed={focus} onClick={() => setFocus(!focus)}><Focus size={16} /></button><button className="topology-icon-button" aria-label={t('聚焦所选节点', 'Focus selected node')} onClick={() => sceneRef.current?.focus(selected)}><Crosshair size={16} /></button><span /><button className="topology-icon-button" aria-label={t('放大', 'Zoom in')} onClick={() => sceneRef.current?.zoom(0.8)}><ZoomIn size={16} /></button><button className="topology-icon-button" aria-label={t('缩小', 'Zoom out')} onClick={() => sceneRef.current?.zoom(1.25)}><ZoomOut size={16} /></button><button className="topology-icon-button" aria-label={t('适应画布', 'Fit to view')} onClick={() => sceneRef.current?.reset()}><Expand size={16} /></button></div>
        {isBlocked && <div className="topology-block-alert" role="status"><ShieldAlert size={14} /><span>{t('权限闸门等待审批，下游执行路径已暂停。', 'Permission gate awaiting approval. Downstream flow is paused.')}</span><button onClick={() => selectNode('gate')}>{t('查看', 'Inspect')}<ChevronRight size={12} /></button></div>}
        <div className="topology-scene-bottom"><div className="topology-legend"><span><i style={{ background: '#64dcf0' }} />{t('调用方向', 'Call direction')}</span><span><i style={{ background: '#f6bd70' }} />{t('权限边界', 'Policy boundary')}</span><span className="topology-return-legend">↶ {t('反馈回路', 'Feedback loop')}</span></div><span className="topology-render-stat">{renderStats.fps ? `${renderStats.fps} FPS` : '— FPS'} <span>·</span> {renderStats.quality.toUpperCase()}</span></div>
      </section>
      <aside className="topology-inspector" aria-label={t('节点详情', 'Node inspector')}>
        <div className="topology-section-heading">{t('节点详情', 'INSPECTOR')}<span>{String(NODES.indexOf(node) + 1).padStart(2, '0')} / 07</span></div>
        <div className="topology-inspector-title"><span style={{ color: node.color, background: `${node.color}12`, borderColor: `${node.color}35` }}><Icon size={24} /></span><div><small>{node.code} / {node.category[index]}</small><h3>{node.label[index]}</h3></div></div>
        <div className={`topology-node-status is-${state}`}><i className={`topology-state-dot is-${state}`} />{statusLabel(state)}<span>{node.stage}</span></div>
        <p className="topology-description">{node.description[index]}</p>
        <div className="topology-inspector-section"><h4>{t('连接关系', 'CONNECTIONS')}<span>{connections.length}</span></h4>{connections.map(e => {
          const incoming = e.to === selected; const other = NODES.find(n => n.id === (incoming ? e.from : e.to))!;
          return <button key={e.id} className={`topology-connection ${isBlocked && e.downstream ? 'is-held' : ''}`} onClick={() => selectNode(other.id)}><span className="topology-connection-direction">{incoming ? 'IN' : 'OUT'}</span><span><b>{other.label[index]}</b><small>{isBlocked && e.downstream ? t('执行挂起', 'On hold') : e.label[index]}</small></span><ArrowRight size={13} /></button>;
        })}</div>
        <div className="topology-inspector-section"><h4>{t('数据来源', 'DATA SOURCE')}<span className={live ? 'topology-text-green' : ''}>{sourceCode}</span></h4><dl className="topology-metadata"><div><dt>{t('拓扑类型', 'Topology')}</dt><dd>{t('逻辑架构', 'Logical architecture')}</dd></div><div><dt>{t('网关事件总数', 'Gateway events')}</dt><dd>{isRealWorkspace && systemStatus ? systemStatus.totalRealEvents : '—'}</dd></div><div><dt>{t('最后采样', 'Last sample')}</dt><dd>{isRealWorkspace && systemStatus?.timestamp ? new Date(systemStatus.timestamp).toLocaleTimeString(zh ? 'zh-CN' : 'en-GB', { hour12: false }) : '—'}</dd></div><div><dt>{t('节点延迟 / 吞吐', 'Node latency / rate')}</dt><dd>{t('未采集', 'Not collected')}</dd></div></dl><p className="topology-data-note">{t('流动粒子表示调用方向，不代表真实请求速率。', 'Moving particles indicate direction, not measured request rates.')}</p></div>
        <button className="topology-drill-button" onClick={() => onOpenDrillDown?.(node.stage)} disabled={!onOpenDrillDown}>{t('打开阶段详情', 'Open stage details')}<ArrowRight size={15} /></button>
      </aside>
    </div>
    <footer className="topology-footer"><div className="topology-footer-controls"><button aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? t('恢复动效', 'Resume motion') : t('暂停动效', 'Pause motion')}</button><button aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)}><Orbit size={13} />{t('自动环绕', 'Auto orbit')}</button><button aria-pressed={labels} onClick={() => setLabels(!labels)}><Layers3 size={13} />{t('节点标签', 'Node labels')}</button><span className="topology-footer-divider" /><button onClick={() => { setPaused(false); sceneRef.current?.pulse(); onTriggerTrace?.(); }}><Activity size={13} />{t('预览路径', 'Preview flow')}</button></div><span className="topology-interaction-hint"><MousePointer2 size={12} />{t('拖动旋转 · 滚轮缩放 · 右键平移', 'Drag to orbit · Scroll to zoom · Right-drag to pan')}</span></footer>
    {help && <div className="topology-help"><div><CircleHelp size={16} /><b>{t('探索调用架构', 'Explore the call architecture')}</b><button aria-label={t('关闭指南', 'Close guide')} onClick={() => setHelp(false)}><X size={16} /></button></div><p>{t('点击节点查看职责与上下游；点击连接跳转相邻节点。分层视图适合检查执行顺序，环形视图适合观察反馈闭环。', 'Select a node to inspect responsibilities and connections. Follow a connection to inspect its neighbor. Use the layered view for execution order and orbit view for feedback loops.')}</p><p>{t('使用聚焦按钮靠近所选节点，适应画布恢复总览。全屏时按 Esc 退出。所有节点也可通过左侧目录用键盘访问。', 'Focus zooms to the selected node. Fit to view restores the overview. Press Esc to leave fullscreen. All nodes are keyboard accessible in the explorer.')}</p></div>}
    <span role="status" aria-live="polite" className={`topology-toast ${exportMessage ? 'is-visible' : ''}`}><Check size={14} />{exportMessage}</span>
  </div>;
};
