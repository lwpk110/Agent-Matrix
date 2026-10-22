import { Activity, ArrowRight, Radio, WifiOff } from "lucide-react";
import type { WsConnectionState } from "../types/matrix";
import { listRuntimePlugins, type RuntimeAgentPlugin, type RuntimeConnectionStatus } from "../services/runtimePlugins";
import "./RuntimeEmptyState.css";

export function RuntimeEmptyState({ plugin, connectionState, connection, historyLoaded = true, historyError = false, view }: { plugin: RuntimeAgentPlugin; connectionState: WsConnectionState; connection?: RuntimeConnectionStatus; historyLoaded?: boolean; historyError?: boolean; view: "2d" | "3d" }) {
  const runtimeOffline = connection?.hookGatewayState === "offline" || connection?.appServerState === "offline";
  const state = historyError ? "历史加载失败" : !historyLoaded ? "正在恢复运行时历史" : connectionState === "offline" || runtimeOffline ? "本机事件网关离线" : "等待首条运行时事件";
  const Icon = connectionState === "offline" || runtimeOffline ? WifiOff : historyError ? Activity : Radio;
  return <main className="runtime-empty" aria-label={`${plugin.label} 运行时空态`}>
    <header><a href="/">Agent Matrix</a><span>{plugin.label} Runtime</span></header>
    <section><Icon size={24} /><p>RUNTIME OBSERVATORY</p><h1>{state}</h1><small>{view === "3d" ? "3D 拓扑将在事件到达后初始化。" : "实时页面只显示已采集的运行时证据。"}</small></section>
    <nav aria-label="切换 Agent 观测站">{listRuntimePlugins().map(item => <a key={item.provider} href={view === "3d" ? item.paths.threeDimensional : item.paths.twoDimensional}>{item.label}<ArrowRight size={13} /></a>)}</nav>
  </main>;
}
