/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from './types/matrix';
import { Language, translations } from './i18n/translations';
import { TerminalHeader } from './components/TerminalHeader';
import { SessionTabBar } from './components/SessionTabBar';
import { FinOpsBar } from './components/FinOpsBar';
import { AdvisorPanel } from './components/AdvisorPanel';
import { MainSessionPanel } from './components/MainSessionPanel';
import { JevRouterPanel } from './components/JevRouterPanel';
import { SubagentsDispatcherPanel } from './components/SubagentsDispatcherPanel';
import { LiveSessionLog } from './components/LiveSessionLog';
import { InteractiveCliBar } from './components/InteractiveCliBar';
import { NeuralConnectors } from './components/NeuralConnectors';
import { NativeTuiModal } from './components/NativeTuiModal';
import { LocalAgentModal } from './components/LocalAgentModal';
import { telemetryBus } from './services/websocket';
import { soundFx } from './utils/audio';

export default function App() {
  const [language, setLanguage] = useState<Language>('zh');
  const [mode, setMode] = useState<MatrixMode>('claude');
  const [telemetryMode, setTelemetryMode] = useState<TelemetryMode>('simulation');
  const [wsState, setWsState] = useState<WsConnectionState>('simulation');
  const [isStreaming, setIsStreaming] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTuiModalOpen, setIsTuiModalOpen] = useState(false);
  const [isLocalAgentModalOpen, setIsLocalAgentModalOpen] = useState(false);

  // Multi-Session Fleet Workspaces
  const [sessions, setSessions] = useState<SessionWorkspace[]>([
    {
      id: 'sess-1',
      tag: '#1 auth-oauth-refactor',
      title: 'OAuth2 零信任安全重构',
      branch: 'feat/neural-auth',
      activeFile: 'src/auth/oauth2.ts',
      step: 4,
      totalSteps: 9,
      directive:
        '重构认证链路为零信任 OAuth2 架构，集成 PKCE 状态参数校验、AST 语法树自动转换及并行回归套件验证。',
      activeDiff: {
        filePath: 'src/auth/oauth2.ts',
        oldCode: 'const token = await legacyVerify(req.query.code);',
        newCode: 'const token = await secureOauthExchange(req.query.code, state);',
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
      },
      jev: {
        pInline: 0.14,
        pSubagents: 0.82,
        pEscalate: 0.04,
        entropy: 0.428,
        confidence: 0.962,
        monteCarloSamples: 5000,
        decisionRule: 'ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS',
      },
      subagents: [
        {
          id: 'sub-01',
          name: 'Worker #01',
          model: 'Claude 3.5 Haiku',
          type: 'worker',
          badge: '[AST]',
          status: 'streaming',
          progress: 89,
          currentPayload: 'Synthesizing AST Node visitor for PKCE token validation in src/auth/oauth2.ts',
          itemsProcessed: 14,
          totalItems: 14,
          frequencyHz: 142.4,
          sparkline: [40, 55, 60, 78, 89],
        },
        {
          id: 'sub-02',
          name: 'Explorer #02',
          model: 'Claude 3.5 Haiku',
          type: 'explorer',
          badge: '[docs]',
          status: 'running',
          progress: 68,
          currentPayload: 'Semantic grep across RFC 7636 PKCE spec & local authorization callbacks',
          itemsProcessed: 4,
          totalItems: 6,
          frequencyHz: 98.1,
          sparkline: [20, 35, 45, 60, 68],
        },
        {
          id: 'sub-03',
          name: 'Researcher #03',
          model: 'Claude 3.5 Haiku',
          type: 'researcher',
          badge: '[112/112]',
          status: 'complete',
          progress: 100,
          currentPayload: 'Running Vitest fuzz regression matrix: 112/112 test suites passing',
          itemsProcessed: 112,
          totalItems: 112,
          frequencyHz: 164.0,
          sparkline: [50, 75, 90, 100, 100],
        },
      ],
      isBlocked: false,
    },
    {
      id: 'sess-2',
      tag: '#2 k8s-cnpg-scaling',
      title: 'CloudNative-PG 伸缩与调度',
      branch: 'ops/cnpg-ha-prod',
      activeFile: 'k8s/prod-secrets.yaml',
      step: 2,
      totalSteps: 6,
      directive:
        '升级生产级 CloudNative-PG 集群拓扑，配置跨可用区拓扑分布约束 (PodAntiAffinity) 与 KMS 加密卷动态轮转。',
      activeDiff: {
        filePath: 'k8s/prod-secrets.yaml',
        oldCode: '  instances: 1\n  storage: 50Gi',
        newCode: '  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager',
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
      },
      jev: {
        pInline: 0.25,
        pSubagents: 0.68,
        pEscalate: 0.07,
        entropy: 0.512,
        confidence: 0.914,
        monteCarloSamples: 4200,
        decisionRule: 'ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS',
      },
      subagents: [
        {
          id: 'sub-21',
          name: 'Worker #01',
          model: 'Claude 3.5 Haiku',
          type: 'worker',
          badge: '[K8s-AST]',
          status: 'running',
          progress: 54,
          currentPayload: 'Generating CloudNative-PG CRD Manifest with Anti-Affinity rules',
          itemsProcessed: 3,
          totalItems: 5,
          frequencyHz: 120.0,
          sparkline: [20, 30, 45, 50, 54],
        },
        {
          id: 'sub-22',
          name: 'Explorer #02',
          model: 'Claude 3.5 Haiku',
          type: 'explorer',
          badge: '[CRD]',
          status: 'running',
          progress: 72,
          currentPayload: 'Validating against CloudNative-PG Operator v1.24 API schema',
          itemsProcessed: 7,
          totalItems: 8,
          frequencyHz: 105.0,
          sparkline: [30, 40, 55, 65, 72],
        },
        {
          id: 'sub-23',
          name: 'Researcher #03',
          model: 'Claude 3.5 Haiku',
          type: 'researcher',
          badge: '[kubeval]',
          status: 'complete',
          progress: 100,
          currentPayload: 'Dry-run kubeval linting passed across 4 cluster namespaces',
          itemsProcessed: 4,
          totalItems: 4,
          frequencyHz: 150.0,
          sparkline: [40, 60, 80, 100, 100],
        },
      ],
      isBlocked: false,
    },
    {
      id: 'sess-3',
      tag: '#3 doris-sql-opt',
      title: 'Doris 分布式物化视图调优',
      branch: 'perf/doris-mview',
      activeFile: 'sql/views/mview_orders_daily.sql',
      step: 5,
      totalSteps: 8,
      directive:
        '针对 TB 级订单聚合查询改写分桶剪枝逻辑，构建异步物化视图以削减 85% Scan Bytes。',
      activeDiff: {
        filePath: 'sql/views/mview_orders_daily.sql',
        oldCode: 'SELECT user_id, sum(amount) FROM raw_events GROUP BY user_id;',
        newCode: 'CREATE MATERIALIZED VIEW mv_user_agg AS SELECT user_id, sum(amount) FROM raw_events GROUP BY user_id;',
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
      },
      jev: {
        pInline: 0.45,
        pSubagents: 0.52,
        pEscalate: 0.03,
        entropy: 0.385,
        confidence: 0.98,
        monteCarloSamples: 6000,
        decisionRule: 'ARGMAX[ JEV ] => DELEGATE_TRIPLE_SUBAGENTS',
      },
      subagents: [
        {
          id: 'sub-31',
          name: 'Worker #01',
          model: 'Claude 3.5 Haiku',
          type: 'worker',
          badge: '[SQL-AST]',
          status: 'complete',
          progress: 100,
          currentPayload: 'Rewriting partition projection into Doris vectorized engine format',
          itemsProcessed: 18,
          totalItems: 18,
          frequencyHz: 160.0,
          sparkline: [50, 70, 85, 95, 100],
        },
        {
          id: 'sub-32',
          name: 'Explorer #02',
          model: 'Claude 3.5 Haiku',
          type: 'explorer',
          badge: '[EXPLAIN]',
          status: 'running',
          progress: 81,
          currentPayload: 'Simulating query plan cost matrix across 10 BE nodes',
          itemsProcessed: 9,
          totalItems: 10,
          frequencyHz: 110.0,
          sparkline: [35, 50, 65, 75, 81],
        },
        {
          id: 'sub-33',
          name: 'Researcher #03',
          model: 'Claude 3.5 Haiku',
          type: 'researcher',
          badge: '[Benchmark]',
          status: 'streaming',
          progress: 60,
          currentPayload: 'Running TPC-H query 03 benchmark: latency dropped 820ms -> 68ms',
          itemsProcessed: 3,
          totalItems: 5,
          frequencyHz: 135.0,
          sparkline: [20, 30, 45, 55, 60],
        },
      ],
      isBlocked: false,
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState('sess-1');
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Advisor State
  const [advisor, setAdvisor] = useState<AdvisorState>({
    model: 'Claude 3.7 Opus',
    status: 'standby',
    riskScore: 0.8,
    riskCeiling: 2.0, // Strict 2.0% ceiling per prompt
    alertActive: false,
    alertReason: '',
    checks: [
      { name: 'eval() / Function() injection guard', status: 'pass', detail: 'Strict AST scan passed' },
      { name: 'fs.writeFile mutation bounds (src/)', status: 'pass', detail: 'Scoped within repository root' },
      { name: 'OAuth credential exfiltration watcher', status: 'pass', detail: 'Zero token leaks detected' },
      { name: 'Subagent AST patch consensus', status: 'pass', detail: '3/3 signatures verified' },
    ],
  });

  // Live Session Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-01',
      timestamp: '23:45:01',
      agentTag: 'SYSTEM',
      agentColor: 'cyan',
      category: 'system',
      message: 'AI 智能体控制平面与安全审计网关已初始化 (Control Plane v2.4)',
    },
    {
      id: 'log-02',
      timestamp: '23:45:04',
      agentTag: 'GATEKEEPER',
      agentColor: 'purple',
      category: 'hitl',
      message: 'HITL 熔断规则已激活: 监控 auth.ts / prod-secrets.yaml / Risk > 2.0%',
    },
    {
      id: 'log-03',
      timestamp: '23:45:08',
      agentTag: 'SONNET',
      agentColor: 'amber',
      category: 'system',
      message: '已挂载并发工作区 #1 auth-oauth-refactor (PID: 88412, Context: 182.4k)',
    },
    {
      id: 'log-04',
      timestamp: '23:45:12',
      agentTag: 'JEV-ROUTER',
      agentColor: 'cyan',
      category: 'router',
      message: 'JEV 分叉裁决: 并行子智能体集群调度 (P=0.82) 胜出',
      probabilities: { pInline: 0.14, pSubagents: 0.82, pEscalate: 0.04 },
    },
  ]);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newEntry: LogEntry = {
      ...entry,
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      timestamp: timeStr,
    };
    setLogs((prev) => [...prev.slice(-50), newEntry]);
    if (entry.riskLevel === 'critical' || entry.category === 'hitl') {
      soundFx.playAlert();
    } else {
      soundFx.playChirp(entry.agentColor === 'amber' ? 920 : 740);
    }
  }, []);

  // Sync Audio Mute
  useEffect(() => {
    soundFx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Subscribe to WebSocket Telemetry Bus
  useEffect(() => {
    const unsubState = telemetryBus.onStateChange((newState) => {
      setWsState(newState);
      if (newState === 'connected') {
        setTelemetryMode('gateway');
        addLog({
          agentTag: 'GATEWAY',
          agentColor: 'emerald',
          category: 'system',
          message: '已成功与本地 7788 遥测网关建立 WebSocket 握手 (ws://localhost:7788/ws)',
        });
      }
    });

    const unsubEvents = telemetryBus.subscribe((event) => {
      if (event.type === 'hitl_blocked') {
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
          payload.diffSnippet
        );
      } else if (event.type === 'tool_call') {
        const p = event.payload as { name: string; args: string };
        addLog({
          agentTag: mode === 'codex' ? 'CODEX-CLI' : 'CLAUDE-CODE',
          agentColor: 'amber',
          category: 'tool',
          message: `[网关实时工具调用] ${p.name}`,
          toolCall: {
            name: p.name,
            args: p.args,
            status: 'completed',
            durationMs: 45,
          },
        });
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [mode, addLog]);

  // Toggle Telemetry Mode (Gateway vs Simulation)
  const handleToggleTelemetryMode = () => {
    if (wsState === 'connected' || telemetryMode === 'gateway') {
      telemetryBus.setForceSimulation(true);
      setTelemetryMode('simulation');
      setWsState('simulation');
      soundFx.playKeyClick();
      addLog({
        agentTag: 'GATEWAY',
        agentColor: 'amber',
        category: 'system',
        message: '已平滑切换为: 实时仿真演练模式 (Simulation Mode)',
      });
    } else {
      telemetryBus.setForceSimulation(false);
      setTelemetryMode('gateway');
      telemetryBus.connect();
      soundFx.playKeyClick();
      addLog({
        agentTag: 'GATEWAY',
        agentColor: 'cyan',
        category: 'system',
        message: '正在尝试重连本地网关: ws://localhost:7788/ws (带心跳探针)...',
      });
    }
  };

  // Trigger HITL Gatekeeper Block
  const triggerHitlBlock = (
    targetPath = 'src/auth/oauth2.ts',
    riskScore = 96.4,
    cveOrRule = 'OWASP-2026-A01: Sensitive Credential Mutation',
    summary = '检测到敏感文件修改行为，已自动挂起执行流并转入人工审核！',
    customDiff?: { filePath: string; oldCode: string; newCode: string }
  ) => {
    soundFx.playAlert();
    const reqId = 'hitl-' + Math.random().toString(36).substr(2, 6);

    const hitlReq: HitlApprovalRequest = {
      id: reqId,
      timestamp: new Date().toTimeString().split(' ')[0],
      triggerType: 'sensitive_file',
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
        oldCode:
          targetPath.includes('k8s')
            ? '  instances: 1\n  storage: 50Gi'
            : 'const token = await legacyVerify(req.query.code); // UNGUARDED',
        newCode:
          targetPath.includes('k8s')
            ? '  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager'
            : 'const token = await secureOauthExchange(req.query.code, state); // ENFORCE PKCE',
      },
    };

    // Update active session to blocked
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, isBlocked: true, pendingHitl: hitlReq } : s))
    );

    // Update Advisor state
    setAdvisor((prev) => ({
      ...prev,
      status: 'blocked',
      alertActive: true,
      riskScore,
      alertReason: summary,
      pendingHitl: hitlReq,
      checks: [
        { name: 'eval() / Function() injection guard', status: 'pass', detail: 'Strict AST scan passed' },
        { name: 'fs.writeFile mutation bounds (src/)', status: 'fail', detail: `Blocked on ${targetPath}` },
        { name: 'OAuth credential exfiltration watcher', status: 'fail', detail: 'HITL Gatekeeper triggered' },
        { name: 'Subagent AST patch consensus', status: 'watching', detail: 'Waiting for HITL manual approval' },
      ],
    }));

    addLog({
      agentTag: 'HITL-GATE',
      agentColor: 'rose',
      category: 'hitl',
      riskLevel: 'critical',
      message: `[操作热熔断] 目标文件: ${targetPath}，当前节点进入 [等待审批 / BLOCKED] 状态`,
      diffSnippet: hitlReq.diffSnippet,
    });
  };

  // HITL Action 1: Approve & Continue
  const handleApproveHitl = (reqId: string) => {
    soundFx.playChirp(1200, 0.08);
    telemetryBus.sendHitlDecision(reqId, 'approve');

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, isBlocked: false, pendingHitl: undefined } : s))
    );

    setAdvisor((prev) => ({
      ...prev,
      status: 'standby',
      alertActive: false,
      riskScore: 0.4,
      alertReason: '',
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: 'pass' })),
    }));

    addLog({
      agentTag: 'SUPERVISOR',
      agentColor: 'emerald',
      category: 'hitl',
      message: `人工审批通过: REQ-${reqId} 已放行。执行流已恢复，下游子智能体继续执行。`,
    });
  };

  // HITL Action 2: Rollback
  const handleRollbackHitl = (reqId: string) => {
    soundFx.playKeyClick();
    telemetryBus.sendHitlDecision(reqId, 'rollback');

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, isBlocked: false, pendingHitl: undefined } : s))
    );

    setAdvisor((prev) => ({
      ...prev,
      status: 'standby',
      alertActive: false,
      riskScore: 0.6,
      alertReason: '',
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: 'pass' })),
    }));

    addLog({
      agentTag: 'SUPERVISOR',
      agentColor: 'purple',
      category: 'hitl',
      message: `人工拒绝并回滚: REQ-${reqId} 补丁已作废，代码已安全回退至上一个干净 AST 快照。`,
    });
  };

  // HITL Action 3: Inject Prompt
  const handleInjectPromptHitl = (reqId: string, promptText: string) => {
    soundFx.playKeyClick();
    telemetryBus.sendHitlDecision(reqId, 'inject', promptText);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              isBlocked: false,
              pendingHitl: undefined,
              directive: s.directive + ` [修订约束]: ${promptText}`,
            }
          : s
      )
    );

    setAdvisor((prev) => ({
      ...prev,
      status: 'evaluating',
      alertActive: false,
      riskScore: 1.1,
      alertReason: '',
      pendingHitl: undefined,
      checks: prev.checks.map((c) => ({ ...c, status: 'watching' })),
    }));

    addLog({
      agentTag: 'SUPERVISOR',
      agentColor: 'cyan',
      category: 'hitl',
      message: `已向 Agent 注入修订约束指令: "${promptText}"，触发重新推理。`,
    });
  };

  // Trigger high-risk test button helper
  const handleTriggerHighRiskTest = (type = 'auth') => {
    if (type === 'k8s') {
      triggerHitlBlock(
        'k8s/prod-secrets.yaml',
        98.2,
        'RULE-K8S-04: Production Secrets Alteration',
        '检测到对生产命名空间机密文件 k8s/prod-secrets.yaml 的写操作，触发高危热熔断！',
        {
          filePath: 'k8s/prod-secrets.yaml',
          oldCode: '  instances: 1\n  storage: 50Gi',
          newCode: '  instances: 3\n  storage: 200Gi\n  kmsSecretProvider: aws-secrets-manager',
        }
      );
    } else {
      triggerHitlBlock(
        'src/auth/oauth2.ts',
        96.4,
        'CVE-2026-AUTH: OAuth2 State CSRF Vulnerability',
        '检测到敏感核心认证模块修改，未绑定 PKCE 参数，触发高危热熔断！'
      );
    }
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
          status: 'blocked',
          alertActive: true,
          riskScore: target.pendingHitl!.riskScore,
          pendingHitl: target.pendingHitl,
        }));
      } else {
        setAdvisor((prev) => ({
          ...prev,
          status: 'standby',
          alertActive: false,
          riskScore: 0.8,
          pendingHitl: undefined,
        }));
      }

      addLog({
        agentTag: 'SESSION',
        agentColor: 'cyan',
        category: 'system',
        message: `已切换活跃会话至: ${target.tag} (${target.title})`,
      });
    }
  };

  // Inject Simulated Tool Call into active session
  const injectToolCall = (toolType = 'bash') => {
    let toolName = 'Bash';
    let args = 'git status --porcelain';
    let tag = mode === 'codex' ? 'CODEX-1' : 'SONNET';

    if (toolType === 'file_edit') {
      toolName = 'FileEdit';
      args = activeSession.activeFile;
    } else if (toolType === 'grep') {
      toolName = 'Grep';
      args = 'pattern="OAuth2Callback" path="src/**/*.ts"';
    } else if (toolType === 'ast') {
      toolName = 'ASTParse';
      args = `ts.createSourceFile("${activeSession.activeFile}")`;
      tag = 'HAIKU-AST';
    }

    addLog({
      agentTag: tag,
      agentColor: tag === 'HAIKU-AST' ? 'emerald' : 'amber',
      category: 'tool',
      message: `已调度工具调用 [${toolName}]`,
      toolCall: {
        name: toolName,
        args,
        status: 'completed',
        durationMs: Math.floor(Math.random() * 80) + 18,
      },
    });

    // Advance session tokens and cost
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const nextTokens = Math.min(s.finOps.tokensUsed + 1840, s.finOps.maxTokens);
          return {
            ...s,
            finOps: {
              ...s.finOps,
              tokensUsed: nextTokens,
              watermarkPct: +((nextTokens / s.finOps.maxTokens) * 100).toFixed(1),
              totalSessionCost: +(s.finOps.totalSessionCost + 0.003).toFixed(3),
            },
          };
        }
        return s;
      })
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
                const nextProgress = agent.progress >= 100 ? 25 : Math.min(agent.progress + 15, 100);
                return {
                  ...agent,
                  progress: nextProgress,
                  itemsProcessed: agent.progress >= 100 ? 1 : agent.itemsProcessed + 1,
                  sparkline: [...agent.sparkline.slice(1), nextProgress],
                };
              }
              return agent;
            }),
          };
        }
        return s;
      })
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
      })
    );
    addLog({
      agentTag: 'DISPATCHER',
      agentColor: 'emerald',
      category: 'system',
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
      })
    );
    addLog({
      agentTag: 'JEV-ROUTER',
      agentColor: 'cyan',
      category: 'router',
      message: `蒙特卡洛 JEV 重新收敛: P(subagents)=${Math.round(pSub * 100)}%, P(inline)=${Math.round(pIn * 100)}%`,
    });
  };

  // Custom CLI command parser
  const handleExecuteCli = (rawCmd: string) => {
    const cmd = rawCmd.toLowerCase();
    soundFx.playKeyClick();

    if (cmd === 'help') {
      addLog({
        agentTag: 'CLI',
        agentColor: 'cyan',
        category: 'system',
        message:
          '控制平面指令: approve, rollback, inject [bash|edit|grep|ast], prompt <text>, session [1|2|3], alert, mode [claude|codex|hybrid], clear, tui',
      });
    } else if (cmd === 'approve') {
      if (activeSession.pendingHitl) {
        handleApproveHitl(activeSession.pendingHitl.id);
      } else {
        addLog({ agentTag: 'CLI', agentColor: 'amber', category: 'system', message: '当前会话未处于等待审批状态。' });
      }
    } else if (cmd === 'rollback') {
      if (activeSession.pendingHitl) {
        handleRollbackHitl(activeSession.pendingHitl.id);
      } else {
        addLog({ agentTag: 'CLI', agentColor: 'amber', category: 'system', message: '当前会话未处于等待审批状态。' });
      }
    } else if (cmd.startsWith('session')) {
      if (cmd.includes('2')) handleSelectSession('sess-2');
      else if (cmd.includes('3')) handleSelectSession('sess-3');
      else handleSelectSession('sess-1');
    } else if (cmd.startsWith('prompt')) {
      const injected = rawCmd.replace(/^prompt\s*/i, '');
      if (activeSession.pendingHitl) {
        handleInjectPromptHitl(activeSession.pendingHitl.id, injected);
      } else {
        addLog({ agentTag: 'CLI', agentColor: 'cyan', category: 'system', message: `已注入提示词: ${injected}` });
      }
    } else if (cmd.startsWith('inject')) {
      if (cmd.includes('edit')) injectToolCall('file_edit');
      else if (cmd.includes('grep')) injectToolCall('grep');
      else if (cmd.includes('ast')) injectToolCall('ast');
      else injectToolCall('bash');
    } else if (cmd === 'alert' || cmd.includes('risk') || cmd.includes('告警')) {
      handleTriggerHighRiskTest('auth');
    } else if (cmd.includes('mode codex')) {
      setMode('codex');
    } else if (cmd.includes('mode claude')) {
      setMode('claude');
    } else if (cmd.includes('mode hybrid')) {
      setMode('hybrid');
    } else if (cmd.includes('clear')) {
      setLogs([]);
    } else if (cmd.includes('tui')) {
      setIsTuiModalOpen(true);
    } else {
      addLog({
        agentTag: 'CLI',
        agentColor: 'amber',
        category: 'system',
        message: `Executed shell command: "${rawCmd}" -> Exit code 0`,
      });
    }
  };

  // Background Simulation Tick
  useEffect(() => {
    if (!isStreaming || activeSession.isBlocked) return;
    const intervalTime = Math.max(1800 / speed, 500);

    const timer = setInterval(() => {
      // Advance active subagent progress
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId && !s.isBlocked) {
            return {
              ...s,
              subagents: s.subagents.map((agent) => {
                const next = agent.progress >= 100 ? 30 : agent.progress + Math.floor(Math.random() * 6) + 2;
                return {
                  ...agent,
                  progress: next,
                  sparkline: [...agent.sparkline.slice(1), next],
                };
              }),
            };
          }
          return s;
        })
      );

      // Random telemetry event
      if (Math.random() > 0.7) {
        const events = [
          {
            agentTag: 'HAIKU-01',
            agentColor: 'emerald',
            category: 'ast' as const,
            message: `AST 访问器已扫描 ${activeSession.activeFile} 中 418 个节点，零语法报错`,
          },
          {
            agentTag: 'JEV-ROUTER',
            agentColor: 'cyan',
            category: 'router' as const,
            message: '信息熵平衡稳定在 0.421 bit (蒙特卡洛 5,000 次分叉收敛)',
          },
          {
            agentTag: mode === 'codex' ? 'CODEX-1' : 'SONNET',
            agentColor: 'amber',
            category: 'tool' as const,
            message: 'KV 上下文缓存命中: 94.2% 提示词已命中高速缓存',
          },
        ];
        const chosen = events[Math.floor(Math.random() * events.length)];
        addLog(chosen);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isStreaming, speed, activeSession.isBlocked, activeSessionId, mode, addLog, activeSession.activeFile]);

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
          const next = language === 'zh' ? 'en' : 'zh';
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
        onChangeSpeed={() => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 0.5 : 1))}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        alertActive={advisor.alertActive}
      />

      {/* Main Container */}
      <main className="relative flex-1 p-3 lg:p-4 max-w-[1600px] w-full mx-auto flex flex-col gap-3">
        {/* Multi-Session Fleet Tabs */}
        <SessionTabBar
          sessions={sessions}
          activeSessionId={activeSessionId}
          language={language}
          onSelectSession={handleSelectSession}
        />

        {/* FinOps & Code Quality Watermark Bar */}
        <FinOpsBar metrics={activeSession.finOps} language={language} />

        {/* Neural Topology Workspace with SVG Laser Connectors */}
        <div className="relative">
          <NeuralConnectors
            alertActive={advisor.alertActive || activeSession.isBlocked}
            activeStep={activeSession.step}
            riskPercent={`${advisor.riskScore.toFixed(1)}%`}
            language={language}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 relative z-20">
            {/* Left 4 Cols: Purple Dashed Advisor (Opus / o3-pro) with HITL Gatekeeper */}
            <div className="lg:col-span-4 flex flex-col">
              <AdvisorPanel
                advisor={advisor}
                mode={mode}
                language={language}
                onAuthorizePatch={() => handleApproveHitl('quick')}
                onDismissAlert={() => handleRollbackHitl('dismiss')}
                onTriggerAlert={() => handleTriggerHighRiskTest('auth')}
                onApproveHitl={handleApproveHitl}
                onRollbackHitl={handleRollbackHitl}
                onInjectPromptHitl={handleInjectPromptHitl}
                onTriggerHighRiskTest={handleTriggerHighRiskTest}
              />
            </div>

            {/* Right 8 Cols: Main Session, JEV Router, Haiku Subagents */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              {/* Amber Dashed Main Session Controller */}
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
              />

              {/* Cyan Dashed JEV Fork Probability Router */}
              <JevRouterPanel
                metrics={activeSession.jev}
                language={language}
                onRecalculate={recalculateJev}
                onForceSubagents={() => {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === activeSessionId
                        ? { ...s, jev: { ...s.jev, pSubagents: 0.94, pInline: 0.04, pEscalate: 0.02 } }
                        : s
                    )
                  );
                }}
                onForceInline={() => {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === activeSessionId
                        ? { ...s, jev: { ...s.jev, pSubagents: 0.1, pInline: 0.88, pEscalate: 0.02 } }
                        : s
                    )
                  );
                }}
              />

              {/* Emerald Dashed Haiku / Codex-mini Subagent Dispatcher (with Oscilloscope) */}
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

        {/* Interactive CLI Prompt Bar with Buttons & Text Input */}
        <div className="mt-1">
          <InteractiveCliBar
            mode={mode}
            language={language}
            isBlocked={activeSession.isBlocked}
            onApproveHitl={() => activeSession.pendingHitl && handleApproveHitl(activeSession.pendingHitl.id)}
            onRollbackHitl={() => activeSession.pendingHitl && handleRollbackHitl(activeSession.pendingHitl.id)}
            onToggleMode={() => setMode((m) => (m === 'claude' ? 'codex' : 'claude'))}
            onInjectToolCall={injectToolCall}
            onTriggerAlert={() => handleTriggerHighRiskTest('auth')}
            onRestartSubagents={restartSubagents}
            onClearLogs={() => setLogs([])}
            onOpenTuiModal={() => setIsTuiModalOpen(true)}
            onExecuteCustomCommand={handleExecuteCli}
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
                    s.id === activeSessionId ? { ...s, activeDiff: log.diffSnippet! } : s
                  )
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
