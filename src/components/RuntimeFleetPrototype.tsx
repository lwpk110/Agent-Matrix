import React, { useMemo, useState } from "react";
import { Activity, Bot, Check, ChevronDown, Clock3, Search, Waypoints } from "lucide-react";
import { prototypeSessionFixtures, selectPrototypeSession } from "./runtimePrototypeFixtures";
import "./RuntimeFleetPrototype.css";

const sessions = prototypeSessionFixtures.map(fixture => {
  const { session } = selectPrototypeSession(fixture.id);
  return {
    ...fixture,
    tokens: (session.usage.inputTokens ?? 0) + (session.usage.outputTokens ?? 0),
  };
});

const labels = { running: "正在运行", waiting: "等待中", failed: "异常", completed: "已完成" } as const;
export type RuntimeFleetSession = { id: string; turnId: string; provider: string; label: string; state: keyof typeof labels; model: string; activity: string; age: string; tokens: number | null; link?: string };

export function RuntimeFleetPrototype({ selectedId, onSelect, items = sessions, live = false }: { selectedId: string; onSelect: (id: string) => void; items?: RuntimeFleetSession[]; live?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "attention">("all");
  const [historyOpen, setHistoryOpen] = useState(true);
  const visible = useMemo(() => items.filter(item => {
    const matchesQuery = `${item.label} ${item.model} ${item.provider} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "active" ? item.state === "running" : item.state === "failed" || item.state === "waiting");
    return matchesQuery && matchesFilter;
  }), [filter, items, query]);
  const active = visible.filter(item => item.state !== "completed");
  const history = visible.filter(item => item.state === "completed");
  const counts = { running: items.filter(item => item.state === "running").length, attention: items.filter(item => item.state === "failed" || item.state === "waiting").length };

  const row = (item: RuntimeFleetSession) => <button key={item.id} className={`rfp-session rfp-${item.state} ${selectedId === item.id ? "is-selected" : ""}`} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
    <span className="rfp-session-head"><span className={`rfp-state-dot rfp-dot-${item.state}`} /><span className={`rfp-provider rfp-provider-${item.provider}`}>{item.provider === "claude" ? "CC" : "CX"}</span><strong>{item.label}</strong><span className="rfp-age">{item.age}</span></span>
    <span className="rfp-model">{item.model}</span>
    <span className="rfp-activity"><Activity size={12} />{item.activity}</span>
    {item.link && <span className="rfp-link"><Waypoints size={11} />同一工作区 · {item.link}</span>}
    <span className="rfp-session-foot"><span>{labels[item.state]} · {item.turnId}</span><span>{item.tokens === null ? "未采集" : `${item.tokens.toLocaleString()} tokens`}</span></span>
  </button>;

  return <aside className="rfp-panel" aria-label={live ? "真实本地会话列表" : "模拟本地会话列表"}>
    <header className="rfp-header"><div><span className="rfp-kicker">LOCAL RUNTIME</span><h2>本地会话</h2></div><span className="rfp-total">{items.length}</span></header>
    <div className="rfp-summary"><span><i className="rfp-state-dot rfp-dot-running" />运行中 <b>{counts.running}</b></span><span><i className="rfp-state-dot rfp-dot-waiting" />待处理 <b>{counts.attention}</b></span></div>
    <label className="rfp-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索会话或模型" aria-label="搜索会话或模型" /></label>
    <div className="rfp-filters" role="group" aria-label="会话筛选">
      {(["all", "active", "attention"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{value === "all" ? "全部" : value === "active" ? "运行中" : "待处理"}</span><span className="rfp-filter-count">{value === "all" ? items.length : value === "active" ? counts.running : counts.attention}</span></button>)}
    </div>
    <div className="rfp-section-title"><span><Waypoints size={13} />活动会话</span><small>{active.length}</small></div>
    <div className="rfp-session-list">{active.map(row)}</div>
    {history.length > 0 && <section className="rfp-history"><button className="rfp-section-title rfp-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}><span><ChevronDown size={13} className={historyOpen ? "" : "is-collapsed"} />历史会话</span><small>{history.length}</small></button>{historyOpen && <div className="rfp-session-list">{history.map(row)}</div>}</section>}
    <footer className="rfp-footer"><span><Clock3 size={12} />最近活动优先</span><span><Bot size={12} />{live ? "LIVE · 本地运行时事件" : "仅原型数据"}</span><span className="rfp-evidence"><Check size={12} />{live ? "按会话隔离事件与用量" : "连接关系仅展示已确认项"}</span></footer>
  </aside>;
}
