/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MatrixMode,
  LogEntry,
  JevMetrics,
  SubagentTask,
  AdvisorState,
  SessionWorkspace,
  WsConnectionState,
  TelemetryMode,
  HitlApprovalRequest,
  RealSystemStatus,
} from "./types/matrix";
import { Language, translations } from "./i18n/translations";
import { TerminalHeader } from "./components/TerminalHeader";
import { SessionTabBar } from "./components/SessionTabBar";
import { FinOpsBar } from "./components/FinOpsBar";
import { AdvisorPanel } from "./components/AdvisorPanel";
import { MainSessionPanel } from "./components/MainSessionPanel";
import { SubagentsDispatcherPanel } from "./components/SubagentsDispatcherPanel";
import { LiveSessionLog } from "./components/LiveSessionLog";
import { InteractiveCliBar } from "./components/InteractiveCliBar";
import { NativeTuiModal } from "./components/NativeTuiModal";
import { LocalAgentModal } from "./components/LocalAgentModal";
import { AgentBlackBoxMonitor } from "./components/AgentBlackBoxMonitor";
import { AgentDynamicFlowHero } from "./components/AgentDynamicFlowHero";
import { MultiSessionFleetGrid } from "./components/MultiSessionFleetGrid";
import { Agent3dArchitectureTopology } from "./components/Agent3dArchitectureTopology";
import { CodexSessionPrototype } from "./components/CodexSessionPrototype";
import { CodexMark } from "./components/CodexMark";
import { ClaudeMark } from "./components/ClaudeMark";
import { Codex3DTopology } from "./components/codex3d/Codex3DTopology";
import { RuntimeObservatoryRoute } from "./components/RuntimeObservatoryRoute";
import { telemetryBus } from "./services/websocket";
import { appendRuntimeLog, pairRuntimeLogs, rememberRuntimeEventIdentity } from "./services/runtimeLogBuffer";
import { findRuntimePluginByPath } from "./services/runtimePlugins";
import { soundFx } from "./utils/audio";
import { generate60mHistory } from "./utils/finOpsHistory";
import { BlackBoxStage } from "./types/matrix";

export type DashboardViewMode =
  | "conduit"
  | "3d-topology"
  | "fleet-matrix"
  | "drill-down"
  | "overview";

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [mode, setMode] = useState<MatrixMode>("claude");
  const [telemetryMode, setTelemetryMode] = useState<TelemetryMode>("gateway");
  const [wsState, setWsState] = useState<WsConnectionState>("probing");
  const [isStreaming, setIsStreaming] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTuiModalOpen, setIsTuiModalOpen] = useState(false);
  const [isLocalAgentModalOpen, setIsLocalAgentModalOpen] = useState(false);
  const [dashboardViewMode, setDashboardViewMode] =
    useState<DashboardViewMode>("conduit");
  const [drillDownStage, setDrillDownStage] = useState<BlackBoxStage | null>(
    null,
  );
  const [observedTopologyStage, setObservedTopologyStage] =
    useState<BlackBoxStage>();
  const seenCodexEventIds = useRef(new Set<string>());
  const [codexHistoryLoaded, setCodexHistoryLoaded] = useState(false);
  const [codexHistoryError, setCodexHistoryError] = useState(false);
  const [claudeHistoryLoaded, setClaudeHistoryLoaded] = useState(false);
  const [claudeHistoryError, setClaudeHistoryError] = useState(false);

  // Real System & Git status telemetry
  const [realStatus, setRealStatus] = useState<RealSystemStatus | null>(null);
  const [hasClaudeHooks, setHasClaudeHooks] = useState<boolean>(false);

  // Multi-Session Fleet Workspaces (Primary is Real Workspace, followed by 3 simulation scenarios)
  const [sessions, setSessions] = useState<SessionWorkspace[]>([
    {
      id: "sess-real",
      tag: "#⚡ local-active-agent",
      title: "本地真实工作区 (Real Local Workspace)",
      branch: "main",
      activeFile: "server.ts",
      step: 1,
      totalSteps: 5,
      isRealWorkspace: true,
      directive:
        "已挂载当前项目真实工作区，正在监听 7788 网关接收 Claude Code 与 Codex 实时指令流与安全拦截。",
      activeDiff: {
        filePath: "server.ts",
        oldCode: "// 等待真实 Agent 或 Git 修改...",
        newCode: "// 7788 本地遥测与安全网关已启动就绪 (Port 3000 & 7788)",
      },
      finOps: {
        burnRatePerMin: 0.05,
        burnTrend: [0.02, 0.03, 0.05],
        tokensUsed: 12400,
        maxTokens: 200000,
        watermarkPct: 6.2,
        cyclomaticComplexityDelta: 0,
        loopCircuitBreakerCount: 0,
        totalSessionCost: 0.032,
        historical60m: generate60mHistory(0.03, 0.09, "real", 0.05),
      },
      jev: {
        pInline: 0.22,
        pSubagents: 0.74,
        pEscalate: 0.04,
        entropy: 0.41,
        confidence: 0.95,
        monteCarloSamples: 5000,
        decisionRule: "ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS",
      },
      subagents: [
        {
          id: "sub-real-01",
          name: "Worker #01",
          model: "Claude 3.5 Haiku",
          type: "worker",
          badge: "[Local-AST]",
          status: "streaming",
          progress: 92,
          currentPayload: "Local workspace Git & AST integrity check active",
          itemsProcessed: 18,
          totalItems: 18,
          frequencyHz: 140.0,
          sparkline: [40, 60, 75, 88, 92],
        },
        {
          id: "sub-real-02",
          name: "Explorer #02",
          model: "Claude 3.5 Haiku",
          type: "explorer",
          badge: "[Hook-7788]",
          status: "running",
          progress: 75,
          currentPayload:
            "Listening on http://127.0.0.1:7788/hook/pre for PreToolUse interception",
          itemsProcessed: 8,
          totalItems: 10,
          frequencyHz: 110.0,
          sparkline: [30, 45, 55, 65, 75],
        },
        {
          id: "sub-real-03",
          name: "Researcher #03",
          model: "Claude 3.5 Haiku",
          type: "researcher",
          badge: "[Sys-Monitor]",
          status: "complete",
          progress: 100,
          currentPayload: "Local Node.js & Git telemetry heartbeat sync normal",
          itemsProcessed: 24,
          totalItems: 24,
          frequencyHz: 160.0,
          sparkline: [50, 70, 85, 100, 100],
        },
      ],
      isBlocked: false,
    },
    {
      id: "sess-1",
      tag: "#1 auth-oauth-refactor",
      title: "OAuth2 零信任安全重构 [仿真]",
      branch: "feat/neural-auth",
      activeFile: "src/auth/oauth2.ts",
      step: 4,
      totalSteps: 9,
      directive:
        "重构认证链路为零信任 OAuth2 架构，集成 PKCE 状态参数校验、AST 语法树自动转换及并行回归套件验证。",
      activeDiff: {
        filePath: "src/auth/oauth2.ts",
        oldCode: "const token = await legacyVerify(req.query.code);",
        newCode:
          "const token = await secureOauthExchange(req.query.code, state);",
      },
      finOps: {
        burnRatePerMin: 0.18,
        burnTrend: [0.12, 0.15, 0.18],
        tokensUsed: 182400,
        maxTokens: 200000,
        watermarkPct: 91.2,
        cyclomaticComplexityDelta: 2,
        loopCircuitBreakerCount: 0,
        totalSessionCost: 0.428,
        historical60m: generate60mHistory(0.12, 0.28, "auth", 0.18),
      },
      jev: {
        pInline: 0.14,
        pSubagents: 0.82,
        pEscalate: 0.04,
        entropy: 0.428,
        confidence: 0.962,
        monteCarloSamples: 5000,
        decisionRule: "ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS",
      },
      subagents: [
        {
          id: "sub-01",
          name: "Worker #01",
          model: "Claude 3.5 Haiku",
          type: "worker",
          badge: "[AST]",
          status: "streaming",
          progress: 89,
          currentPayload:
            "Synthesizing AST Node visitor for PKCE token validation in src/auth/oauth2.ts",
          itemsProcessed: 14,
          totalItems: 14,
          frequencyHz: 142.4,
          sparkline: [40, 55, 60, 78, 89],
        },
        {
          id: "sub-02",
          name: "Explorer #02",
          model: "Claude 3.5 Haiku",
          type: "explorer",
          badge: "[docs]",
          status: "running",
          progress: 68,
          currentPayload:
            "Semantic grep across RFC 7636 PKCE spec & local authorization callbacks",
          itemsProcessed: 4,
          totalItems: 6,
          frequencyHz: 98.1,
          sparkline: [20, 35, 45, 60, 68],
        },
        {
          id: "sub-03",
          name: "Researcher #03",
          model: "Claude 3.5 Haiku",
          type: "researcher",
          badge: "[112/112]",
          status: "complete",
          progress: 100,
          currentPayload:
            "Running Vitest fuzz regression matrix: 112/112 test suites passing",
          itemsProcessed: 112,
          totalItems: 112,
          frequencyHz: 164.0,
          sparkline: [50, 75, 90, 100, 100],
        },
      ],
      isBlocked: false,
    },
    {
      id: "sess-2",
      tag: "#2 k8s-cnpg-scaling",
      title: "CloudNative-PG 伸缩与调度 [仿真]",
      branch: "ops/cnpg-ha-prod",
      activeFile: "k8s/prod-secrets.yaml",
      step: 2,
      totalSteps: 6,
      directive:
        "升级生产级 CloudNative-PG 集群拓扑，配置跨可用区拓扑分布约束 (PodAntiAffinity) 与 KMS 加密卷动态轮转。",
      activeDiff: {
        filePath: "k8s/prod-secrets.yaml",
        oldCode: "  instances: 1\n  storage: 50Gi",
        newCode:
          "  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager",
      },
      finOps: {
        burnRatePerMin: 0.24,
        burnTrend: [0.18, 0.21, 0.24],
        tokensUsed: 94200,
        maxTokens: 200000,
        watermarkPct: 47.1,
        cyclomaticComplexityDelta: 1,
        loopCircuitBreakerCount: 0,
        totalSessionCost: 0.284,
        historical60m: generate60mHistory(0.16, 0.32, "k8s", 0.24),
      },
      jev: {
        pInline: 0.25,
        pSubagents: 0.68,
        pEscalate: 0.07,
        entropy: 0.512,
        confidence: 0.914,
        monteCarloSamples: 4200,
        decisionRule: "ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS",
      },
      subagents: [
        {
          id: "sub-21",
          name: "Worker #01",
          model: "Claude 3.5 Haiku",
          type: "worker",
          badge: "[K8s-AST]",
          status: "running",
          progress: 54,
          currentPayload:
            "Generating CloudNative-PG CRD Manifest with Anti-Affinity rules",
          itemsProcessed: 3,
          totalItems: 5,
          frequencyHz: 120.0,
          sparkline: [20, 30, 45, 50, 54],
        },
        {
          id: "sub-22",
          name: "Explorer #02",
          model: "Claude 3.5 Haiku",
          type: "explorer",
          badge: "[CRD]",
          status: "running",
          progress: 72,
          currentPayload:
            "Validating against CloudNative-PG Operator v1.24 API schema",
          itemsProcessed: 7,
          totalItems: 8,
          frequencyHz: 105.0,
          sparkline: [30, 40, 55, 65, 72],
        },
        {
          id: "sub-23",
          name: "Researcher #03",
          model: "Claude 3.5 Haiku",
          type: "researcher",
          badge: "[kubeval]",
          status: "complete",
          progress: 100,
          currentPayload:
            "Dry-run kubeval linting passed across 4 cluster namespaces",
          itemsProcessed: 4,
          totalItems: 4,
          frequencyHz: 150.0,
          sparkline: [40, 60, 80, 100, 100],
        },
      ],
      isBlocked: false,
    },
    {
      id: "sess-3",
      tag: "#3 doris-sql-opt",
      title: "Doris 分布式物化视图调优 [仿真]",
      branch: "perf/doris-mview",
      activeFile: "sql/views/mview_orders_daily.sql",
      step: 5,
      totalSteps: 8,
      directive:
        "针对 TB 级订单聚合查询改写分桶剪枝逻辑，构建异步物化视图以削减 85% Scan Bytes。",
      activeDiff: {
        filePath: "sql/views/mview_orders_daily.sql",
        oldCode:
          "SELECT user_id, sum(amount) FROM raw_events GROUP BY user_id;",
        newCode:
          "CREATE MATERIALIZED VIEW mv_user_agg AS SELECT user_id, sum(amount) FROM raw_events GROUP BY user_id;",
      },
      finOps: {
        burnRatePerMin: 0.14,
        burnTrend: [0.11, 0.13, 0.14],
        tokensUsed: 62000,
        maxTokens: 200000,
        watermarkPct: 31.0,
        cyclomaticComplexityDelta: -3,
        loopCircuitBreakerCount: 0,
        totalSessionCost: 0.192,
        historical60m: generate60mHistory(0.1, 0.22, "doris", 0.14),
      },
      jev: {
        pInline: 0.45,
        pSubagents: 0.52,
        pEscalate: 0.03,
        entropy: 0.385,
        confidence: 0.98,
        monteCarloSamples: 6000,
        decisionRule: "ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS",
      },
      subagents: [
        {
          id: "sub-31",
          name: "Worker #01",
          model: "Claude 3.5 Haiku",
          type: "worker",
          badge: "[SQL-AST]",
          status: "complete",
          progress: 100,
          currentPayload:
            "Rewriting partition projection into Doris vectorized engine format",
          itemsProcessed: 18,
          totalItems: 18,
          frequencyHz: 160.0,
          sparkline: [50, 70, 85, 95, 100],
        },
        {
          id: "sub-32",
          name: "Explorer #02",
          model: "Claude 3.5 Haiku",
          type: "explorer",
          badge: "[EXPLAIN]",
          status: "running",
          progress: 81,
          currentPayload:
            "Simulating query plan cost matrix across 10 BE nodes",
          itemsProcessed: 9,
          totalItems: 10,
          frequencyHz: 110.0,
          sparkline: [35, 50, 65, 75, 81],
        },
        {
          id: "sub-33",
          name: "Researcher #03",
          model: "Claude 3.5 Haiku",
          type: "researcher",
          badge: "[Benchmark]",
          status: "streaming",
          progress: 60,
          currentPayload:
            "Running TPC-H query 03 benchmark: latency dropped 820ms -> 68ms",
          itemsProcessed: 3,
          totalItems: 5,
          frequencyHz: 135.0,
          sparkline: [20, 30, 45, 55, 60],
        },
      ],
      isBlocked: false,
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState("sess-real");
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Advisor State
  const [advisor, setAdvisor] = useState<AdvisorState>({
    model: "Claude 3.7 Opus",
    status: "standby",
    riskScore: 0.4,
    riskCeiling: 2.0, // Strict 2.0% ceiling
    alertActive: false,
    alertReason: "",
    checks: [
      {
        name: "eval() / Function() injection guard",
        status: "pass",
        detail: "Strict AST scan passed",
      },
      {
        name: "fs.writeFile mutation bounds (src/)",
        status: "pass",
        detail: "Scoped within repository root",
      },
      {
        name: "OAuth credential exfiltration watcher",
        status: "pass",
        detail: "Zero token leaks detected",
      },
      {
        name: "Subagent AST patch consensus",
        status: "pass",
        detail: "3/3 signatures verified",
      },
    ],
  });

  // Live Session Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "log-01",
      timestamp: new Date().toTimeString().split(" ")[0],
      agentTag: "GATEWAY",
      agentColor: "emerald",
      category: "system",
      message:
        "AI 智能体控制平面与安全审计网关已启动 (Embedded Gateway Ports: 3000 & 7788)",
    },
    {
      id: "log-02",
      timestamp: new Date().toTimeString().split(" ")[0],
      agentTag: "LOCAL-ENV",
      agentColor: "cyan",
      category: "system",
      message:
        "已挂载本地工程目录，双模总线支持真实 Agent 钩子拦截与实时演练切换。",
    },
  ]);

  const addLog = useCallback(
    (
      entry: Omit<LogEntry, "id" | "timestamp">,
      options: { silent?: boolean } = {},
    ) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const newEntry: LogEntry = {
        ...entry,
        id: "log-" + Math.random().toString(36).substr(2, 9),
        timestamp: timeStr,
      };
      setLogs((prev) => appendRuntimeLog(prev, newEntry));
      if (!options.silent) {
        if (entry.riskLevel === "critical" || entry.category === "hitl") {
          soundFx.playAlert();
        } else {
          soundFx.playChirp(entry.agentColor === "amber" ? 920 : 740);
        }
      }
    },
    [],
  );

  // A stable callback prevents the flow view's stage effect from re-emitting on every log update.
  const handleFlowStageSelected = useCallback(
    (stage: BlackBoxStage) => {
      setDrillDownStage(stage);
      addLog({
        agentTag: "DYNAMIC-FLOW",
        agentColor: "cyan",
        category: "system",
        message: `流转视口已切换聚焦至: [${stage.toUpperCase()}] 阶段节点`,
      });
    },
    [addLog],
  );

  // Update real session workspace from system status
  const updateRealSessionFromStatus = useCallback(
    (status: RealSystemStatus) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === "sess-real") {
            const firstModFile =
              status.modifiedFiles && status.modifiedFiles.length > 0
                ? status.modifiedFiles[0]
                : "server.ts";
            return {
              ...s,
              branch: status.gitBranch || s.branch,
              activeFile: firstModFile,
              realCwd: status.cwd,
              realCommit: status.gitRecentCommit,
              realModifiedFiles: status.modifiedFiles || [],
              directive: status.hasClaudeHooks
                ? `已挂载本地项目: ${status.cwd} (Git: ${status.gitBranch})，.claude/settings.json 拦截钩子处于激活状态。`
                : `已挂载本地项目: ${status.cwd} (Git: ${status.gitBranch})，点击下方【⚡ 注入 Claude 钩子】即可启用本地命令拦截。`,
              activeDiff: status.gitDiff
                ? {
                    filePath: firstModFile,
                    oldCode: "// Git 工作区基准代码",
                    newCode: status.gitDiff.slice(0, 1200),
                  }
                : s.activeDiff,
            };
          }
          return s;
        }),
      );
    },
    [],
  );

  // Initial fetch of real local status
  useEffect(() => {
    telemetryBus.fetchRealStatus().then((status) => {
      if (status) {
        setRealStatus(status);
        setHasClaudeHooks(Boolean(status.hasClaudeHooks));
        updateRealSessionFromStatus(status);
        addLog({
          agentTag: "LOCAL-GIT",
          agentColor: "cyan",
          category: "system",
          message: `检测到本地 Git 分支: [${status.gitBranch}]，最新提交: ${status.gitRecentCommit}，未提交文件: ${status.modifiedFiles.length} 个`,
        });
      }
    });
  }, [updateRealSessionFromStatus, addLog]);

  // Sync Audio Mute
  useEffect(() => {
    soundFx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Subscribe to WebSocket Telemetry Bus
  useEffect(() => {
    telemetryBus
      .fetchCodexRuntimeEvents()
      .then(({ events }) => {
        events.forEach((payload) => {
          telemetryBus.dispatchLocalEvent({ type: "codex_runtime", payload });
        });
        setCodexHistoryLoaded(true);
        setCodexHistoryError(false);
      })
      .catch(() => { setCodexHistoryLoaded(true); setCodexHistoryError(true); });
    telemetryBus.fetchClaudeRuntimeEvents()
      .then(({ events }) => {
        events.forEach((payload) => telemetryBus.dispatchLocalEvent({ type: "claude_runtime", payload }));
        setClaudeHistoryLoaded(true);
        setClaudeHistoryError(false);
      })
      .catch(() => { setClaudeHistoryLoaded(true); setClaudeHistoryError(true); });

    const unsubState = telemetryBus.onStateChange((newState) => {
      setWsState(newState);
      if (newState === "connected") {
        setTelemetryMode("gateway");
        addLog({
          agentTag: "GATEWAY",
          agentColor: "emerald",
          category: "system",
          message:
            "已成功与本地 7788 遥测网关建立 WebSocket 握手 (ws://localhost:7788/ws)",
        });
      }
    });

    const unsubEvents = telemetryBus.subscribe((event) => {
      if (event.type === "system_status") {
        const status = event.payload as RealSystemStatus;
        setRealStatus(status);
        setHasClaudeHooks(Boolean(status.hasClaudeHooks));
        updateRealSessionFromStatus(status);
      } else if (event.type === "exec_result") {
        setObservedTopologyStage("feedback");
        const payload = event.payload as {
          command: string;
          output: string;
          exitCode: number;
          durationMs: number;
        };
        addLog({
          agentTag: "LOCAL-CLI",
          agentColor: payload.exitCode === 0 ? "emerald" : "rose",
          category: "system",
          message: `$ ${payload.command} (${payload.durationMs}ms, exit: ${payload.exitCode})\n${payload.output}`,
        });
      } else if (event.type === "claude_hooks_configured") {
        setHasClaudeHooks(true);
        addLog({
          agentTag: "GATEWAY",
          agentColor: "emerald",
          category: "system",
          message:
            "本地 .claude/settings.json 钩子已成功注入，Claude Code 工具调用将自动重定向至本控制平面！",
        });
      } else if (event.type === "hitl_blocked") {
        setObservedTopologyStage("permission");
        const payload = event.payload as {
          id: string;
          targetPath: string;
          riskScore: number;
          cveOrRule: string;
          summary: string;
          diffSnippet?: { filePath: string; oldCode: string; newCode: string };
        };
        triggerHitlBlock(
          payload.targetPath,
          payload.riskScore,
          payload.cveOrRule,
          payload.summary,
          payload.diffSnippet,
        );
      } else if (event.type === "tool_call") {
        setObservedTopologyStage("mcp_hook");
        const p = event.payload as {
          name: string;
          args: string;
          diffSnippet?: { filePath: string; oldCode: string; newCode: string };
        };
        addLog({
          agentTag: mode === "codex" ? "CODEX-CLI" : "CLAUDE-CODE",
          agentColor: "amber",
          category: "tool",
          message: `[网关实时工具调用] ${p.name} ${p.args ? `(${p.args.slice(0, 80)})` : ""}`,
          toolCall: {
            name: p.name,
            args: p.args,
            status: "completed",
            durationMs: 45,
          },
          diffSnippet: p.diffSnippet,
        });

        // Update real session if diff provided
        if (p.diffSnippet) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === "sess-real"
                ? {
                    ...s,
                    activeFile: p.diffSnippet!.filePath,
                    activeDiff: p.diffSnippet!,
                    finOps: {
                      ...s.finOps,
                      tokensUsed: s.finOps.tokensUsed + 1200,
                      watermarkPct: +(
                        ((s.finOps.tokensUsed + 1200) / s.finOps.maxTokens) *
                        100
                      ).toFixed(1),
                    },
                  }
                : s,
            ),
          );
        }
      } else if (event.type === "telemetry") {
        setObservedTopologyStage("feedback");
      } else if (event.type === "codex_runtime_cleared") {
        setLogs((current) => current.filter((log) => log.runtimeEvent?.provider !== "codex"));
      } else if (event.type === "claude_runtime_cleared") {
        setLogs((current) => current.filter((log) => log.runtimeEvent?.provider !== "claude"));
      } else if (event.type === "codex_runtime" || event.type === "claude_runtime") {
        const runtimeEvent = event.payload as {
          provider: "codex" | "claude";
          source: "codex-hook" | "codex-app-server" | "claude-hook" | "claude-desktop";
          eventId?: string;
          hookEventName: string;
          sessionId?: string;
          turnId?: string;
          toolUseId?: string;
          cwd?: string;
          model?: string;
          reasoningEffort?: string;
          permissionMode?: string;
          agentId?: string;
          agentType?: string;
          phase:
            | "prompt"
            | "started"
            | "completed"
            | "permission"
            | "lifecycle";
          timestamp?: string;
          hasToolResponse: boolean;
          toolInputKeys?: string[];
          permissionDecision?: string;
          correlationStatus?: "pending" | "paired" | "unpaired";
          pairedEventId?: string;
          observedIntervalMs?: number;
          toolName?: string;
          payload: Record<string, unknown>;
        };
        const { hookEventName, toolName, sessionId, payload } = runtimeEvent;
        if (!rememberRuntimeEventIdentity(seenCodexEventIds.current, runtimeEvent))
          return;
        if (
          (runtimeEvent.phase === "started" ||
            runtimeEvent.phase === "completed") &&
          runtimeEvent.toolUseId
        ) {
          setLogs((current) =>
            pairRuntimeLogs(current, {
              ...runtimeEvent,
              eventId: runtimeEvent.eventId || "",
              eventName: hookEventName,
              details: "",
            }),
          );
        }
        const stage: BlackBoxStage =
          hookEventName === "PermissionRequest"
            ? "permission"
            : hookEventName === "UserPromptSubmit" ||
                hookEventName === "SessionStart" ||
                hookEventName.includes("Compact")
              ? "prompt"
              : hookEventName === "Stop" ||
                  hookEventName === "SessionEnd" ||
                  hookEventName === "SubagentStop"
                ? "feedback"
                : "mcp_hook";
        setObservedTopologyStage(stage);

        const nestedPayload =
          payload.payload && typeof payload.payload === "object"
            ? (payload.payload as Record<string, unknown>)
            : {};
        const toolInput = payload.tool_input ?? nestedPayload.tool_input;
        const promptValue = payload.prompt ?? nestedPayload.prompt;
        const prompt = typeof promptValue === "string" ? promptValue : "";
        const inputSummary =
          toolInput === undefined
            ? ""
            : JSON.stringify(toolInput).slice(0, 320);
        const toolKind = toolName?.startsWith("mcp__")
          ? "MCP"
          : /search|browser/i.test(toolName || "")
            ? "SEARCH"
            : /skills?[\\/].*SKILL\.md|SKILL\.md/i.test(inputSummary)
              ? "SKILL"
              : "";
        const finalText = typeof payload.text === "string" ? payload.text : "";
        const message =
          hookEventName === "UserPromptSubmit"
            ? `用户提示词已提交：${prompt.slice(0, 240) || "(无文本内容)"}`
            : hookEventName === "AppServerFinalAnswer"
              ? `Codex 完成回复：${finalText.slice(0, 240)}`
              : runtimeEvent.source === "codex-app-server"
                ? `${hookEventName}${toolName ? ` · ${toolName}` : ""}${inputSummary ? ` · ${inputSummary}` : ""}`
                : toolName
                  ? `${hookEventName} · ${toolKind ? `${toolKind}/` : ""}${toolName}${inputSummary ? ` · ${inputSummary}` : ""}`
                  : `${hookEventName}${typeof payload.source === "string" ? ` · ${payload.source}` : ""}`;
        const isPermissionEvent = hookEventName === "PermissionRequest" || hookEventName === "PermissionDenied";
        const isToolEvent =
          hookEventName === "PreToolUse" ||
          hookEventName === "PostToolUse" ||
          hookEventName.startsWith("AppServerMcpToolCall") ||
          hookEventName.startsWith("AppServerWebSearch") ||
          hookEventName.startsWith("AppServerDynamicToolCall") ||
          hookEventName.startsWith("AppServerCommandExecution");
        const durationMs =
          typeof payload.duration_ms === "number"
            ? payload.duration_ms
            : undefined;

        addLog(
          {
            agentTag: runtimeEvent.provider === "claude" ? "CLAUDE LIVE" : "CODEX LIVE",
            agentColor: isPermissionEvent
              ? "amber"
              : hookEventName === "UserPromptSubmit"
                ? "purple"
                : "cyan",
            category: isPermissionEvent
              ? "alert"
              : isToolEvent
                ? "tool"
                : "system",
            message,
            riskLevel: isPermissionEvent ? "elevated" : undefined,
            toolCall:
              isToolEvent && toolName
                ? {
                    name: toolName,
                    args: inputSummary,
                    status:
                      hookEventName === "PostToolUseFailure"
                        ? "failed"
                        : hookEventName === "PostToolUse"
                          ? "completed"
                          : "executing",
                    durationMs,
                  }
                : undefined,
            runtimeEvent: {
              provider: runtimeEvent.provider,
              source: runtimeEvent.source,
              eventId: runtimeEvent.eventId || "",
              eventName: hookEventName,
              toolName: runtimeEvent.toolName,
              sessionId,
              turnId: runtimeEvent.turnId,
              toolUseId: runtimeEvent.toolUseId,
              cwd: runtimeEvent.cwd,
              model: runtimeEvent.model,
              reasoningEffort: runtimeEvent.reasoningEffort,
              permissionMode: runtimeEvent.permissionMode,
              agentId: runtimeEvent.agentId,
              agentType: runtimeEvent.agentType,
              phase: runtimeEvent.phase,
              timestamp: runtimeEvent.timestamp,
              hasToolResponse: runtimeEvent.hasToolResponse,
              toolInputKeys: runtimeEvent.toolInputKeys,
              permissionDecision: runtimeEvent.permissionDecision,
              correlationStatus: runtimeEvent.correlationStatus,
              pairedEventId: runtimeEvent.pairedEventId,
              observedIntervalMs: runtimeEvent.observedIntervalMs,
              details: JSON.stringify(payload, null, 2),
            },
          },
          { silent: true },
        );
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [mode, addLog, updateRealSessionFromStatus]);

  // Toggle Telemetry Mode (Gateway vs Simulation)
  const handleToggleTelemetryMode = () => {
    if (wsState === "connected" || telemetryMode === "gateway") {
      telemetryBus.setForceSimulation(true);
      setTelemetryMode("simulation");
      setWsState("simulation");
      soundFx.playKeyClick();
      addLog({
        agentTag: "GATEWAY",
        agentColor: "amber",
        category: "system",
        message: "已平滑切换为: 实时仿真演练模式 (Simulation Mode)",
      });
    } else {
      telemetryBus.setForceSimulation(false);
      setTelemetryMode("gateway");
      telemetryBus.connect();
      soundFx.playKeyClick();
      addLog({
        agentTag: "GATEWAY",
        agentColor: "cyan",
        category: "system",
        message: "正在尝试重连本地网关: ws://localhost:7788/ws (带心跳探针)...",
      });
    }
  };

  // Trigger HITL Gatekeeper Block
  const triggerHitlBlock = (
    targetPath = "src/auth/oauth2.ts",
    riskScore = 96.4,
    cveOrRule = "OWASP-2026-A01: Sensitive Credential Mutation",
    summary = "检测到敏感文件修改行为，已自动挂起执行流并转入人工审核！",
    customDiff?: { filePath: string; oldCode: string; newCode: string },
  ) => {
    soundFx.playAlert();
    const reqId = "hitl-" + Math.random().toString(36).substr(2, 6);

    const hitlReq: HitlApprovalRequest = {
      id: reqId,
      timestamp: new Date().toTimeString().split(" ")[0],
      triggerType: "sensitive_file",
      targetPath,
      riskScore,
      cveOrRule,
      summary,
      detailedAudit: [
        `目标资产: ${targetPath} (被策略规则列为高危核心资产)`,
        `不变量威胁: 未经人工校验的令牌交换或生产配置变更可能导致凭证越权`,
        `防御要求: 必须由安全主管在控制平面核验 AST 差异并签署批准放行`,
      ],
      diffSnippet: customDiff || {
        filePath: targetPath,
        oldCode: targetPath.includes("k8s")
          ? "  instances: 1\n  storage: 50Gi"
          : "const token = await legacyVerify(req.query.code); // UNGUARDED",
        newCode: targetPath.includes("k8s")
          ? "  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager"
          : "const token = await secureOauthExchange(req.query.code, state); // ENFORCE PKCE",
      },
    };

    // Update active session to blocked
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, isBlocked: true, pendingHitl: hitlReq }
          : s,
      ),
    );

    // Update Advisor state
    setAdvisor((prev) => ({
      ...prev,
      status: "blocked",
      alertActive: true,
      riskScore,
      alertReason: summary,
      pendingHitl: hitlReq,
      checks: [
        {
          name: "eval() / Function() injection guard",
          status: "pass",
          detail: "Strict AST scan passed",
        },
        {
          name: "fs.writeFile mutation bounds (src/)",
          status: "fail",
          detail: `Blocked on ${targetPath}`,
        },
        {
          name: "OAuth credential exfiltration watcher",
          status: "fail",
          detail: "HITL Gatekeeper triggered",
        },
        {
          name: "Subagent AST patch consensus",
          status: "watching",
          detail: "Waiting for HITL manual approval",
        },
      ],
    }));

    addLog({
      agentTag: "HITL-GATE",
      agentColor: "rose",
      category: "hitl",
      riskLevel: "critical",
      message: `[操作热熔断] 目标文件: ${targetPath}，当前节点进入 [等待审批 / BLOCKED] 状态`,
      diffSnippet: hitlReq.diffSnippet,
    });
  };

  // HITL Action 1: Approve & Continue
  const handleApproveHitl = (reqId: string) => {
    soundFx.playChirp(1200, 0.08);
    telemetryBus.sendHitlDecision(reqId, "approve");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, isBlocked: false, pendingHitl: undefined }
          : s,
      ),
    );

    setAdvisor((prev) => ({
      ...prev,
      status: "standby",
      alertActive: false,
      riskScore: 0.4,
      alertReason: "",
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: "pass" })),
    }));

    addLog({
      agentTag: "SUPERVISOR",
      agentColor: "emerald",
      category: "hitl",
      message: `人工审批通过: REQ-${reqId} 已放行。执行流已恢复，下游工具与子智能体继续执行。`,
    });
  };

  // HITL Action 2: Rollback
  const handleRollbackHitl = (reqId: string) => {
    soundFx.playKeyClick();
    telemetryBus.sendHitlDecision(reqId, "rollback");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, isBlocked: false, pendingHitl: undefined }
          : s,
      ),
    );

    setAdvisor((prev) => ({
      ...prev,
      status: "standby",
      alertActive: false,
      riskScore: 0.6,
      alertReason: "",
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: "pass" })),
    }));

    addLog({
      agentTag: "SUPERVISOR",
      agentColor: "purple",
      category: "hitl",
      message: `人工拒绝并回滚: REQ-${reqId} 补丁已作废，操作已被网关安全终止。`,
    });
  };

  // HITL Action 3: Inject Prompt
  const handleInjectPromptHitl = (reqId: string, promptText: string) => {
    soundFx.playKeyClick();
    telemetryBus.sendHitlDecision(reqId, "inject", promptText);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              isBlocked: false,
              pendingHitl: undefined,
              directive: s.directive + ` [修订约束]: ${promptText}`,
            }
          : s,
      ),
    );

    setAdvisor((prev) => ({
      ...prev,
      status: "evaluating",
      alertActive: false,
      riskScore: 1.1,
      alertReason: "",
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: "watching" })),
    }));

    addLog({
      agentTag: "SUPERVISOR",
      agentColor: "cyan",
      category: "hitl",
      message: `已向 Agent 注入修订约束指令: "${promptText}"，触发安全重新推理。`,
    });
  };

  // Cross-Session HITL Approval
  const handleApproveSessionHitl = (sessionId: string) => {
    soundFx.playChirp(1200, 0.08);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, isBlocked: false, pendingHitl: undefined }
          : s,
      ),
    );
    if (sessionId === activeSessionId) {
      setAdvisor((prev) => ({
        ...prev,
        status: "standby",
        alertActive: false,
        riskScore: 0.4,
        alertReason: "",
        pendingHitl: undefined,
        checks: prev.checks.map((c) => ({ ...c, status: "pass" })),
      }));
    }
    addLog({
      agentTag: "SUPERVISOR",
      agentColor: "emerald",
      category: "hitl",
      message: `跨会话审批: 会话 [${sessionId}] 权限审核通过，零信任熔断已解除。`,
    });
  };

  // Add New Concurrent Session
  const handleAddSession = (newSess: Partial<SessionWorkspace>) => {
    soundFx.playChirp(880, 0.1);
    const newWorkspace: SessionWorkspace = {
      id: newSess.id || `sess-${Date.now().toString().slice(-4)}`,
      tag: newSess.tag || "#new-agent",
      title: newSess.title || "新增 Claude Code 实例",
      branch: newSess.branch || "main",
      activeFile: newSess.activeFile || "src/main.ts",
      step: 1,
      totalSteps: 5,
      directive: newSess.directive || "新并发任务初始化中...",
      activeDiff: {
        filePath: newSess.activeFile || "src/main.ts",
        oldCode: "// 原始基线",
        newCode: "// 独立沙箱已就绪...",
      },
      finOps: {
        burnRatePerMin: 0.12,
        burnTrend: [0.08, 0.1, 0.12],
        tokensUsed: 14200,
        maxTokens: 200000,
        watermarkPct: 7.1,
        cyclomaticComplexityDelta: 0,
        loopCircuitBreakerCount: 0,
        totalSessionCost: 0.045,
        historical60m: generate60mHistory(0.08, 0.18, "real", 0.12),
      },
      jev: {
        pInline: 0.3,
        pSubagents: 0.65,
        pEscalate: 0.05,
        entropy: 0.4,
        confidence: 0.95,
        monteCarloSamples: 5000,
        decisionRule: "ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS",
      },
      subagents: [
        {
          id: `sub-${Date.now()}-1`,
          name: "Worker #01",
          model: "Claude 3.5 Haiku",
          type: "worker",
          badge: "[New-Task]",
          status: "running",
          progress: 35,
          currentPayload: "AST Analysis and context ingestion",
          itemsProcessed: 3,
          totalItems: 8,
          frequencyHz: 125,
          sparkline: [10, 20, 28, 35],
        },
      ],
      isBlocked: false,
    };

    setSessions((prev) => [...prev, newWorkspace]);
    setActiveSessionId(newWorkspace.id);
    addLog({
      agentTag: "FLEET",
      agentColor: "cyan",
      category: "system",
      message: `已拉起并发 Claude Code 实例: [${newWorkspace.tag}]，已分配独立沙箱命名空间。`,
    });
  };

  const handlePauseSession = (sessionId: string) => {
    soundFx.playKeyClick();
    addLog({
      agentTag: "FLEET",
      agentColor: "amber",
      category: "system",
      message: `已发送挂起信号至会话 [${sessionId}]，暂停当前子进程与工具调用。`,
    });
  };

  // Trigger high-risk test button helper
  const handleTriggerHighRiskTest = (type = "auth") => {
    if (type === "k8s") {
      triggerHitlBlock(
        "k8s/prod-secrets.yaml",
        98.2,
        "RULE-K8S-04: Production Secrets Alteration",
        "检测到对生产命名空间机密文件 k8s/prod-secrets.yaml 的写操作，触发高危热熔断！",
        {
          filePath: "k8s/prod-secrets.yaml",
          oldCode: "  instances: 1\n  storage: 50Gi",
          newCode:
            "  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager",
        },
      );
    } else {
      triggerHitlBlock(
        "src/auth/oauth2.ts",
        96.4,
        "CVE-2026-AUTH: OAuth2 State CSRF Vulnerability",
        "检测到敏感核心认证模块修改，未绑定 PKCE 参数，触发高危热熔断！",
      );
    }
  };

  // One-click Setup Claude Hooks
  const handleInjectClaudeHooks = async () => {
    soundFx.playKeyClick();
    try {
      const res = await telemetryBus.setupClaudeHooks();
      setHasClaudeHooks(true);
      addLog({
        agentTag: "GATEWAY",
        agentColor: "emerald",
        category: "system",
        message: `成功注入 Claude Code 配置文件: ${res.settingsPath}！现在在终端运行 claude 即可直接拦截。`,
      });
    } catch (err: any) {
      addLog({
        agentTag: "GATEWAY",
        agentColor: "rose",
        category: "alert",
        message: `注入配置失败: ${err.message}`,
      });
    }
  };

  // One-click Test Real Hook
  const handleTriggerRealTest = async (risk: "high" | "normal") => {
    soundFx.playChirp(880);
    try {
      addLog({
        agentTag: "TEST-BUS",
        agentColor: "cyan",
        category: "system",
        message: `正在向 /hook/pre 发送真实 ${risk === "high" ? "高危修改 (auth.ts)" : "常规命令 (git status)"} 测试调用...`,
      });
      await telemetryBus.triggerRealTest(risk);
    } catch (err: any) {
      addLog({
        agentTag: "TEST-BUS",
        agentColor: "rose",
        category: "alert",
        message: `测试调用失败: ${err.message}`,
      });
    }
  };

  // Black Box & 3D Visualizer Handlers
  const handleBlackBoxPromptInject = (promptText: string) => {
    addLog({
      agentTag: "SUPERVISOR",
      agentColor: "purple",
      category: "system",
      message: `[黑盒透视] 已向工作区智能体注入动态提示词: "${promptText.slice(0, 60)}..."`,
    });
  };

  const handleBlackBoxHookTest = (type: "pre" | "post" | "blocked") => {
    handleTriggerRealTest(type === "blocked" ? "high" : "normal");
  };

  const handleBlackBoxDenial = () => {
    handleTriggerHighRiskTest("auth");
  };

  // Session Switching
  const handleSelectSession = (id: string) => {
    soundFx.playKeyClick();
    setActiveSessionId(id);
    const target = sessions.find((s) => s.id === id);
    if (target) {
      if (target.isBlocked && target.pendingHitl) {
        setAdvisor((prev) => ({
          ...prev,
          status: "blocked",
          alertActive: true,
          riskScore: target.pendingHitl!.riskScore,
          pendingHitl: target.pendingHitl,
        }));
      } else {
        setAdvisor((prev) => ({
          ...prev,
          status: "standby",
          alertActive: false,
          riskScore: target.isRealWorkspace ? 0.4 : 0.8,
          pendingHitl: undefined,
        }));
      }

      addLog({
        agentTag: "SESSION",
        agentColor: "cyan",
        category: "system",
        message: `已切换活跃会话至: ${target.tag} (${target.title})`,
      });
    }
  };

  // Inject Simulated Tool Call into active session
  const injectToolCall = (toolType = "bash") => {
    let toolName = "Bash";
    let args = "git status --porcelain";
    let tag = mode === "codex" ? "CODEX-1" : "SONNET";

    if (toolType === "file_edit") {
      toolName = "FileEdit";
      args = activeSession.activeFile;
    } else if (toolType === "grep") {
      toolName = "Grep";
      args = 'pattern="OAuth2Callback" path="src/**/*.ts"';
    } else if (toolType === "ast") {
      toolName = "ASTParse";
      args = `ts.createSourceFile("${activeSession.activeFile}")`;
      tag = "HAIKU-AST";
    }

    addLog({
      agentTag: tag,
      agentColor: tag === "HAIKU-AST" ? "emerald" : "amber",
      category: "tool",
      message: `已调度工具调用 [${toolName}]`,
      toolCall: {
        name: toolName,
        args,
        status: "completed",
        durationMs: Math.floor(Math.random() * 80) + 18,
      },
    });

    // Advance session tokens and cost
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const nextTokens = Math.min(
            s.finOps.tokensUsed + 1840,
            s.finOps.maxTokens,
          );
          return {
            ...s,
            finOps: {
              ...s.finOps,
              tokensUsed: nextTokens,
              watermarkPct: +((nextTokens / s.finOps.maxTokens) * 100).toFixed(
                1,
              ),
              totalSessionCost: +(s.finOps.totalSessionCost + 0.003).toFixed(3),
            },
          };
        }
        return s;
      }),
    );
  };

  // Trigger individual subagent tick
  const triggerWorkerTick = (id: string) => {
    soundFx.playChirp(840);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            subagents: s.subagents.map((agent) => {
              if (agent.id === id) {
                const nextProgress =
                  agent.progress >= 100
                    ? 25
                    : Math.min(agent.progress + 15, 100);
                return {
                  ...agent,
                  progress: nextProgress,
                  itemsProcessed:
                    agent.progress >= 100 ? 1 : agent.itemsProcessed + 1,
                  sparkline: [...agent.sparkline.slice(1), nextProgress],
                };
              }
              return agent;
            }),
          };
        }
        return s;
      }),
    );
  };

  // Restart all subagents for current session
  const restartSubagents = () => {
    soundFx.playChirp(960);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            subagents: s.subagents.map((agent) => ({
              ...agent,
              progress: 10,
              itemsProcessed: 1,
            })),
          };
        }
        return s;
      }),
    );
    addLog({
      agentTag: "DISPATCHER",
      agentColor: "emerald",
      category: "system",
      message: `已重置会话 ${activeSession.tag} 的 3 路子智能体缓冲区。`,
    });
  };

  // Recalculate JEV
  const recalculateJev = () => {
    soundFx.playChirp(680);
    const pSub = +(0.78 + Math.random() * 0.08).toFixed(2);
    const pIn = +(0.12 + Math.random() * 0.05).toFixed(2);
    const pEsc = +(1.0 - (pSub + pIn)).toFixed(2);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            jev: {
              ...s.jev,
              pInline: pIn,
              pSubagents: pSub,
              pEscalate: pEsc,
              entropy: +(0.38 + Math.random() * 0.08).toFixed(3),
              confidence: +(0.94 + Math.random() * 0.04).toFixed(3),
            },
          };
        }
        return s;
      }),
    );
    addLog({
      agentTag: "JEV-ROUTER",
      agentColor: "cyan",
      category: "router",
      message: `蒙特卡洛 JEV 重新收敛: P(subagents)=${Math.round(pSub * 100)}%, P(inline)=${Math.round(pIn * 100)}%`,
    });
  };

  // Custom CLI command parser (Handles internal control + executes REAL shell commands on host)
  const handleExecuteCli = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    const lower = cmd.toLowerCase();
    soundFx.playKeyClick();

    if (lower === "help") {
      addLog({
        agentTag: "CLI",
        agentColor: "cyan",
        category: "system",
        message:
          "控制平面指令:\n• 控制指令: approve, rollback, session [real|1|2|3], alert, clear, tui\n• 真实终端: git status, git diff, git branch, ls -la, pwd, npm test (直接在本地工作区执行)",
      });
      return;
    } else if (lower === "approve") {
      if (activeSession.pendingHitl) {
        handleApproveHitl(activeSession.pendingHitl.id);
      } else {
        addLog({
          agentTag: "CLI",
          agentColor: "amber",
          category: "system",
          message: "当前会话未处于等待审批状态。",
        });
      }
      return;
    } else if (lower === "rollback") {
      if (activeSession.pendingHitl) {
        handleRollbackHitl(activeSession.pendingHitl.id);
      } else {
        addLog({
          agentTag: "CLI",
          agentColor: "amber",
          category: "system",
          message: "当前会话未处于等待审批状态。",
        });
      }
      return;
    } else if (lower.startsWith("session")) {
      if (lower.includes("real")) handleSelectSession("sess-real");
      else if (lower.includes("2")) handleSelectSession("sess-2");
      else if (lower.includes("3")) handleSelectSession("sess-3");
      else handleSelectSession("sess-1");
      return;
    } else if (lower.startsWith("prompt")) {
      const injected = cmd.replace(/^prompt\s*/i, "");
      if (activeSession.pendingHitl) {
        handleInjectPromptHitl(activeSession.pendingHitl.id, injected);
      } else {
        addLog({
          agentTag: "CLI",
          agentColor: "cyan",
          category: "system",
          message: `已注入提示词: ${injected}`,
        });
      }
      return;
    } else if (lower.startsWith("inject")) {
      if (lower.includes("edit")) injectToolCall("file_edit");
      else if (lower.includes("grep")) injectToolCall("grep");
      else if (lower.includes("ast")) injectToolCall("ast");
      else injectToolCall("bash");
      return;
    } else if (
      lower === "alert" ||
      lower.includes("risk") ||
      lower.includes("告警")
    ) {
      handleTriggerHighRiskTest("auth");
      return;
    } else if (lower.includes("mode codex")) {
      setMode("codex");
      return;
    } else if (lower.includes("mode claude")) {
      setMode("claude");
      return;
    } else if (lower.includes("mode hybrid")) {
      setMode("hybrid");
      return;
    } else if (lower.includes("clear")) {
      setLogs([]);
      return;
    } else if (lower.includes("tui")) {
      setIsTuiModalOpen(true);
      return;
    }

    // Default: Execute real shell command via backend API
    addLog({
      agentTag: "LOCAL-CLI",
      agentColor: "amber",
      category: "system",
      message: `正在执行真实命令: $ ${cmd} ...`,
    });

    try {
      const result = await telemetryBus.executeCommand(cmd);
      addLog({
        agentTag: "LOCAL-CLI",
        agentColor: result.exitCode === 0 ? "emerald" : "rose",
        category: "system",
        message: result.output || `(Exit code: ${result.exitCode})`,
      });

      // If git command modified files, refresh status
      if (cmd.startsWith("git")) {
        telemetryBus
          .fetchRealStatus()
          .then((st) => st && updateRealSessionFromStatus(st));
      }
    } catch (err: any) {
      addLog({
        agentTag: "LOCAL-CLI",
        agentColor: "rose",
        category: "alert",
        message: `命令执行失败: ${err.message}`,
      });
    }
  };

  // Background Simulation Tick (Only runs for simulation scenarios, NOT sess-real)
  useEffect(() => {
    if (
      !isStreaming ||
      activeSession.isBlocked ||
      activeSession.isRealWorkspace
    )
      return;
    const intervalTime = Math.max(2200 / speed, 600);

    const timer = setInterval(() => {
      // Advance active subagent progress
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId && !s.isBlocked && !s.isRealWorkspace) {
            return {
              ...s,
              subagents: s.subagents.map((agent) => {
                const next =
                  agent.progress >= 100
                    ? 30
                    : agent.progress + Math.floor(Math.random() * 6) + 2;
                return {
                  ...agent,
                  progress: next,
                  sparkline: [...agent.sparkline.slice(1), next],
                };
              }),
            };
          }
          return s;
        }),
      );

      // Random telemetry event for simulation
      if (Math.random() > 0.75) {
        const events = [
          {
            agentTag: "HAIKU-01",
            agentColor: "emerald",
            category: "ast" as const,
            message: `AST 访问器已扫描 ${activeSession.activeFile} 中 418 个节点，零语法报错`,
          },
          {
            agentTag: "JEV-ROUTER",
            agentColor: "cyan",
            category: "router" as const,
            message: "信息熵平衡稳定在 0.421 bit (蒙特卡洛 5,000 次分叉收敛)",
          },
          {
            agentTag: mode === "codex" ? "CODEX-1" : "SONNET",
            agentColor: "amber",
            category: "tool" as const,
            message: "KV 上下文缓存命中: 94.2% 提示词已命中高速缓存",
          },
        ];
        const chosen = events[Math.floor(Math.random() * events.length)];
        addLog(chosen);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [
    isStreaming,
    speed,
    activeSession.isBlocked,
    activeSession.isRealWorkspace,
    activeSessionId,
    mode,
    addLog,
    activeSession.activeFile,
  ]);

  if (window.location.pathname === "/codex/prototype") return <CodexSessionPrototype prototypeMode logs={logs} connectionState={wsState} realStatus={realStatus} />;
  if (window.location.pathname === "/codex/prototype/3d") return <Codex3DTopology prototypeMode logs={logs} />;
  const runtimeRoute = <RuntimeObservatoryRoute pathname={window.location.pathname} logs={logs} realStatus={realStatus} connectionState={wsState} historyByProvider={{ codex: { loaded: codexHistoryLoaded, error: codexHistoryError }, claude: { loaded: claudeHistoryLoaded, error: claudeHistoryError } }} language={language} onBack={() => { window.location.href = "/"; }} onClear={async (provider) => { const plugin = findRuntimePluginByPath(window.location.pathname); if (plugin?.provider === provider && plugin.clearRuntime) await plugin.clearRuntime(); setLogs((current) => current.filter((log) => log.runtimeEvent?.provider !== provider)); }} />;
  if (findRuntimePluginByPath(window.location.pathname) || window.location.pathname === "/claude/desktop") return runtimeRoute;

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-200 flex flex-col font-mono selection:bg-purple-900/60 selection:text-purple-200">
      {/* Top Zsh Terminal Header with WebSocket Status & Connect Local Agent Button */}
      <TerminalHeader
        mode={mode}
        onSetMode={(m) => {
          setMode(m);
          soundFx.playKeyClick();
        }}
        language={language}
        onToggleLanguage={() => {
          const next = language === "zh" ? "en" : "zh";
          setLanguage(next);
          soundFx.playKeyClick();
        }}
        wsState={wsState}
        telemetryMode={telemetryMode}
        onToggleTelemetryMode={handleToggleTelemetryMode}
        onOpenLocalAgentModal={() => setIsLocalAgentModalOpen(true)}
        isStreaming={isStreaming}
        onToggleStreaming={() => setIsStreaming(!isStreaming)}
        speed={speed}
        onChangeSpeed={() =>
          setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 0.5 : 1))
        }
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        alertActive={advisor.alertActive}
      />

      {/* Main Container */}
      <main className="relative flex-1 p-3 lg:p-4 max-w-[1600px] w-full mx-auto flex flex-col gap-3">
        {/* Global Multi-Session HITL Approval Alert (Surfaces if ANY background session is blocked) */}
        {sessions.some((s) => s.isBlocked) && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-rose-950/90 via-[#180812] to-amber-950/80 border border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.3)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-rose-200 animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚨</span>
              <div>
                <span className="font-bold text-rose-300">
                  {language === "zh"
                    ? "【全局多会话告警】检测到有并发实例处于零信任热熔断拦截状态！"
                    : "[FLEET ALERT] Concurrent session blocked by Zero-Trust Sentinel!"}
                </span>
                <div className="text-[11px] text-rose-300/80 mt-0.5">
                  {sessions
                    .filter((s) => s.isBlocked)
                    .map((s) => `实例 [${s.tag}] 目标文件: ${s.activeFile}`)
                    .join(" | ")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessions.find((s) => s.isBlocked) && (
                <>
                  <button
                    onClick={() => {
                      const blocked = sessions.find((s) => s.isBlocked);
                      if (blocked) handleSelectSession(blocked.id);
                    }}
                    className="px-3 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-rose-200 border border-rose-500/60 font-bold transition cursor-pointer"
                  >
                    {language === "zh" ? "🔍 切换聚焦该会话" : "Focus Session"}
                  </button>

                  <button
                    onClick={() => {
                      const blocked = sessions.find((s) => s.isBlocked);
                      if (blocked) handleApproveSessionHitl(blocked.id);
                    }}
                    className="px-3.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-[0_0_15px_rgba(244,63,94,0.5)] transition cursor-pointer"
                  >
                    {language === "zh"
                      ? "⚡ 一键快速放行授权"
                      : "Approve & Resume"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top Control Bar: Multi-Session Fleet Tabs + Executive View Mode Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-[#030713]/90 border border-cyan-900/50 p-2 rounded-xl backdrop-blur-md">
          {/* Multi-Session Fleet Tabs */}
          <div className="flex-1 overflow-x-auto">
            <SessionTabBar
              sessions={sessions}
              activeSessionId={activeSessionId}
              language={language}
              onSelectSession={handleSelectSession}
            />
          </div>

          {/* Clean Executive View Mode Switcher */}
          <div className="flex items-center gap-1 shrink-0 font-mono text-xs border-t lg:border-t-0 lg:border-l border-cyan-900/50 pt-2 lg:pt-0 lg:pl-3">
            <a
              href="/codex"
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 bg-emerald-950 text-emerald-200 border border-emerald-800 hover:border-emerald-400"
            >
              <CodexMark width={15} height={15} />
              <span>
                {language === "zh" ? "Codex 工作台" : "Codex Runtime"}
              </span>
            </a>
            <a
              href="/claude"
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 bg-amber-950/60 text-amber-200 border border-amber-800 hover:border-amber-400"
            >
              <ClaudeMark width={15} height={15} style={{color: '#D97757'}} />
              <span>{language === "zh" ? "Claude 观测站" : "Claude Observatory"}</span>
            </a>
            <a
              href="/claude/3d"
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 bg-amber-950/30 text-amber-200 border border-amber-900 hover:border-amber-400"
            >
              <ClaudeMark width={15} height={15} style={{color: '#D97757'}} />
              <span>{language === "zh" ? "Claude 3D" : "Claude 3D"}</span>
            </a>
            <button
              onClick={() => {
                soundFx.playKeyClick();
                setDashboardViewMode("conduit");
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dashboardViewMode === "conduit"
                  ? "bg-cyan-950 text-cyan-200 border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.35)]"
                  : "bg-black/50 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>⚡</span>
              <span>{language === "zh" ? "主体流转" : "Conduit"}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playKeyClick();
                setDashboardViewMode("3d-topology");
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dashboardViewMode === "3d-topology"
                  ? "bg-cyan-950 text-cyan-200 border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.35)]"
                  : "bg-black/50 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>🪐</span>
              <span>{language === "zh" ? "3D 真实拓扑" : "3D Topology"}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playKeyClick();
                setDashboardViewMode("fleet-matrix");
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dashboardViewMode === "fleet-matrix"
                  ? "bg-teal-950 text-teal-200 border border-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.35)]"
                  : "bg-black/50 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>🔲</span>
              <span>{language === "zh" ? "多会话矩阵" : "Fleet Matrix"}</span>
              <span className="px-1 py-0.2 rounded text-[9px] bg-teal-900/80 text-teal-300 font-bold">
                {sessions.length}
              </span>
            </button>

            <button
              onClick={() => {
                soundFx.playKeyClick();
                setDashboardViewMode("drill-down");
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dashboardViewMode === "drill-down"
                  ? "bg-purple-950 text-purple-200 border border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                  : "bg-black/50 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>🔍</span>
              <span>{language === "zh" ? "深度下钻" : "Drill-Down"}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playKeyClick();
                setDashboardViewMode("overview");
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dashboardViewMode === "overview"
                  ? "bg-indigo-950 text-indigo-200 border border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                  : "bg-black/50 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <span>📊</span>
              <span>{language === "zh" ? "经典全景" : "Overview"}</span>
            </button>
          </div>
        </div>

        {/* View Pane 1: Dynamic Flow Calling Conduit (主体流转入口) */}
        {dashboardViewMode === "conduit" && (
          <div className="flex flex-col gap-3">
            {/* FinOps & Code Quality Watermark Bar with D3 Line Chart */}
            <FinOpsBar
              metrics={activeSession.finOps}
              language={language}
              agentTag={activeSession.tag}
              isRealWorkspace={activeSession.isRealWorkspace}
            />

            <AgentDynamicFlowHero
              language={language}
              mode={mode}
              activeFile={activeSession.activeFile}
              directive={activeSession.directive}
              isBlocked={activeSession.isBlocked}
              isRealWorkspace={activeSession.isRealWorkspace}
              selectedStage={drillDownStage}
              onSelectStage={handleFlowStageSelected}
              onOpenDrillDown={(stage) => {
                setDrillDownStage(stage);
                setDashboardViewMode("drill-down");
                addLog({
                  agentTag: "DRILL-DOWN",
                  agentColor: "purple",
                  category: "system",
                  message: `触发阶段 [${stage.toUpperCase()}] 深度下钻解析面板`,
                });
              }}
              onTriggerTrace={() => {
                addLog({
                  agentTag: "PULSE-TRACE",
                  agentColor: "cyan",
                  category: "system",
                  message:
                    "动态流转脉冲已激发: 穿透任务输入、工具准备、AI 规划与安全执行",
                });
              }}
              onTriggerHook={() => {
                handleTriggerRealTest("normal");
              }}
              onTriggerDenial={() => {
                handleTriggerHighRiskTest("auth");
              }}
            />
          </div>
        )}

        {/* View Pane 2: Meaningful 3D Architecture Topology (3D 真实拓扑) */}
        {dashboardViewMode === "3d-topology" && (
          <div className="flex flex-col gap-3">
            <Agent3dArchitectureTopology
              language={language}
              mode={mode}
              connectionState={wsState}
              systemStatus={realStatus}
              workspaceName={activeSession.branch}
              activeStage={
                activeSession.isRealWorkspace
                  ? wsState === "connected"
                    ? observedTopologyStage
                    : undefined
                  : drillDownStage || "prompt"
              }
              isBlocked={activeSession.isBlocked}
              isRealWorkspace={activeSession.isRealWorkspace}
              onSelectStage={(stage) => {
                setDrillDownStage(stage);
                addLog({
                  agentTag: "3D-TOPOLOGY",
                  agentColor: "cyan",
                  category: "system",
                  message: `3D 空间架构已聚焦至基站: [${stage.toUpperCase()}]`,
                });
              }}
              onOpenDrillDown={(stage) => {
                setDrillDownStage(stage);
                setDashboardViewMode("drill-down");
                addLog({
                  agentTag: "DRILL-DOWN",
                  agentColor: "purple",
                  category: "system",
                  message: `从 3D 空间一键下钻至 [${stage.toUpperCase()}] 黑盒解析`,
                });
              }}
              onTriggerTrace={() => {
                addLog({
                  agentTag: "3D-PULSE",
                  agentColor: "cyan",
                  category: "system",
                  message: "已预览逻辑调用路径；动画不代表真实请求流量",
                });
              }}
              onTriggerHook={() => {
                handleTriggerRealTest("normal");
              }}
              onTriggerDenial={() => {
                handleTriggerHighRiskTest("auth");
              }}
            />
          </div>
        )}

        {/* View Pane 3: Multi-Session Concurrent Fleet Matrix (多会话并发矩阵) */}
        {dashboardViewMode === "fleet-matrix" && (
          <div className="flex flex-col gap-3">
            <MultiSessionFleetGrid
              sessions={sessions}
              activeSessionId={activeSessionId}
              language={language}
              onSelectSession={(id) => {
                handleSelectSession(id);
                addLog({
                  agentTag: "FLEET",
                  agentColor: "cyan",
                  category: "system",
                  message: `工作区焦点已切换至并发会话: [${id}]`,
                });
              }}
              onApproveSessionHitl={handleApproveSessionHitl}
              onAddSession={handleAddSession}
              onPauseSession={handlePauseSession}
            />
          </div>
        )}

        {/* View Pane 4: Black Box Deep Drill-Down Matrix (深度下钻面板) */}
        {dashboardViewMode === "drill-down" && (
          <div className="flex flex-col gap-3">
            <AgentBlackBoxMonitor
              language={language}
              mode={mode}
              activeFile={activeSession.activeFile}
              directive={activeSession.directive}
              isRealWorkspace={activeSession.isRealWorkspace}
              selectedDrillDownStage={drillDownStage}
              onSelectStage={(stage) => setDrillDownStage(stage)}
              onInjectPrompt={handleBlackBoxPromptInject}
              onTriggerHookTest={handleBlackBoxHookTest}
              onSimulateDenial={handleBlackBoxDenial}
            />
          </div>
        )}

        {/* View Pane 5: Classic Overview (12-Col Workspace Panels Grid) */}
        {dashboardViewMode === "overview" && (
          <div className="flex flex-col gap-3">
            <FinOpsBar
              metrics={activeSession.finOps}
              language={language}
              agentTag={activeSession.tag}
              isRealWorkspace={activeSession.isRealWorkspace}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 relative z-20">
              {/* Left 4 Cols: Purple Dashed Advisor (Opus / o3-pro) with HITL Gatekeeper */}
              <div className="lg:col-span-4 flex flex-col">
                <AdvisorPanel
                  advisor={advisor}
                  mode={mode}
                  language={language}
                  onAuthorizePatch={() => handleApproveHitl("quick")}
                  onDismissAlert={() => handleRollbackHitl("dismiss")}
                  onTriggerAlert={() => handleTriggerHighRiskTest("auth")}
                  onApproveHitl={handleApproveHitl}
                  onRollbackHitl={handleRollbackHitl}
                  onInjectPromptHitl={handleInjectPromptHitl}
                  onTriggerHighRiskTest={handleTriggerHighRiskTest}
                />
              </div>

              {/* Right 8 Cols: Main Session & Haiku Subagents */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                <MainSessionPanel
                  mode={mode}
                  language={language}
                  step={activeSession.step}
                  totalSteps={activeSession.totalSteps}
                  tokensUsed={activeSession.finOps.tokensUsed}
                  maxTokens={activeSession.finOps.maxTokens}
                  activeFile={activeSession.activeFile}
                  activeDiff={activeSession.activeDiff}
                  goal={activeSession.directive}
                  branch={activeSession.branch}
                  sessionTag={activeSession.tag}
                  isBlocked={activeSession.isBlocked}
                  isRealWorkspace={activeSession.isRealWorkspace}
                  realCwd={realStatus?.cwd}
                  realCommit={realStatus?.gitRecentCommit}
                  realModifiedFiles={realStatus?.modifiedFiles}
                  hasClaudeHooks={hasClaudeHooks}
                />

                <SubagentsDispatcherPanel
                  mode={mode}
                  language={language}
                  subagents={activeSession.subagents}
                  onTriggerWorker={triggerWorkerTick}
                  onRestartAll={restartSubagents}
                />
              </div>
            </div>
          </div>
        )}

        {/* Interactive CLI Prompt Bar with Buttons & Text Input */}
        <div className="mt-1">
          <InteractiveCliBar
            mode={mode}
            language={language}
            isBlocked={activeSession.isBlocked}
            hasClaudeHooks={hasClaudeHooks}
            onApproveHitl={() =>
              activeSession.pendingHitl &&
              handleApproveHitl(activeSession.pendingHitl.id)
            }
            onRollbackHitl={() =>
              activeSession.pendingHitl &&
              handleRollbackHitl(activeSession.pendingHitl.id)
            }
            onToggleMode={() =>
              setMode((m) => (m === "claude" ? "codex" : "claude"))
            }
            onInjectToolCall={injectToolCall}
            onTriggerAlert={() => handleTriggerHighRiskTest("auth")}
            onRestartSubagents={restartSubagents}
            onClearLogs={() => setLogs([])}
            onOpenTuiModal={() => setIsTuiModalOpen(true)}
            onExecuteCustomCommand={handleExecuteCli}
            onInjectClaudeHooks={handleInjectClaudeHooks}
            onTriggerRealTest={handleTriggerRealTest}
          />
        </div>

        {/* Live Session Log Stream with Timestamps, Diffs, and Probabilities */}
        <div className="mt-1">
          <LiveSessionLog
            logs={logs}
            language={language}
            onClearLogs={() => setLogs([])}
            onSelectLog={(log) => {
              if (log.diffSnippet) {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === activeSessionId
                      ? { ...s, activeDiff: log.diffSnippet! }
                      : s,
                  ),
                );
              }
            }}
          />
        </div>
      </main>

      {/* Native TUI Script (.py) Viewer / Downloader Modal */}
      <NativeTuiModal
        isOpen={isTuiModalOpen}
        language={language}
        onClose={() => setIsTuiModalOpen(false)}
      />

      {/* Connect Local Agent Modal (gateway.py, settings.json, codex-wrapper.sh) */}
      <LocalAgentModal
        isOpen={isLocalAgentModalOpen}
        language={language}
        onClose={() => setIsLocalAgentModalOpen(false)}
      />
    </div>
  );
}
