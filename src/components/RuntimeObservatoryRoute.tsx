import type { Language } from "../i18n/translations";
import type { LogEntry, RealSystemStatus, WsConnectionState } from "../types/matrix";
import { findRuntimePluginByPath, getRuntimeConnection } from "../services/runtimePlugins";
import { Codex3DTopology } from "./codex3d/Codex3DTopology";
import { CodexRuntimePage } from "./CodexRuntimePage";
import { CodexSessionPrototype } from "./CodexSessionPrototype";
import { ClaudeDesktopTelemetryPage } from "./ClaudeDesktopTelemetryPage";

export type RuntimeHistoryState = { loaded: boolean; error: boolean };

export function RuntimeObservatoryRoute({ pathname, logs, realStatus, connectionState, historyByProvider, language, onBack, onClear }: {
  pathname: string;
  logs: LogEntry[];
  realStatus?: RealSystemStatus | null;
  connectionState: WsConnectionState;
  historyByProvider: Record<string, RuntimeHistoryState | undefined>;
  language: Language;
  onBack: () => void;
  onClear: (provider: string) => Promise<void>;
}) {
  if (pathname === '/claude/desktop') return <ClaudeDesktopTelemetryPage />;
  const plugin = findRuntimePluginByPath(pathname);
  if (!plugin) return null;
  const history = historyByProvider[plugin.provider] || { loaded: true, error: false };
  const connection = getRuntimeConnection(plugin, realStatus);
  if (pathname === plugin.paths.twoDimensional) return <CodexSessionPrototype logs={logs} connectionState={connectionState} realStatus={realStatus} provider={plugin.provider} historyLoaded={history.loaded} historyError={history.error} />;
  if (pathname === plugin.paths.threeDimensional) return <Codex3DTopology logs={logs} provider={plugin.provider} connectionState={connectionState} realStatus={realStatus} historyLoaded={history.loaded} historyError={history.error} />;
  if (pathname === plugin.paths.runtime) return <CodexRuntimePage language={language} connectionState={connectionState} connection={connection} historyLoaded={history.loaded} historyError={history.error} logs={logs} provider={plugin.provider} providerLabel={plugin.label} canClear={Boolean(plugin.clearRuntime)} onBack={onBack} onClear={() => onClear(plugin.provider)} />;
  return null;
}
