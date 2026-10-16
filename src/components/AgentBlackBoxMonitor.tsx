/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BlackBoxStage,
  PromptLayer,
  McpHookEvent,
  AgentPermission,
  MatrixMode,
  AgentCallChainStep,
} from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { soundFx } from '../utils/audio';

interface AgentBlackBoxMonitorProps {
  language: Language;
  mode: MatrixMode;
  activeFile: string;
  directive: string;
  isRealWorkspace?: boolean;
  selectedDrillDownStage?: BlackBoxStage | null;
  onSelectStage?: (stage: BlackBoxStage) => void;
  onInjectPrompt?: (prompt: string) => void;
  onTriggerHookTest?: (type: 'pre' | 'post' | 'blocked') => void;
  onSimulateDenial?: () => void;
}

export const AgentBlackBoxMonitor: React.FC<AgentBlackBoxMonitorProps> = ({
  language,
  mode,
  activeFile,
  directive,
  isRealWorkspace = false,
  selectedDrillDownStage = null,
  onSelectStage,
  onInjectPrompt,
  onTriggerHookTest,
  onSimulateDenial,
}) => {
  const t = translations[language].blackBox;

  // Active step in the sequential pipeline (1 to 6)
  const [activeStep, setActiveStep] = useState<number>(3);
  const [isAutoFlow, setIsAutoFlow] = useState<boolean>(true);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<'standard' | 'blocked' | 'multi'>('standard');

  // Drill-down inspection drawer state (下钻详情)
  const [drillDownStage, setDrillDownStage] = useState<BlackBoxStage | null>(selectedDrillDownStage);
  const [drillDownTab, setDrillDownTab] = useState<'payload' | 'prompt' | 'mcp' | 'permission'>('payload');

  // Custom prompt injection input
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [showInjectSuccess, setShowInjectSuccess] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<'strict' | 'standard' | 'permissive'>('strict');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Sync external drillDownStage if passed from 3D visualizer
  useEffect(() => {
    if (selectedDrillDownStage) {
      setDrillDownStage(selectedDrillDownStage);
    }
  }, [selectedDrillDownStage]);

  // Prompt Layers Data
  const [promptLayers, setPromptLayers] = useState<PromptLayer[]>([
    {
      id: 'layer-sys',
      name: 'System Constitution & Persona',
      role: 'system',
      tokens: 4250,
      percentage: 28,
      color: '#a855f7',
      status: 'cached',
      description: 'Zero-trust agent identity, AST validation rules, anti-hallucination protocols.',
      content: `[IDENTITY & SYSTEM CONSTITUTION]\nYou are an autonomous senior engineer agent operating under zero-trust safety supervision.\n- ALL filesystem mutations must pass PreToolUse validation.\n- Never read or print credentials, .env files, or private keys.\n- Any high-risk mutation must await HITL supervisor signature.\n- Mode: ${mode === 'claude' ? 'Claude Code Engine' : 'OpenAI Codex Engine'}.`,
    },
    {
      id: 'layer-mcp',
      name: 'MCP Tool Schemas & Function Signatures',
      role: 'mcp_tools',
      tokens: 5820,
      percentage: 38,
      color: '#00f0ff',
      status: 'active',
      description: 'Schema manifests for FileEdit, Bash, GitGrep, ASTParse, and MCP servers.',
      content: `[MCP FUNCTION REGISTRY]\n- mcp://filesystem/FileEdit(path: string, old_str: string, new_str: string)\n- mcp://terminal/Bash(command: string, timeout: number = 15000)\n- mcp://git/GitGrep(pattern: string, pathspec?: string)\n- mcp://ast/ASTParse(filePath: string, parseType: 'ts' | 'prisma' | 'sql')`,
    },
    {
      id: 'layer-ctx',
      name: 'Dynamic Context & Working AST Memory',
      role: 'context',
      tokens: 3640,
      percentage: 24,
      color: '#10b981',
      status: 'active',
      description: 'Active file content, Git branch, recent CLI outputs, and workspace state.',
      content: `[WORKING MEMORY & CONTEXT]\nActive Target: ${activeFile || 'src/components/MainSessionPanel.tsx'}\nDirective: ${directive || 'Refactor agent monitoring and simplify telemetry'}\nEnvironment: ${isRealWorkspace ? 'Local Embedded Gateway (Port 7788)' : 'Matrix Multi-Agent Fleet'}\nDiff Delta: +18 lines, -4 lines, Cyclomatic Delta: +1`,
    },
    {
      id: 'layer-inj',
      name: 'Dynamic Directives & HITL Injections',
      role: 'hitl_injected',
      tokens: 1480,
      percentage: 10,
      color: '#f59e0b',
      status: 'modified',
      description: 'Real-time supervisor instructions injected during active session execution.',
      content: `[RUNTIME INJECTED DIRECTIVE]\nEnsure all agent execution stages remain orderly and observable. Disallow unverified network egress.`,
    },
  ]);

  // Mcp Events Stream
  const [mcpEvents, setMcpEvents] = useState<McpHookEvent[]>([
    {
      id: 'mcp-01',
      timestamp: new Date(Date.now() - 34000).toTimeString().split(' ')[0],
      hookStage: 'PreToolUse',
      mcpServer: 'mcp://local-filesystem',
      toolName: 'FileEdit',
      args: { path: activeFile || 'src/auth/oauth2.ts', operation: 'patch' },
      status: 'intercepted',
      latencyMs: 1.2,
      verdict: 'AST Invariant Policy Checked (PASS)',
      payloadSummary: `Inspect edit bounds on ${activeFile || 'src/auth/oauth2.ts'}`,
    },
    {
      id: 'mcp-02',
      timestamp: new Date(Date.now() - 21000).toTimeString().split(' ')[0],
      hookStage: 'ToolExec',
      mcpServer: 'mcp://local-bash-exec',
      toolName: 'Bash',
      args: { command: 'git diff -U2 HEAD' },
      status: 'approved',
      latencyMs: 42.6,
      verdict: 'Sandbox Executed (ExitCode 0)',
      payloadSummary: 'Read uncommitted delta in working directory',
    },
    {
      id: 'mcp-03',
      timestamp: new Date(Date.now() - 12000).toTimeString().split(' ')[0],
      hookStage: 'PostToolUse',
      mcpServer: 'mcp://github-ast-parser',
      toolName: 'ASTParse',
      args: { target: activeFile, syntax: 'typescript' },
      status: 'approved',
      latencyMs: 3.8,
      verdict: 'Tokens Sanitized & State Reflected',
      payloadSummary: 'Extracted 14 AST Node visitors for security review',
    },
  ]);

  // Zero-Trust Capability Permissions
  const [permissions, setPermissions] = useState<AgentPermission[]>([
    {
      id: 'perm-fs-r',
      category: 'fs',
      scope: 'fs.read',
      level: 'allow',
      description: 'Read workspace files & AST trees',
      rule: 'Scoped within repository root',
      activeViolations: 0,
      lastCheckTime: 'NOW (PASS)',
    },
    {
      id: 'perm-fs-w',
      category: 'fs',
      scope: 'fs.write',
      level: 'audit',
      description: 'Write/Patch source code',
      rule: 'Interception required on sensitive files (.env, secrets)',
      activeViolations: 0,
      lastCheckTime: 'NOW (AUDITED)',
    },
    {
      id: 'perm-shell',
      category: 'shell',
      scope: 'shell.exec',
      level: 'audit',
      description: 'Execute subshell CLI commands',
      rule: 'Forbidden: rm -rf /, sudo, mkfs, fork-bombs',
      activeViolations: 0,
      lastCheckTime: 'NOW (AUDITED)',
    },
    {
      id: 'perm-net',
      category: 'network',
      scope: 'net.egress',
      level: 'audit',
      description: 'Outbound HTTP & WebSocket traffic',
      rule: 'Restricted to localhost (3000, 7788) & authorized APIs',
      activeViolations: 0,
      lastCheckTime: 'NOW (AUDITED)',
    },
    {
      id: 'perm-secret',
      category: 'secret',
      scope: 'secrets.vault',
      level: 'blocked',
      description: 'Access sensitive env secrets & tokens',
      rule: 'Strictly denied to autonomous agents',
      activeViolations: 0,
      lastCheckTime: 'NOW (BLOCKED)',
    },
  ]);

  // The 6 Sequential Call Chain Stages (有顺序、有条理)
  const callChainSteps: AgentCallChainStep[] = [
    {
      stepNumber: 1,
      stage: 'prompt',
      name: 'Directive & Prompt Assembly',
      nameZh: '指令解析与提示词编织',
      caller: 'Human / Dispatcher',
      callee: 'Agent Prompt Engine',
      action: 'Assemble multi-layer prompt payload with context',
      inputPayload: {
        summary: `User directive: "${directive.slice(0, 40)}..."`,
        details: JSON.stringify(
          {
            directive,
            activeFile,
            layers: ['system', 'mcp_tools', 'context', 'hitl_injected'],
            totalTokens: 15190,
          },
          null,
          2
        ),
        tokenCount: 15190,
        byteSize: '62.4 KB',
      },
      outputPayload: {
        summary: 'Pristine token stream formatted with AST context',
        details: JSON.stringify(
          {
            status: 'ready_for_inference',
            targetModel: mode === 'claude' ? 'claude-3-7-sonnet' : 'o3-mini',
            temperature: 0.2,
          },
          null,
          2
        ),
        status: 'pass',
      },
      latencyMs: 14.2,
      status: activeStep === 1 ? 'in_flight' : activeStep > 1 ? 'completed' : 'idle',
      notes: '4 layers combined; 0 prompt injection patterns detected',
    },
    {
      stepNumber: 2,
      stage: 'llm',
      name: 'Cognitive Reasoning & Tool Choice',
      nameZh: '认知推理与工具决策',
      caller: 'Prompt Engine',
      callee: mode === 'claude' ? 'Claude 3.7 Engine' : 'OpenAI Codex Core',
      action: 'Execute neural attention & evaluate AST change invariants',
      inputPayload: {
        summary: 'Token stream dispatched to neural attention core',
        details: JSON.stringify(
          {
            model: mode === 'claude' ? 'claude-3-7-opus' : 'codex-davinci-003',
            contextWindow: '200k',
            activeTokens: 15190,
          },
          null,
          2
        ),
        tokenCount: 15190,
        byteSize: '62.4 KB',
      },
      outputPayload: {
        summary: 'Intent Decision: tool_use(FileEdit) for active workspace file',
        details: JSON.stringify(
          {
            decision: 'tool_call',
            selectedTool: 'mcp://local-filesystem/FileEdit',
            confidence: 0.985,
            args: { path: activeFile, operation: 'patch_ast' },
          },
          null,
          2
        ),
        status: 'pass',
      },
      latencyMs: 240.0,
      status: activeStep === 2 ? 'in_flight' : activeStep > 2 ? 'completed' : 'idle',
      notes: 'Generated 1 tool invocation decision; no hallucinations detected',
    },
    {
      stepNumber: 3,
      stage: 'mcp_hook',
      name: 'MCP Hook Interception & Protocol Check',
      nameZh: 'MCP 协议拦截与前置校验',
      caller: 'Agent Runtime',
      callee: 'mcp://local-filesystem (PreToolUse Hook)',
      action: 'Intercept FileEdit parameters before execution and check invariant bounds',
      inputPayload: {
        summary: `JSON-RPC Call: tools/call { name: "FileEdit", path: "${activeFile}" }`,
        details: JSON.stringify(
          {
            jsonrpc: '2.0',
            id: 'mcp-call-7788',
            method: 'tools/call',
            params: {
              name: 'FileEdit',
              arguments: {
                path: activeFile,
                patchType: 'surgical_ast_replace',
              },
            },
          },
          null,
          2
        ),
        byteSize: '1.2 KB',
      },
      outputPayload: {
        summary: 'PreToolUse Hook Verdict: APPROVED (No forbidden paths touched)',
        details: JSON.stringify(
          {
            hook: 'PreToolUse',
            status: 'approved',
            latencyMs: 1.2,
            sanitizedArgs: { path: activeFile },
          },
          null,
          2
        ),
        status: 'intercepted',
      },
      latencyMs: 1.2,
      status: activeStep === 3 ? 'in_flight' : activeStep > 3 ? 'completed' : 'idle',
      notes: 'Hook intercepted in 1.2ms; verified AST syntactic boundaries',
    },
    {
      stepNumber: 4,
      stage: 'permission',
      name: 'Zero-Trust Security Gatekeeper',
      nameZh: '零信任安全权限守门',
      caller: 'MCP Hook Engine',
      callee: 'Zero-Trust Sandbox Guard',
      action: 'Verify least-privilege policies (FS_WRITE, SHELL_EXEC, SECRET_DENY)',
      inputPayload: {
        summary: 'Target capability requested: [fs.write] on workspace repository',
        details: JSON.stringify(
          {
            capability: 'fs.write',
            scope: activeFile,
            policy: 'ScopedToWorkspaceRoot',
            secretRegex: ['\\.env.*', '.*\\.pem', '.*vault.*'],
          },
          null,
          2
        ),
        byteSize: '0.8 KB',
      },
      outputPayload: {
        summary: 'Policy Check: PASSED (Target path is safe, not a credential file)',
        details: JSON.stringify(
          {
            decision: selectedScenario === 'blocked' ? 'DENY' : 'ALLOW',
            rule: 'NoCredentialLeakage',
            violationsCount: selectedScenario === 'blocked' ? 1 : 0,
          },
          null,
          2
        ),
        status: selectedScenario === 'blocked' ? 'blocked' : 'pass',
      },
      latencyMs: 0.6,
      status: activeStep === 4 ? 'in_flight' : activeStep > 4 ? 'completed' : 'idle',
      notes: '5 policies validated; credential access strictly blocked',
    },
    {
      stepNumber: 5,
      stage: 'sandbox',
      name: 'Isolated Subshell Execution',
      nameZh: '隔离工具沙箱执行',
      caller: 'Security Gatekeeper',
      callee: 'Linux Subshell / OS Sandbox',
      action: 'Execute file patch within ephemeral isolated V8/OS process',
      inputPayload: {
        summary: `Execute atomic mutation on target path: ${activeFile}`,
        details: JSON.stringify(
          {
            processId: 'agent-sub-8891',
            isolation: 'V8 Subprocess / chroot',
            timeoutMs: 15000,
            command: `patch-ast --file "${activeFile}"`,
          },
          null,
          2
        ),
        byteSize: '2.4 KB',
      },
      outputPayload: {
        summary: 'Process return code 0; 18 lines patched, AST compiled successfully',
        details: JSON.stringify(
          {
            exitCode: 0,
            stdout: 'Updated AST node: [AgentBlackBoxMonitor] clean compilation',
            stderr: '',
            executionTimeMs: 44.5,
          },
          null,
          2
        ),
        status: 'pass',
      },
      latencyMs: 44.5,
      status: activeStep === 5 ? 'in_flight' : activeStep > 5 ? 'completed' : 'idle',
      notes: 'Tool execution succeeded; exit code 0; no runaway processes',
    },
    {
      stepNumber: 6,
      stage: 'feedback',
      name: 'Sanitization & State Reflection',
      nameZh: '脱敏审计与记忆回流',
      caller: 'Sandbox Executor',
      callee: 'Agent Working Memory & UI Bus',
      action: 'Redact secrets, compute FinOps token delta, persist state snapshot',
      inputPayload: {
        summary: 'Raw output stdout & modified AST tree stream',
        details: JSON.stringify(
          {
            stdoutLength: 124,
            tokenDelta: 85,
            redactionPatternsChecked: 12,
          },
          null,
          2
        ),
        byteSize: '3.1 KB',
      },
      outputPayload: {
        summary: 'Dual-channel state committed; UI timeline updated',
        details: JSON.stringify(
          {
            memoryState: 'COMMITTED',
            finOpsBurnRecorded: true,
            telemetrySyncStatus: 'OK',
          },
          null,
          2
        ),
        status: 'streamed',
      },
      latencyMs: 2.1,
      status: activeStep === 6 ? 'in_flight' : 'idle',
      notes: 'State reflected in agent context; session log synced',
    },
  ];

  // Auto-flow timer: Cycles through the steps sequentially
  useEffect(() => {
    if (!isAutoFlow || isTracing) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % 6) + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [isAutoFlow, isTracing]);

  // Run full end-to-end trace with laser sound and fast step advancement
  const runFullTrace = () => {
    if (isTracing) return;
    setIsTracing(true);
    soundFx.playChirp(840);

    const stepDuration = 500;
    for (let i = 1; i <= 6; i++) {
      setTimeout(() => {
        setActiveStep(i);
        soundFx.playKeyClick();
        if (i === 3) soundFx.playChirp(1050);
        if (i === 4) soundFx.playChirp(920);
      }, (i - 1) * stepDuration);
    }

    setTimeout(() => {
      setIsTracing(false);
      soundFx.playChirp(1200);

      const newEvent: McpHookEvent = {
        id: 'trace-' + Math.random().toString(36).substr(2, 6),
        timestamp: new Date().toTimeString().split(' ')[0],
        hookStage: 'PreToolUse',
        mcpServer: 'mcp://local-filesystem',
        toolName: 'FileEdit',
        args: { file: activeFile, operation: 'verify_ast_invariants' },
        status: 'intercepted',
        latencyMs: 1.4,
        verdict: 'Full black box call chain validated (PASS)',
        payloadSummary: `Validated call-chain steps 01-06 on ${activeFile}`,
      };
      setMcpEvents((prev) => [newEvent, ...prev.slice(0, 15)]);
    }, 6 * stepDuration + 300);
  };

  // Open drill-down for a specific stage
  const openDrillDown = (stage: BlackBoxStage) => {
    setDrillDownStage(stage);
    if (stage === 'prompt') setDrillDownTab('prompt');
    else if (stage === 'mcp_hook') setDrillDownTab('mcp');
    else if (stage === 'permission') setDrillDownTab('permission');
    else setDrillDownTab('payload');

    if (onSelectStage) onSelectStage(stage);
    soundFx.playKeyClick();
  };

  // Close drill-down
  const closeDrillDown = () => {
    setDrillDownStage(null);
    soundFx.playKeyClick();
  };

  // Switch to next or prev stage in drill down
  const drillDownStepObj = callChainSteps.find((s) => s.stage === drillDownStage);
  const handleNextDrillDown = () => {
    if (!drillDownStepObj) return;
    const nextIdx = (drillDownStepObj.stepNumber % 6) + 1;
    const nextStage = callChainSteps[nextIdx - 1].stage;
    openDrillDown(nextStage);
  };
  const handlePrevDrillDown = () => {
    if (!drillDownStepObj) return;
    const prevIdx = drillDownStepObj.stepNumber === 1 ? 6 : drillDownStepObj.stepNumber - 1;
    const prevStage = callChainSteps[prevIdx - 1].stage;
    openDrillDown(prevStage);
  };

  // Handle Dynamic Prompt Injection
  const handleInjectPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPromptInput.trim()) return;
    soundFx.playChirp(980);

    const injectedText = customPromptInput.trim();
    setPromptLayers((prev) =>
      prev.map((layer) => {
        if (layer.role === 'hitl_injected') {
          return {
            ...layer,
            content: `[RUNTIME INJECTION - ${new Date().toTimeString().split(' ')[0]}]\n${injectedText}`,
            tokens: layer.tokens + Math.round(injectedText.length * 1.3),
            status: 'modified',
          };
        }
        return layer;
      })
    );

    setShowInjectSuccess(true);
    setTimeout(() => setShowInjectSuccess(false), 2400);

    if (onInjectPrompt) {
      onInjectPrompt(injectedText);
    }
    setCustomPromptInput('');
  };

  const copyPayloadToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedPayload(true);
    soundFx.playKeyClick();
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const totalTokens = promptLayers.reduce((acc, l) => acc + l.tokens, 0);

  return (
    <div className="bg-[#03060b]/95 border border-cyan-500/40 rounded-lg p-3 sm:p-4 text-xs font-mono shadow-[0_0_30px_rgba(0,240,255,0.1)] relative overflow-hidden flex flex-col gap-3">
      {/* Background Matrix Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(#00f0ff 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.05) 50%, transparent 51%)`,
          backgroundSize: '24px 24px, 100% 4px',
        }}
      />

      {/* 1. TOP EXECUTIVE STATUS (一目了然的整体情况) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-cyan-900/50 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-80" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 -ml-5 shadow-[0_0_8px_#00f0ff]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold tracking-wider text-sm flex items-center gap-1.5">
                <span className="text-cyan-400">⚡</span> {t.title}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                NATIVE AGENT OBSERVABILITY
              </span>
              {isRealWorkspace && (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                  LIVE PORT 7788
                </span>
              )}
            </div>
            <div className="text-[10px] text-cyan-500/80 tracking-wide mt-0.5">
              {t.subtitle}
            </div>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={runFullTrace}
            disabled={isTracing}
            className={`px-2.5 py-1 text-[11px] rounded font-bold transition-all flex items-center gap-1.5 ${
              isTracing
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_#00f0ff] animate-pulse cursor-wait'
                : 'bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-600/60 hover:border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
            }`}
            title="Run simulated end-to-end black box telemetry trace"
          >
            <span>▶</span>
            {isTracing ? 'TRACING...' : t.btnRunFullTrace}
          </button>

          <button
            onClick={() => {
              if (onTriggerHookTest) onTriggerHookTest('pre');
              openDrillDown('mcp_hook');
            }}
            className="px-2 py-1 text-[10px] rounded bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 border border-purple-600/60 transition-all flex items-center gap-1"
          >
            <span>🪝</span>
            {t.btnTriggerMcpHook}
          </button>

          <button
            onClick={() => {
              if (onSimulateDenial) onSimulateDenial();
              openDrillDown('permission');
            }}
            className="px-2 py-1 text-[10px] rounded bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 border border-rose-600/60 transition-all flex items-center gap-1"
          >
            <span>🛡️</span>
            {t.btnSimulateDenial}
          </button>
        </div>
      </div>

      {/* 2. AGENT VITALS AT-A-GLANCE (关键指标一目了然) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative z-10">
        <div className="bg-[#040914]/80 border border-cyan-950 p-2 rounded flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>HEALTH STATUS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <span>🛡️</span> 100% SECURE
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">
            0 Invariant Violations
          </div>
        </div>

        <div className="bg-[#040914]/80 border border-cyan-950 p-2 rounded flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>ACTIVE STAGE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div className="text-sm font-bold text-cyan-300 font-mono mt-1 truncate">
            STEP 0{activeStep}
          </div>
          <div className="text-[9px] text-cyan-500 mt-0.5 truncate">
            {language === 'zh'
              ? callChainSteps[activeStep - 1].nameZh
              : callChainSteps[activeStep - 1].name}
          </div>
        </div>

        <div className="bg-[#040914]/80 border border-cyan-950 p-2 rounded flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>PROMPT WEIGHT</span>
            <span className="text-[9px] text-purple-400 font-bold">4 LAYERS</span>
          </div>
          <div className="text-sm font-bold text-purple-300 font-mono mt-1">
            {totalTokens.toLocaleString()} Tok
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">
            Cached Context: 28%
          </div>
        </div>

        <div className="bg-[#040914]/80 border border-cyan-950 p-2 rounded flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>ZERO-TRUST GATE</span>
            <span className="text-[9px] text-amber-400 font-bold">5 RULES</span>
          </div>
          <div className="text-sm font-bold text-amber-300 font-mono mt-1">
            STRICT GUARD
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">
            Secret Access: Denied
          </div>
        </div>
      </div>

      {/* 3. ORDERLY CALL CHAIN & DYNAMIC DATA FLOW (有顺序有条理的调用链路与动态数据流动) */}
      <div className="bg-[#02050c]/90 border border-cyan-950 p-3 rounded-lg relative overflow-hidden flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-cyan-900/40 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-slate-200 font-bold tracking-wider flex items-center gap-1">
              <span>⛓️</span> {t.tabCallChain} (ORDERLY PIPELINE)
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400/90">
              {isAutoFlow ? '⚡ 流动流转中 (Auto Flowing)' : '⏸ 已暂停 (Paused)'}
            </span>
          </div>

          {/* Flow Stepper Controls */}
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <button
              onClick={() => {
                const prev = activeStep === 1 ? 6 : activeStep - 1;
                setActiveStep(prev);
                soundFx.playChirp(600 + prev * 80);
              }}
              className="px-2 py-0.5 rounded bg-black/60 text-slate-300 hover:text-cyan-300 border border-slate-800"
              title="Previous Step"
            >
              ⏮
            </button>
            <button
              onClick={() => {
                setIsAutoFlow(!isAutoFlow);
                soundFx.playKeyClick();
              }}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                isAutoFlow
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isAutoFlow ? '▶ 自动循环' : '⏸ 暂停'}
            </button>
            <button
              onClick={() => {
                const next = (activeStep % 6) + 1;
                setActiveStep(next);
                soundFx.playChirp(700 + next * 90);
              }}
              className="px-2 py-0.5 rounded bg-black/60 text-slate-300 hover:text-cyan-300 border border-slate-800"
              title="Next Step"
            >
              ⏭
            </button>
            <button
              onClick={() => {
                setActiveStep(1);
                soundFx.playKeyClick();
              }}
              className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            >
              ↺ 重置
            </button>
          </div>
        </div>

        {/* 6 Connected Steps Grid with Flowing Laser Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 relative pt-1">
          {callChainSteps.map((step, idx) => {
            const isCurrent = activeStep === step.stepNumber;
            const isCompleted = activeStep > step.stepNumber;
            const isInspecting = drillDownStage === step.stage;

            // Stage color
            const stageColors: Record<BlackBoxStage, string> = {
              prompt: '#a855f7',
              llm: '#38bdf8',
              mcp_hook: '#00f0ff',
              permission: '#f59e0b',
              sandbox: '#10b981',
              feedback: '#ec4899',
            };
            const color = stageColors[step.stage];

            return (
              <div
                key={step.stepNumber}
                className={`relative rounded border p-2 flex flex-col justify-between min-h-[92px] transition-all cursor-pointer ${
                  isInspecting
                    ? 'border-cyan-400 bg-cyan-950/80 shadow-[0_0_18px_rgba(0,240,255,0.4)] ring-1 ring-cyan-400'
                    : isCurrent
                    ? 'border-cyan-500/80 bg-slate-900/90 shadow-[0_0_12px_rgba(0,240,255,0.3)] scale-[1.02]'
                    : isCompleted
                    ? 'border-slate-700/80 bg-[#040812]/90 hover:border-slate-600'
                    : 'border-slate-800/60 bg-[#02050b]/80 opacity-75 hover:opacity-100 hover:border-slate-700'
                }`}
                onClick={() => openDrillDown(step.stage)}
              >
                {/* Active Ping */}
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                )}

                {/* Step Header */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[9px] px-1.5 py-0.2 rounded font-bold font-mono"
                    style={{ color, backgroundColor: `${color}18` }}
                  >
                    STEP 0{step.stepNumber}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {step.latencyMs}ms
                  </span>
                </div>

                {/* Title */}
                <div className="my-1">
                  <div className="text-[11px] font-bold text-slate-100 truncate flex items-center gap-1">
                    <span>
                      {step.stage === 'prompt' && '🔮'}
                      {step.stage === 'llm' && '🧠'}
                      {step.stage === 'mcp_hook' && '🪝'}
                      {step.stage === 'permission' && '🛡️'}
                      {step.stage === 'sandbox' && '📦'}
                      {step.stage === 'feedback' && '⚡'}
                    </span>
                    <span className="truncate">
                      {language === 'zh' ? step.nameZh : step.name}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                    {step.inputPayload.summary}
                  </div>
                </div>

                {/* Interactive Drill-down trigger bar */}
                <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px]">
                  <span className="text-slate-500">
                    {isCurrent ? (
                      <span className="text-cyan-400 font-bold animate-pulse">● 执行中</span>
                    ) : isCompleted ? (
                      <span className="text-emerald-400">✓ 已完成</span>
                    ) : (
                      '○ 就绪'
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrillDown(step.stage);
                    }}
                    className="text-[9px] text-cyan-300 hover:text-cyan-100 font-bold underline decoration-cyan-500/50 flex items-center gap-0.5"
                  >
                    下钻详情 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. INTERACTIVE DRILL-DOWN DEEP-DIVE INSPECTOR (下钻详情面板) */}
      {drillDownStage && drillDownStepObj && (
        <div className="border border-cyan-500/60 rounded-lg bg-[#02050c]/98 p-3 shadow-[0_0_35px_rgba(0,240,255,0.2)] flex flex-col gap-3 relative z-30 animate-fadeIn">
          {/* Header of Drill-Down */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-900/60">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-600 font-bold text-xs">
                STEP 0{drillDownStepObj.stepNumber} 下钻详情
              </span>
              <span className="text-slate-200 font-bold text-sm">
                {language === 'zh' ? drillDownStepObj.nameZh : drillDownStepObj.name}
              </span>
              <span className="text-[10px] text-slate-400">
                ({drillDownStepObj.caller} ➔ {drillDownStepObj.callee})
              </span>
            </div>

            {/* Stepper navigation inside drill-down */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDrillDown}
                className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 hover:text-cyan-300 border border-slate-700 text-[10px]"
              >
                ◀ 上一步
              </button>
              <button
                onClick={handleNextDrillDown}
                className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 hover:text-cyan-300 border border-slate-700 text-[10px]"
              >
                下一步 ▶
              </button>
              <button
                onClick={closeDrillDown}
                className="px-2.5 py-0.5 rounded bg-rose-950/80 text-rose-200 hover:bg-rose-900 border border-rose-600 text-xs font-bold"
              >
                关闭 ✕
              </button>
            </div>
          </div>

          {/* Drill-Down Subtabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 pb-1.5 text-[11px]">
            <button
              onClick={() => {
                setDrillDownTab('payload');
                soundFx.playKeyClick();
              }}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                drillDownTab === 'payload'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/70 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                  : 'bg-black/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              📦 输入/输出报文 (Payload & Data)
            </button>

            {drillDownStage === 'prompt' && (
              <button
                onClick={() => {
                  setDrillDownTab('prompt');
                  soundFx.playKeyClick();
                }}
                className={`px-3 py-1 rounded font-semibold transition-all ${
                  drillDownTab === 'prompt'
                    ? 'bg-purple-950 text-purple-300 border border-purple-500/70 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                    : 'bg-black/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🔮 提示词层级剖析 (Prompt Layers)
              </button>
            )}

            {(drillDownStage === 'mcp_hook' || drillDownStage === 'sandbox') && (
              <button
                onClick={() => {
                  setDrillDownTab('mcp');
                  soundFx.playKeyClick();
                }}
                className={`px-3 py-1 rounded font-semibold transition-all ${
                  drillDownTab === 'mcp'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/70 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                    : 'bg-black/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🪝 MCP Hook 拦截流水 (MCP Stream)
              </button>
            )}

            {drillDownStage === 'permission' && (
              <button
                onClick={() => {
                  setDrillDownTab('permission');
                  soundFx.playKeyClick();
                }}
                className={`px-3 py-1 rounded font-semibold transition-all ${
                  drillDownTab === 'permission'
                    ? 'bg-amber-950 text-amber-300 border border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'bg-black/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                🛡️ 零信任能力矩阵 (Zero-Trust)
              </button>
            )}
          </div>

          {/* Drill-Down Content Area */}
          <div className="min-h-[220px]">
            {/* TAB 1: Input / Output Payloads in JSON with 1-click copy */}
            {drillDownTab === 'payload' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Input Payload Card */}
                <div className="bg-[#030814] border border-cyan-950 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1.5 border-b border-cyan-900/40 text-[10px]">
                    <span className="text-cyan-300 font-bold flex items-center gap-1">
                      <span>📥</span> INCOMING DATA PAYLOAD (输入报文)
                    </span>
                    <button
                      onClick={() => copyPayloadToClipboard(drillDownStepObj.inputPayload.details)}
                      className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:border-cyan-600 text-[9px]"
                    >
                      {copiedPayload ? '✓ 已复制' : '复制 JSON'}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-300 my-1.5 font-sans">
                    {drillDownStepObj.inputPayload.summary}
                  </div>
                  <pre className="p-2 rounded bg-black/80 border border-slate-900 text-cyan-400/90 text-[10px] overflow-x-auto max-h-[160px] font-mono leading-relaxed">
                    {drillDownStepObj.inputPayload.details}
                  </pre>
                  <div className="mt-1 text-[9px] text-slate-500 flex justify-between">
                    <span>Size: {drillDownStepObj.inputPayload.byteSize}</span>
                    <span>Tokens: {drillDownStepObj.inputPayload.tokenCount || 'N/A'}</span>
                  </div>
                </div>

                {/* Output Payload Card */}
                <div className="bg-[#030814] border border-cyan-950 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1.5 border-b border-cyan-900/40 text-[10px]">
                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                      <span>📤</span> OUTGOING DATA PAYLOAD (输出报文)
                    </span>
                    <button
                      onClick={() => copyPayloadToClipboard(drillDownStepObj.outputPayload.details)}
                      className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:border-emerald-600 text-[9px]"
                    >
                      {copiedPayload ? '✓ 已复制' : '复制 JSON'}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-300 my-1.5 font-sans">
                    {drillDownStepObj.outputPayload.summary}
                  </div>
                  <pre className="p-2 rounded bg-black/80 border border-slate-900 text-emerald-400/90 text-[10px] overflow-x-auto max-h-[160px] font-mono leading-relaxed">
                    {drillDownStepObj.outputPayload.details}
                  </pre>
                  <div className="mt-1 text-[9px] text-slate-500 flex justify-between">
                    <span>Status: {drillDownStepObj.outputPayload.status.toUpperCase()}</span>
                    <span>Latency: {drillDownStepObj.latencyMs}ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Prompt Layers Breakdown */}
            {drillDownTab === 'prompt' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {promptLayers.map((layer) => (
                    <div
                      key={layer.id}
                      className="p-2.5 rounded border border-slate-800 bg-[#040814] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-[11px]" style={{ color: layer.color }}>
                          {layer.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/60 font-mono text-slate-300">
                          {layer.tokens} tok ({layer.percentage}%)
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400 my-1">{layer.description}</div>
                      <pre className="p-2 rounded bg-black/80 border border-slate-900 text-[9.5px] text-slate-300 overflow-x-auto max-h-[85px] font-mono leading-relaxed">
                        {layer.content}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* Live Prompt Injector */}
                <form onSubmit={handleInjectPrompt} className="flex gap-2 items-center pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={customPromptInput}
                    onChange={(e) => setCustomPromptInput(e.target.value)}
                    placeholder="输入要动态注入的提示词指令 (Runtime Injection)..."
                    className="flex-1 bg-black/80 border border-cyan-800/80 rounded px-2.5 py-1.5 text-cyan-200 text-xs outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-500 text-xs font-bold transition-all"
                  >
                    注入指令 ➔
                  </button>
                  {showInjectSuccess && (
                    <span className="text-emerald-400 text-xs font-bold animate-pulse">✓ 注入成功</span>
                  )}
                </form>
              </div>
            )}

            {/* TAB 3: MCP Hook Interceptions */}
            {drillDownTab === 'mcp' && (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-slate-400">
                  实时拦截到的 MCP PreToolUse / ToolExec / PostToolUse 钩子调用序列:
                </div>
                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                  {mcpEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded bg-[#030916] border border-cyan-950 flex flex-wrap items-center justify-between gap-2 text-[10px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-mono">
                          {evt.hookStage}
                        </span>
                        <span className="text-slate-200 font-bold">{evt.toolName}</span>
                        <span className="text-slate-500 font-mono">{evt.mcpServer}</span>
                      </div>
                      <div className="text-slate-300">{evt.verdict}</div>
                      <div className="text-cyan-400 font-mono text-[9px]">{evt.latencyMs}ms</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Zero-Trust Capabilities Matrix */}
            {drillDownTab === 'permission' && (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>零信任细粒度安全规则配置:</span>
                  <div className="flex items-center gap-1 text-[9px]">
                    <span className="text-slate-500">DEFENSE LEVEL:</span>
                    <button
                      onClick={() => setSecurityLevel('strict')}
                      className={`px-1.5 py-0.5 rounded ${
                        securityLevel === 'strict'
                          ? 'bg-rose-950 text-rose-300 border border-rose-600 font-bold'
                          : 'bg-black/60 text-slate-400'
                      }`}
                    >
                      STRICT
                    </button>
                    <button
                      onClick={() => setSecurityLevel('standard')}
                      className={`px-1.5 py-0.5 rounded ${
                        securityLevel === 'standard'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-600 font-bold'
                          : 'bg-black/60 text-slate-400'
                      }`}
                    >
                      STANDARD
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {permissions.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded bg-[#040814] border border-slate-800 flex items-center justify-between text-[10px]"
                    >
                      <div>
                        <div className="font-bold text-slate-200 font-mono">{p.scope}</div>
                        <div className="text-[9px] text-slate-400">{p.description}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                          p.level === 'allow'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600'
                            : p.level === 'audit'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-600'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-600'
                        }`}
                      >
                        {p.level.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
