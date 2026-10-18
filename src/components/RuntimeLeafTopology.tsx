import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertCircle, ArrowUpRight, BookOpen, CheckCheck, Folder, GitBranch, Globe, Layers3, MessageSquare, Network, Search, ShieldCheck, Sparkles, Terminal, X, Zap } from "lucide-react";
import type { MockNodeId, MockRuntimeEvent, MockRuntimeSession } from "./codexRuntimeMock";
import { leafStatusLabels, runtimeLeaves, type RuntimeLeaf } from "./runtimeLeafModel";
import "./RuntimeLeafTopology.css";

const icons = { browser: Globe, layers: Layers3, book: BookOpen, check: CheckCheck, git: GitBranch, terminal: Terminal, network: Network, search: Search, sparkles: Sparkles, zap: Zap, alert: AlertCircle, folder: Folder, message: MessageSquare, shield: ShieldCheck };
const categories = {
  input: ["用户输入", MessageSquare, "输入内容"], context: ["上下文", Layers3, "上下文组成"],
  prompt: ["提示词", Sparkles, "消息组成"], skill: ["Skill", BookOpen, "技能目录"],
  model: ["Codex", Activity, "模型请求"], hook: ["Hook", Zap, "生命周期事件"],
  gate: ["权限门禁", ShieldCheck, "策略与审批"], tool: ["本地工具", Terminal, "工具调用"],
  mcp: ["MCP", Network, "服务目录"], search: ["搜索", Search, "检索记录"], output: ["返回结果", CheckCheck, "输出内容"],
} as const;

export type LeafPreviewAnchor = { id: MockNodeId; left: number; right: number; top: number; bottom: number };

export function RuntimeLeafTopology({ anchor, session, events, onKeep, onLeave, onClose, onInspect, playing }: {
  anchor: LeafPreviewAnchor;
  session: MockRuntimeSession;
  events: MockRuntimeEvent[];
  onKeep: () => void;
  onLeave: () => void;
  onClose: () => void;
  onInspect: (leaf: RuntimeLeaf) => void;
  playing: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const leaves = runtimeLeaves(anchor.id, session, events);
  const active = leaves.find(leaf => leaf.id === activeId) ?? leaves.find(leaf => leaf.status === "loaded") ?? leaves[0];
  const [title, CenterIcon, subtitle] = categories[anchor.id];
  const width = Math.min(600, window.innerWidth - 24);
  const height = Math.min(590, window.innerHeight - 24);
  const rightSpace = window.innerWidth - anchor.right;
  const leftSpace = anchor.left;
  const x = rightSpace >= width + 16 ? anchor.right + 12
    : leftSpace >= width + 16 ? anchor.left - width - 12
      : Math.max(12, Math.min(window.innerWidth - width - 12, (anchor.left + anchor.right - width) / 2));
  const y = Math.max(12, Math.min(window.innerHeight - height - 12, anchor.top - 70));
  const positions = leaves.map((_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / leaves.length;
    return { x: 300 + Math.cos(a) * 201, y: 164 + Math.sin(a) * 134 };
  });
  return createPortal(
    <section
      className={`runtime-leaf-preview ${!playing ? "is-paused" : ""}`}
      aria-label={`${title}内部拓扑`}
      style={{ left: x, top: y, width, maxHeight: height }}
      onMouseEnter={onKeep}
      onMouseLeave={onLeave}
      onFocusCapture={onKeep}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave(); }}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    >
      <header className="rlp-header">
        <span className="rlp-category"><CenterIcon size={17} /><strong>{subtitle}</strong><span>{leaves.length} 个叶子节点</span></span>
        <button type="button" aria-label="关闭内部拓扑" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="rlp-graph" role="group" aria-label={`${title}的具体条目`}>
        <svg viewBox="0 0 600 380" preserveAspectRatio="none" aria-hidden="true">
          <circle className="rlp-orbit" cx="300" cy="164" r="111" />
          <circle className="rlp-reticle" cx="300" cy="164" r="59" />
          {leaves.map((leaf, i) => {
            const p = positions[i];
            const hot = active.id === leaf.id;
            return <g key={leaf.id} className={`rlp-spoke ${hot ? "is-active" : ""} is-${leaf.status}`}>
              <line x1="300" y1="164" x2={p.x} y2={p.y} />
              {hot && <line className="rlp-flow" x1="300" y1="164" x2={p.x} y2={p.y} />}
            </g>;
          })}
        </svg>
        <div className="rlp-core"><CenterIcon size={22} /><strong>{title}</strong><small>{anchor.id === "skill" ? `${leaves.filter(leaf => leaf.status === "loaded").length} 已加载 / ${leaves.length} 可用` : `${leaves.length} 个组成项`}</small></div>
        {leaves.map((leaf, i) => {
          const Icon = icons[leaf.icon as keyof typeof icons] ?? Network;
          const p = positions[i];
          return <button type="button" key={leaf.id}
            className={`rlp-leaf is-${leaf.status} ${active.id === leaf.id ? "is-active" : ""}`}
            style={{ left: `${p.x / 6}%`, top: `${p.y / 3.8}%`, "--leaf-delay": `${i * 45}ms` } as CSSProperties}
            aria-label={`${leaf.title} · ${leafStatusLabels[leaf.status]}`}
            aria-pressed={active.id === leaf.id}
            onMouseEnter={() => setActiveId(leaf.id)} onFocus={() => setActiveId(leaf.id)} onClick={() => setActiveId(leaf.id)}>
            <span className="rlp-leaf-icon"><Icon size={18} /><i /></span>
            <strong>{leaf.title}</strong>
            <small>{leaf.name}</small>
            <em>{leafStatusLabels[leaf.status]}</em>
          </button>;
        })}
      </div>
      <div className="rlp-leaf-detail" aria-live="polite">
        <div><strong>{active.title}</strong><span className={`rlp-status is-${active.status}`}><i />{leafStatusLabels[active.status]}</span></div>
        <p>{active.summary}</p>
        <button type="button" disabled={!active.eventId && !active.callId} onClick={() => onInspect(active)}>
          {active.eventId || active.callId ? "查看本轮执行证据" : "暂无本轮执行记录"}<ArrowUpRight size={13} />
        </button>
      </div>
      <footer><span><i />{session.isReal ? "LIVE · Codex Runtime" : "MOCK · 原型示例"}</span><span>悬浮叶子查看摘要 · Esc 收起</span></footer>
    </section>, document.body,
  );
}
