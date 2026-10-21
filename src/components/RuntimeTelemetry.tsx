import { Activity, ArrowUpRight, Pause, Radio } from "lucide-react";
import type { RuntimeEvent } from "../types/runtime";
import { statusLabels } from "./CodexMockDetails";

export function RuntimeTelemetry({ events, activeEvent, replaying, playing, isReal = false, onEvent }: {
  events: RuntimeEvent[]; activeEvent?: RuntimeEvent; replaying: boolean; playing: boolean; isReal?: boolean;
  onEvent: (event: RuntimeEvent, source: HTMLButtonElement) => void;
}) {
  const last = activeEvent ?? events.at(-1);
  const buckets = Array.from({ length: 24 }, () => 0);
  // The density strip is derived from the timestamps of visible events.
  events.forEach(event => { buckets[Math.min(23, Math.floor(event.offsetMs / 800))]++; });
  const peak = Math.max(1, ...buckets);
  const path = buckets.map((count, i) => `${i ? "L" : "M"}${i * 5},${26 - count / peak * 22}`).join(" ");
  return <div className="rt-telemetry">
    <div className="rt-telemetry-state">
      {playing ? <Radio size={15} /> : <Pause size={15} />}
      <span><strong>{replaying ? playing ? "正在回放" : "回放已暂停" : isReal ? "实时会话观测" : "完整会话预览"}</strong><small>{events.length} 条可观测事件 · {isReal ? "LIVE" : "MOCK"}</small></span>
    </div>
    <button className={`rt-event-signal ${last?.status === "waiting" ? "is-waiting" : last?.status === "failed" ? "is-failed" : ""}`}
      disabled={!last} onClick={event => last && onEvent(last, event.currentTarget)}>
      <span className="rt-event-signal-code">{last?.time ?? "等待输入"} <i /> {last?.source ?? "SESSION"}</span>
      <strong>{last?.title ?? "准备接收用户输入"}</strong>
      <small>{last ? statusLabels[last.status] : "等待"}<ArrowUpRight size={13} /></small>
    </button>
    <div className="rt-event-density"><span><Activity size={11} />事件密度</span><svg viewBox="0 0 115 30" aria-hidden="true"><path d={path} /></svg></div>
  </div>;
}
