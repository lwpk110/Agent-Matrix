/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlackBoxStage, MatrixMode } from '../types/matrix';
import { Language } from '../i18n/translations';
import { soundFx } from '../utils/audio';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Bot,
  Layers,
  Network,
  Wrench,
  Terminal,
  FileCode,
  Sparkles,
  CheckCircle,
  ExternalLink,
  Code2,
  FileText,
  Lock,
  Compass,
  ArrowRight,
  Sliders,
  Send,
  Eye,
  Check,
  RefreshCw,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Cpu,
  Brain,
} from 'lucide-react';
import { ModelDisplayModal, MODEL_PRESETS, ModelPreset } from './ModelDisplayModal';

export interface TopologyNode {
  id: string;
  phaseId: number; // 1 to 5
  code: string;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  category: 'input' | 'context' | 'model' | 'orchestrator' | 'capability' | 'policy' | 'loop' | 'output';
  tag?: string;
  // Absolute coordinates in coordinate space (1080 x 810)
  x: number;
  y: number;
  w: number;
  h: number;
  // Deep-dive inspection details
  roleZh: string;
  roleEn: string;
  inputZh: string;
  inputEn: string;
  outputZh: string;
  outputEn: string;
  telemetry: Record<string, any>;
  riskLevel: 'nominal' | 'elevated' | 'critical';
}

interface AgentDynamicFlowHeroProps {
  language: Language;
  mode: MatrixMode;
  activeFile: string;
  directive: string;
  isBlocked?: boolean;
  isRealWorkspace?: boolean;
  selectedStage?: BlackBoxStage | null;
  onSelectStage?: (stage: BlackBoxStage) => void;
  onOpenDrillDown?: (stage: BlackBoxStage) => void;
  onTriggerTrace?: () => void;
  onTriggerHook?: () => void;
  onTriggerDenial?: () => void;
  onInjectPrompt?: (prompt: string) => void;
}

export const AgentDynamicFlowHero: React.FC<AgentDynamicFlowHeroProps> = ({
  language,
  mode,
  activeFile,
  directive,
  isBlocked = false,
  isRealWorkspace = false,
  selectedStage = 'prompt',
  onSelectStage,
  onOpenDrillDown,
  onTriggerTrace,
  onTriggerHook,
  onTriggerDenial,
  onInjectPrompt,
}) => {
  const isZh = language === 'zh';

  // Canvas ref for dynamic floating particles & laser light pulses
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trace execution step state (1 to 11)
  const [activeStep, setActiveStep] = useState<number>(5);
  const [isPlayingTrace, setIsPlayingTrace] = useState<boolean>(true);
  const [traceSpeed, setTraceSpeed] = useState<number>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('model_inference');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isSimulatingBlocked, setIsSimulatingBlocked] = useState<boolean>(isBlocked);
  const [loopbackActive, setLoopbackActive] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'fit' | 'native'>('fit');
  const [userPromptInput, setUserPromptInput] = useState<string>(
    '重构组件 ProductCard 为响应式网格布局，并执行 npm test 确保测试通过'
  );

  // Fullscreen display mode state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Inspector sidebar collapse state
  const [showInspector, setShowInspector] = useState<boolean>(true);

  // Model Display & Inference Center state
  const [showModelModal, setShowModelModal] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('claude-3-7-sonnet');
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);
  const [thinkingBudget, setThinkingBudget] = useState<number>(16384);
  const [temperature, setTemperature] = useState<number>(0.2);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const currentModel: ModelPreset = useMemo(() => {
    return MODEL_PRESETS.find((m) => m.id === selectedModelId) || MODEL_PRESETS[0];
  }, [selectedModelId]);

  // Fullscreen toggle handler (with fallback to CSS fixed inset-0)
  const handleToggleFullscreen = () => {
    soundFx.playKeyClick();
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);

    if (nextState) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Keyboard shortcut for Esc (exit fullscreen) and I (toggle inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        soundFx.playKeyClick();
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInspector((prev) => !prev);
        soundFx.playKeyClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Scenario presets
  const scenarioPresets = [
    {
      id: 'frontend_refactor',
      label: '前端组件重构与测试',
      prompt: '重构组件 ProductCard 为响应式网格布局，并执行 npm test 确保测试通过',
      isRisk: false,
    },
    {
      id: 'db_tuning',
      label: '数据库慢查询与索引优化',
      prompt: '对 orders 表的查询慢日志执行 EXPLAIN ANALYZE，生成并验证无锁索引迁移补丁',
      isRisk: false,
    },
    {
      id: 'github_review',
      label: 'GitHub PR 审查与回帖',
      prompt: '通过 github-mcp 拉取 PR #42，审查 OAuth Hook 竞态并提交审查意见',
      isRisk: false,
    },
    {
      id: 'risk_block',
      label: '高危命令熔断演练 (rm -rf /)',
      prompt: '执行系统清理命令：rm -rf / 释放磁盘空间',
      isRisk: true,
    },
  ];

  // Sync blocked prop
  useEffect(() => {
    setIsSimulatingBlocked(isBlocked);
  }, [isBlocked]);

  // Topology Nodes definitions mapped onto a panoramic, spacious 1600 x 780 widescreen canvas
  const nodes: TopologyNode[] = useMemo(
    () => [
      // ==========================================
      // COLUMN 1: CONTEXT & INGESTION (x: 40, w: 290)
      // ==========================================
      {
        id: 'user_signal',
        phaseId: 1,
        code: 'SIGNAL IN / 01',
        titleZh: 'USER PROMPT 用户输入',
        titleEn: 'USER PROMPT / Input Signals',
        subtitleZh: '自然语言指令 · 交互上下文 · 终端参数',
        subtitleEn: 'Natural language directives & CLI args',
        tag: 'GOAL + CONSTRAINTS',
        category: 'input',
        x: 40,
        y: 55,
        w: 290,
        h: 86,
        roleZh: '交互入口：接收终端或 IDE 中用户敲入的自然语言任务指令、参数与目标约束。',
        roleEn: 'Entry point: captures CLI / IDE prompt and intention.',
        inputZh: userPromptInput,
        inputEn: userPromptInput,
        outputZh: '规范化字符串指令 + CLI 标志位集合',
        outputEn: 'Normalized directive string + CLI flag overrides',
        telemetry: { promptTokens: 38, intentClass: 'code_refactoring', timestamp: '2026-10-16 02:45:10' },
        riskLevel: 'nominal',
      },
      {
        id: 'cli_bootstrap',
        phaseId: 1,
        code: 'RUNTIME BOOTSTRAP / 02',
        titleZh: 'CLI REPL 会话启动器',
        titleEn: 'CLI Runtime Bootstrap',
        subtitleZh: '解析 CLI 参数、校验 cwd 工作区隔离句柄',
        subtitleEn: 'CLI flags parsing, cwd validation',
        category: 'input',
        x: 40,
        y: 155,
        w: 290,
        h: 86,
        roleZh: '会话自举：解析当前命令参数、挂载项目根目录、检测 Git 分支状态并创建会话隔离句柄。',
        roleEn: 'Bootstraps session, sets working directory, verifies Git status.',
        inputZh: 'Node.js 运行时环境、进程 PID、当前工作目录（cwd）',
        inputEn: 'Process environment, cwd, Git branch ref',
        outputZh: '初始化的 Agent 会话上下文句柄（SessionContext）',
        outputEn: 'Initialized Agent session handle with process limits',
        telemetry: { cwd: '/workspace/applet', gitBranch: 'main', ptyAttached: true },
        riskLevel: 'nominal',
      },
      {
        id: 'config_layer',
        phaseId: 1,
        code: 'CONFIG LAYER / 03',
        titleZh: '配置 / 策略与权限预设',
        titleEn: 'Config / Policy Layer',
        subtitleZh: 'Settings · 模型预设 · 权限只读白名单',
        subtitleEn: 'Settings · Models · Allowlist',
        category: 'context',
        x: 40,
        y: 255,
        w: 290,
        h: 86,
        roleZh: '加载全局与本地安全策略、模型等级、环境变量和运行模式（CLI/Agent/Server）。',
        roleEn: 'Loads local/global security config, model selection, env vars.',
        inputZh: '~/.claude.json, .env, CLI 启动参数标志位',
        inputEn: '~/.claude.json, env flags, runtime switches',
        outputZh: '经过验证的权限规则集、只读/写白名单约束',
        outputEn: 'Sanitized permission ruleset, tool allowlists',
        telemetry: { permissionTier: 'scoped', envMode: 'developer', allowedTools: 24 },
        riskLevel: 'nominal',
      },
      {
        id: 'project_rules',
        phaseId: 1,
        code: 'PROJECT RULES / 04',
        titleZh: 'CLAUDE.md 项目工程规范',
        titleEn: 'CLAUDE.md Rules & Memory',
        subtitleZh: '工程准则 · 目录指令 · 构建与测试命令',
        subtitleEn: 'Repo guidelines · Scoped directives',
        category: 'context',
        x: 40,
        y: 355,
        w: 290,
        h: 86,
        roleZh: '解析项目根目录与子目录下的 CLAUDE.md 规范文件，提取构建命令、编码约束与工程纪律。',
        roleEn: 'Parses repo-level and directory-scoped CLAUDE.md guidelines.',
        inputZh: '工作区根目录/子目录 CLAUDE.md 文件内容',
        inputEn: 'CLAUDE.md files in repository root & subdirectories',
        outputZh: '工程准则约束上下文、构建测试运行指南',
        outputEn: 'Project directives, test commands, code style rules',
        telemetry: { rulesLoaded: 18, scope: 'workspace_root', cacheHit: true },
        riskLevel: 'nominal',
      },
      {
        id: 'context_sources',
        phaseId: 1,
        code: 'CONTEXT SOURCES / 05',
        titleZh: '工程上下文源 · AST 符号',
        titleEn: 'History / Files / AST Map',
        subtitleZh: '上下文发现 · 文件树 · LSP 符号按需取数',
        subtitleEn: 'Context discovery · On-demand retrieval',
        category: 'context',
        x: 40,
        y: 455,
        w: 290,
        h: 86,
        roleZh: '智能发现历史会话摘要、打开的文件缓冲区、高频引用的符号依赖，按需取数，避免上下文爆炸。',
        roleEn: 'Discovers session history, open files, AST symbols on demand.',
        inputZh: 'Git 状态、近期修改文件列表、会话历史窗口',
        inputEn: 'Git status, recent files, conversation history',
        outputZh: '压缩后的结构化上下文 Token 载荷',
        outputEn: 'Compact structured context payload',
        telemetry: { contextTokens: 2840, retrievalLatencyMs: 12, compressionRatio: '68%' },
        riskLevel: 'nominal',
      },

      // ==========================================
      // COLUMN 2: COGNITIVE REACTOR (x: 390, w: 350)
      // ==========================================
      {
        id: 'prompt_assembly',
        phaseId: 2,
        code: '02 / CONTEXT FUSION',
        titleZh: 'PROMPT ASSEMBLY 提示词组装',
        titleEn: 'PROMPT ASSEMBLY Context Fusion',
        subtitleZh: '系统提示词 + 规范 + 规则 + 历史 + 工具 Schema 熔铸',
        subtitleEn: 'System prompt + Directives + Rules + Tools schema',
        category: 'context',
        x: 390,
        y: 65,
        w: 350,
        h: 100,
        roleZh: '上下文融合中心：将用户提示词、CLAUDE.md、已注册工具 Schema、Skills 描述及配置熔铸为完整 Prompt。',
        roleEn: 'Fuses user prompt, project rules, tools schemas, and skills.',
        inputZh: '系统提示词底座 + 左侧配置/规则/源 + 工具 JSON Schema',
        inputEn: 'System prompts + Left column configs + Tool schemas',
        outputZh: '输入给核心推理模型的完整格式化提示词上下文',
        outputEn: 'Full synthesized prompt buffer ready for model attention core',
        telemetry: { totalPromptTokens: 4920, cacheHitTokens: 3840, toolsInjected: 14, skillsLoaded: 3 },
        riskLevel: 'nominal',
      },
      {
        id: 'model_inference',
        phaseId: 2,
        code: '03 / MODEL INFERENCE // HERO',
        titleZh: `核心模型推理决策 (${currentModel.name})`,
        titleEn: `Core Model Inference (${currentModel.name})`,
        subtitleZh: `${currentModel.tps} TPS · ${currentModel.ttftMs}ms 首字 · 扩展思考架构`,
        subtitleEn: `${currentModel.family} · Thought Tree · Tool Call choice`,
        tag: 'HERO REACTOR',
        category: 'model',
        x: 390,
        y: 185,
        w: 350,
        h: 190,
        roleZh: `智能中枢大脑：基于 ${currentModel.name} 深度理解目标，${
          thinkingEnabled && currentModel.thinkingSupported
            ? `展开 ${thinkingBudget.toLocaleString()} Tokens 扩展思维链`
            : '极速单步推理'
        }，决定是直接文本作答还是发起结构化工具调用。`,
        roleEn: `Neural attention reasoning via ${currentModel.name}: crafts thought tree & tool call payload.`,
        inputZh: '格式化 Prompt 缓冲区、多轮对话注意力张量',
        inputEn: 'Synthesized prompt context, attention KV cache',
        outputZh: `${
          thinkingEnabled && currentModel.thinkingSupported ? 'Thinking 深度思维链 + ' : ''
        }结构化工具调用请求（ToolCall Payload）`,
        outputEn: 'Reasoning chain + Structured ToolCall JSON payload',
        telemetry: {
          model: currentModel.name,
          family: currentModel.family,
          tps: currentModel.tps,
          ttftMs: currentModel.ttftMs,
          thinkingEnabled: thinkingEnabled && currentModel.thinkingSupported,
          thinkingBudget: thinkingEnabled && currentModel.thinkingSupported ? thinkingBudget : 0,
          temperature,
          contextWindow: currentModel.contextWindow,
        },
        riskLevel: 'nominal',
      },
      {
        id: 'agent_orchestrator',
        phaseId: 3,
        code: '04 / AGENT ORCHESTRATOR',
        titleZh: '智能体调度器 · 路由分发总线',
        titleEn: 'Agent Orchestrator / Routing Bus',
        subtitleZh: '多 Agent 协同 · 路由分发 · 子任务 / 专项能力派发',
        subtitleEn: 'Route dispatch · Tool distribution · Subagents routing',
        category: 'orchestrator',
        x: 390,
        y: 395,
        w: 350,
        h: 110,
        roleZh: '执行分发总线：判断是否需要派遣子智能体协同，将工具调用路由到 Skills、MCP 或内置工具链。',
        roleEn: 'Traffic cop of runtime: routes to Skills, MCP, or builtin tools.',
        inputZh: '模型推理生成的候选行为方案与工具调用意图',
        inputEn: 'Inference candidate tool calls & route tags',
        outputZh: '分发至具体能力的执行事件与入参绑定',
        outputEn: 'Dispatched execution events with bound arguments',
        telemetry: { activeRoute: 'parallel_capabilities', dispatchedSubagents: 2, queueLatencyMs: 4 },
        riskLevel: 'nominal',
      },

      // ==========================================
      // COLUMN 3: CAPABILITIES & SENTINEL (x: 805, w: 335)
      // ==========================================
      {
        id: 'capability_skills',
        phaseId: 3,
        code: 'CAPABILITY A / SKILLS',
        titleZh: 'SKILLS / 专项技能规约',
        titleEn: 'SKILLS / Domain Workflows',
        subtitleZh: '领域流程 · 规范脚手架 · 专家最佳实践',
        subtitleEn: 'Directives · Templates · Resources',
        category: 'capability',
        x: 805,
        y: 55,
        w: 335,
        h: 90,
        roleZh: '专项能力执行体：根据任务类型（如前端设计、数据库调优、单元测试）挂载针对性技能规约。',
        roleEn: 'Domain-specific execution packs: frontend, DB, testing skills.',
        inputZh: 'Skill 触发规则与当前工程状态上下文',
        inputEn: 'Skill trigger condition & workspace AST state',
        outputZh: '符合技能要求的约束行为与定制脚手架指令',
        outputEn: 'Standard-compliant scaffolds & constrained actions',
        telemetry: { activeSkill: 'frontend-design (v2.4)', ruleCount: 18, complianceScore: 100 },
        riskLevel: 'nominal',
      },
      {
        id: 'capability_mcp',
        phaseId: 3,
        code: 'CAPABILITY B / MCP',
        titleZh: 'MCP SERVER 外部服务网关',
        titleEn: 'MCP SERVER Services',
        subtitleZh: 'GitHub · Postgres · Stdio/SSE 跨进程',
        subtitleEn: 'Tools · Resources · Prompts',
        category: 'capability',
        x: 805,
        y: 160,
        w: 335,
        h: 90,
        roleZh: 'Model Context Protocol 客户端：通过标准 MCP 协议跨进程连接 GitHub、Postgres 或本地服务。',
        roleEn: 'Model Context Protocol bridge for filesystem, DB, GitHub.',
        inputZh: 'JSON-RPC 2.0 请求（Method, Params, ClientId）',
        inputEn: 'JSON-RPC 2.0 frames over Stdio/SSE transport',
        outputZh: '外部 MCP 服务返回的资源内容或执行结果',
        outputEn: 'External service responses & unified resources',
        telemetry: { activeServer: 'filesystem-mcp', pingMs: 1.2, transport: 'stdio' },
        riskLevel: 'nominal',
      },
      {
        id: 'capability_tools',
        phaseId: 3,
        code: 'CAPABILITY C / TOOLS',
        titleZh: 'BUILT-IN TOOLS 内置工程工具',
        titleEn: 'BUILT-IN TOOLS',
        subtitleZh: 'view_file · replace_content · run_command',
        subtitleEn: 'Read · Edit · Bash · Search',
        category: 'capability',
        x: 805,
        y: 265,
        w: 335,
        h: 90,
        roleZh: '核心内置工具集：执行 view_file 查看文件、replace_file_content 编辑代码、run_command 跑命令。',
        roleEn: 'Built-in file inspection, surgical edits, shell commands.',
        inputZh: 'view_file, replace_file_content, run_command 入参',
        inputEn: 'Tool name & argument payload',
        outputZh: '文件操作结果、差异补丁输出、进程退出状态',
        outputEn: 'Diff patch results, stdout/stderr bytes, exit codes',
        telemetry: { toolName: 'replace_file_content', target: 'ProductCard.tsx', executionMs: 24 },
        riskLevel: 'nominal',
      },

      // ==========================================
      // RIGHT COLUMN: POLICY & EVENT CONTROL (x: 990, w: 185)
      // ==========================================
      {
        id: 'cross_hooks',
        phaseId: 4,
        code: 'CROSS-CUTTING / 01',
        titleZh: 'HOOKS 生命周期切面',
        titleEn: 'HOOKS Lifecycle Hooks',
        subtitleZh: 'PreToolUse · PostToolUse 安全审计',
        subtitleEn: 'PreToolUse · PostToolUse events',
        category: 'policy',
        x: 805,
        y: 375,
        w: 335,
        h: 90,
        roleZh: '工具执行前后切面拦截：在工具调用前检查参数安全，在工具返回后净化输出与脱敏敏感凭证。',
        roleEn: 'AOP Lifecycle hooks intercepting pre/post tool events.',
        inputZh: 'PreToolUse / PostToolUse 事件与 Payload 对象',
        inputEn: 'Tool lifecycle events & raw payload buffers',
        outputZh: '放行、改写参数（Mutate）或记录审计事件',
        outputEn: 'Allowed event, mutated args, or audit trace log',
        telemetry: { hooksRegistered: 4, activeHook: 'PreToolUseSecurityAudit', latencyMs: 0.8 },
        riskLevel: 'nominal',
      },
      {
        id: 'cross_permission',
        phaseId: 4,
        code: 'CROSS-CUTTING / 02',
        titleZh: 'PERMISSION GATE 权限门禁',
        titleEn: 'PERMISSION GATE Sentinel',
        subtitleZh: isSimulatingBlocked ? '🚨 拦截: rm -rf / 阻断' : 'Allow / Ask / Deny · 零信任',
        subtitleEn: isSimulatingBlocked ? 'HARD_DENY triggered' : 'Allow / Ask / Deny Sentinel',
        category: 'policy',
        x: 805,
        y: 480,
        w: 335,
        h: 96,
        roleZh: '三级安全门禁：只读操作自动放行，工作区代码写入审计白名单，高危命令（提权/删根）物理拦截并要求人工授权。',
        roleEn: 'Zero-trust guardrail: auto-allow reads, audit writes, block rm -rf /.',
        inputZh: '待执行命令字符串、修改路径、网络目标地址',
        inputEn: 'Target file path, shell command AST, risk score',
        outputZh: isSimulatingBlocked ? 'VERDICT: HARD_DENY (熔断)' : 'VERDICT: ALLOW (0ms 快速放行)',
        outputEn: isSimulatingBlocked ? 'VERDICT: HARD_DENY (Tripwire)' : 'VERDICT: ALLOW (Auto-Pass)',
        telemetry: {
          verdict: isSimulatingBlocked ? 'HARD_DENY' : 'ALLOW',
          riskScore: isSimulatingBlocked ? 99 : 14,
          policyRule: 'SEC-ZERO-TRUST-01',
        },
        riskLevel: isSimulatingBlocked ? 'critical' : 'nominal',
      },

      // ==========================================
      // COLUMN 4: OBSERVATION & DELIVERY (x: 1205, w: 350)
      // ==========================================
      {
        id: 'observation',
        phaseId: 4,
        code: 'OBSERVATION / 05',
        titleZh: 'OBSERVATION · 工具结果回填',
        titleEn: 'OBSERVATION · Tool Result & State',
        subtitleZh: 'Stdout 捕获 · 测试状态 · 语法自检',
        subtitleEn: 'Captures tool output, test assertions & errors',
        category: 'loop',
        x: 1205,
        y: 65,
        w: 350,
        h: 105,
        roleZh: '观测与回填：将执行结果、文件 Diff 差异、控制台错误、测试通过状态汇聚成观测报文。',
        roleEn: 'Aggregates tool return value, test stdout, and error traces.',
        inputZh: '标准输出 Stdout、标准错误 Stderr、退出码 ExitCode',
        inputEn: 'Child process stdout/stderr, diff snippets',
        outputZh: 'Observation 结构体，作为新一轮推理依据',
        outputEn: 'Observation block appended to conversation',
        telemetry: { stdoutLines: 8, exitCode: 0, testsPassed: 4, testsFailed: 0 },
        riskLevel: 'nominal',
      },
      {
        id: 'control_loop',
        phaseId: 5,
        code: '05 / CONTROL LOOP ↻',
        titleZh: 'AUTONOMOUS REACT · 自主决策回路',
        titleEn: 'Re-Reasoning · Verify · Self-Heal',
        subtitleZh: '测试报错则 ↺ 反馈回路回跳 03 模型，满足退出条件则交付',
        subtitleEn: 'Continue loopback (↺ to 03 inference) or exit',
        tag: 'SELF-HEAL',
        category: 'loop',
        x: 1205,
        y: 195,
        w: 350,
        h: 115,
        roleZh: '自愈与控制回路：如果测试失败或出现语法错误，携带报错信息自动回跳至「03 模型推理」进行自愈修复；若成功则收敛。',
        roleEn: 'Self-healing control loop: retries on failure, or terminates.',
        inputZh: 'Observation 结果评价、当前任务验收准则',
        inputEn: 'Observation payload & acceptance criteria',
        outputZh: '决策：继续迭代（Loopback ↺）或输出最终交付（Finalize）',
        outputEn: 'Branch: trigger loopback iteration OR finalize delivery',
        telemetry: { iterationCount: 1, maxIterations: 8, converged: true },
        riskLevel: 'nominal',
      },
      {
        id: 'finalize',
        phaseId: 5,
        code: 'FINALIZE / 06',
        titleZh: 'FINALIZE · 答复 / 文件变更收敛',
        titleEn: 'FINALIZE · Diff / Summary / Output',
        subtitleZh: '合成最终代码差异摘要，生成面向使用者的结构化回答',
        subtitleEn: 'Synthesizes code diff summary & user response',
        category: 'output',
        x: 1205,
        y: 335,
        w: 350,
        h: 105,
        roleZh: '最终收敛：关闭临时子进程句柄，保存 Git 变更快照，生成给使用者的最终任务达成总结。',
        roleEn: 'Closes temporary subprocesses, commits workspace state.',
        inputZh: '完整任务执行轨迹、所有修改的代码差异列表',
        inputEn: 'Full trace timeline & synthesized file diffs',
        outputZh: '最终交付工件：代码补丁 + 交付文案 + 耗时统计',
        outputEn: 'Final deliverables: code diffs + summary message',
        telemetry: { filesChanged: 1, additions: 24, deletions: 11, totalDurationMs: 1420 },
        riskLevel: 'nominal',
      },
      {
        id: 'user_output',
        phaseId: 5,
        code: 'USER-FACING OUTPUT ↗',
        titleZh: '用户可见输出 · 交付成果就绪',
        titleEn: 'User-Facing Output',
        subtitleZh: '在终端 / Web 界面呈现代码高亮 Diff 与交互成果',
        subtitleEn: 'Renders code diffs and reply in UI/CLI',
        category: 'output',
        x: 1205,
        y: 465,
        w: 350,
        h: 110,
        roleZh: '终端与 UI 展示层：以高亮 Diff、终端富文本或浏览器预览将最终成果无缝交付给用户。',
        roleEn: 'Presents verified diff and response directly to user.',
        inputZh: 'Finalize 交付产物与格式化输出流',
        inputEn: 'Clean final response payload',
        outputZh: '用户直接查看和使用的成果（代码已就绪）',
        outputEn: 'Interactive code diff & clean execution status',
        telemetry: { deliverableType: 'code_diff_and_chat', userSatisfaction: 'verified' },
        riskLevel: 'nominal',
      },
    ],
    [userPromptInput, isSimulatingBlocked, currentModel, thinkingEnabled, thinkingBudget, temperature]
  );

  // Active inspected node
  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[3];
  }, [nodes, selectedNodeId]);

  // Real-time sequential flow metadata per step (1 to 11)
  const stepFlowMeta: Record<
    number,
    {
      step: number;
      titleZh: string;
      titleEn: string;
      fromZh: string;
      toZh: string;
      fromEn: string;
      toEn: string;
      packetZh: string;
      packetEn: string;
      actionZh: string;
      actionEn: string;
      color: 'cyan' | 'purple' | 'amber' | 'emerald' | 'rose';
    }
  > = useMemo(
    () => ({
      1: {
        step: 1,
        titleZh: '01 需求输入 ➔ CLI 会话自举',
        titleEn: '01 User Signal ➔ CLI Bootstrap',
        fromZh: '01 / USER SIGNAL',
        toZh: 'CLI BOOTSTRAP',
        fromEn: 'USER SIGNAL',
        toEn: 'CLI BOOTSTRAP',
        packetZh: 'PROMPT [38T]',
        packetEn: 'PROMPT [38T]',
        actionZh: '捕获终端输入需求，向 CLI 管道传输自然语言目标与参数约束。',
        actionEn: 'Capturing user prompt directive, streaming goals & constraints into CLI.',
        color: 'cyan',
      },
      2: {
        step: 2,
        titleZh: 'CLI 自举 ➔ 02 上下文融合中心',
        titleEn: 'CLI Bootstrap ➔ 02 Context Fusion',
        fromZh: 'CLI BOOTSTRAP',
        toZh: '02 / CONTEXT FUSION',
        fromEn: 'CLI BOOTSTRAP',
        toEn: 'CONTEXT FUSION',
        packetZh: 'SESSION [CWD & Git]',
        packetEn: 'SESSION [CWD & Git]',
        actionZh: '校验隔离工作区目录、Git 分支与环境句柄，向 Prompt 组装中心提交。',
        actionEn: 'Verifying cwd, Git branch, and sandbox handles for prompt fusion.',
        color: 'cyan',
      },
      3: {
        step: 3,
        titleZh: '上下文源 ➔ 02 上下文融合中心',
        titleEn: 'Context Sources ➔ 02 Context Fusion',
        fromZh: 'CONTEXT FEED (3 Sources)',
        toZh: '02 / CONTEXT FUSION',
        fromEn: 'CONTEXT FEED',
        toEn: 'CONTEXT FUSION',
        packetZh: 'RULES & HISTORY [4.2k]',
        packetEn: 'RULES & HISTORY [4.2k]',
        actionZh: '三路并发取数：从 ~/.claude.json、CLAUDE.md 工程规范与会话历史抓取上下文。',
        actionEn: 'Triple parallel ingestion: config, CLAUDE.md guidelines, and history AST.',
        color: 'purple',
      },
      4: {
        step: 4,
        titleZh: '02 上下文融合 ➔ 03 核心模型推理',
        titleEn: '02 Context Fusion ➔ 03 Model Inference',
        fromZh: '02 / CONTEXT FUSION',
        toZh: '03 / MODEL INFERENCE',
        fromEn: 'CONTEXT FUSION',
        toEn: 'MODEL INFERENCE',
        packetZh: 'FUSED PROMPT [4.9k]',
        packetEn: 'FUSED PROMPT [4.9k]',
        actionZh: '全量合成 Prompt 载荷注入 Claude 3.7 注意力中枢，生成思考树规划。',
        actionEn: 'Full synthesized prompt injected into model attention core for reasoning.',
        color: 'cyan',
      },
      5: {
        step: 5,
        titleZh: '03 模型推理决策 ➔ 04 智能体调度总线',
        titleEn: '03 Model Inference ➔ 04 Agent Orchestrator',
        fromZh: '03 / MODEL INFERENCE',
        toZh: '04 / AGENT ORCHESTRATOR',
        fromEn: 'MODEL INFERENCE',
        toEn: 'AGENT ORCHESTRATOR',
        packetZh: 'TOOL CALL [Intent]',
        packetEn: 'TOOL CALL [Intent]',
        actionZh: '模型完成思考树规划，输出结构化工具调用（ToolCall）意图交给调度器。',
        actionEn: 'Model completes thought tree, emitting structured ToolCall to orchestrator.',
        color: 'cyan',
      },
      6: {
        step: 6,
        titleZh: '04 调度总线 ➔ 三大并行执行能力',
        titleEn: '04 Orchestrator ➔ Capabilities',
        fromZh: '04 / AGENT ORCHESTRATOR',
        toZh: 'SKILLS · MCP · BUILT-IN',
        fromEn: 'AGENT ORCHESTRATOR',
        toEn: 'CAPABILITIES',
        packetZh: 'DISPATCH [3 Branches]',
        packetEn: 'DISPATCH [3 Branches]',
        actionZh: '调度总线三向分流：挂载前端规范、连接外部 MCP 服务、派发内置文件工具。',
        actionEn: 'Dispatching tool execution across domain skills, MCP bridge, and built-ins.',
        color: 'cyan',
      },
      7: {
        step: 7,
        titleZh: '三大能力执行 ➔ OBSERVATION 结果回填',
        titleEn: 'Capabilities ➔ Observation',
        fromZh: 'CAPABILITIES (A, B, C)',
        toZh: 'OBSERVATION',
        fromEn: 'CAPABILITIES',
        toEn: 'OBSERVATION',
        packetZh: 'OBSERVATION [Exit: 0]',
        packetEn: 'OBSERVATION [Exit: 0]',
        actionZh: '沙箱中完成代码改写与 npm test，捕获执行 Stdout、Diff 补丁汇入观测。',
        actionEn: 'Capturing diff patch, subprocess stdout, and exit codes into observation.',
        color: 'cyan',
      },
      8: {
        step: 8,
        titleZh: '切面拦截 ➔ 权限门禁 (Permission Sentinel)',
        titleEn: 'Hooks ➔ Permission Sentinel',
        fromZh: 'LIFECYCLE HOOKS',
        toZh: 'PERMISSION GATE',
        fromEn: 'HOOKS',
        toEn: 'PERMISSION GATE',
        packetZh: isSimulatingBlocked ? '🚨 HARD_DENY [rm -rf /]' : 'VERDICT: ALLOW [0ms]',
        packetEn: isSimulatingBlocked ? 'HARD_DENY [rm -rf /]' : 'ALLOW [0ms]',
        actionZh: isSimulatingBlocked
          ? '【高危熔断拦截】检测到破坏性删根指令 rm -rf /，安全门禁物理熔断！'
          : '【零信任审计】只读/常规代码写操作通过安全策略白名单，以 0ms 快速放行。',
        actionEn: isSimulatingBlocked
          ? 'Critical zero-trust tripwire triggered on destructive command.'
          : 'Zero-trust audit: workspace modification matches allowlist, auto-approved.',
        color: isSimulatingBlocked ? 'rose' : 'emerald',
      },
      9: {
        step: 9,
        titleZh: 'OBSERVATION ➔ 05 自愈控制回路',
        titleEn: 'Observation ➔ 05 Control Loop',
        fromZh: 'OBSERVATION',
        toZh: '05 / CONTROL LOOP ↻',
        fromEn: 'OBSERVATION',
        toEn: 'CONTROL LOOP',
        packetZh: 'EVALUATE [Pass / Retry?]',
        packetEn: 'EVALUATE [Pass / Retry?]',
        actionZh: '比对任务验收准则：检查单元测试是否全部通过、是否存在语法异常。',
        actionEn: 'Evaluating observation results against acceptance criteria.',
        color: 'cyan',
      },
      10: {
        step: 10,
        titleZh: '05 控制回路 ➔ 03 重新推理 (自愈反馈 ↺)',
        titleEn: '05 Control Loop ➔ 03 Model Re-Inference',
        fromZh: '05 / CONTROL LOOP ↻',
        toZh: '03 / MODEL INFERENCE',
        fromEn: 'CONTROL LOOP',
        toEn: 'MODEL INFERENCE',
        packetZh: 'FEEDBACK [Loopback ↺]',
        packetEn: 'FEEDBACK [Loopback ↺]',
        actionZh: '观测发现报错或未通过，携带失败堆栈沿专属光轨回跳 03 模型自主纠错！',
        actionEn: 'Carrying failure trace along iteration loopback to re-reason and self-heal.',
        color: 'cyan',
      },
      11: {
        step: 11,
        titleZh: '控制回路 ➔ FINALIZE ➔ 用户成果交付 ↗',
        titleEn: 'Control Loop ➔ Finalize ➔ User Output',
        fromZh: '05 / CONTROL LOOP',
        toZh: 'USER-FACING OUTPUT ↗',
        fromEn: 'CONTROL LOOP',
        toEn: 'USER OUTPUT',
        packetZh: 'DELIVERY [Code & Summary ↗]',
        packetEn: 'DELIVERY [Code & Summary ↗]',
        actionZh: '验收通过，子进程正常释放，代码补丁就绪，在界面呈现最终高亮交付！',
        actionEn: 'Verification passed, diff ready, delivering clean result to user.',
        color: 'emerald',
      },
    }),
    [isSimulatingBlocked]
  );

  const currentFlow = stepFlowMeta[activeStep] || stepFlowMeta[1];

  // Synchronize trace step to selected stage
  useEffect(() => {
    let stage: BlackBoxStage = 'prompt';
    if (activeStep <= 2) stage = 'prompt';
    else if (activeStep <= 4) stage = 'prompt';
    else if (activeStep === 5) stage = 'llm';
    else if (activeStep === 6) stage = 'mcp_hook';
    else if (activeStep === 7) stage = 'mcp_hook';
    else if (activeStep === 8) stage = 'permission';
    else if (activeStep >= 9) stage = 'sandbox';

    onSelectStage?.(stage);
  }, [activeStep, onSelectStage]);

  // Trace execution stepper
  useEffect(() => {
    if (!isPlayingTrace) return;

    const intervalTime = Math.max(700, 2200 / traceSpeed);
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (isSimulatingBlocked && prev === 8) {
          // Blocked at permission gate
          return 8;
        }

        // Loopback animation trigger
        if (prev === 10) {
          setLoopbackActive(true);
          setTimeout(() => setLoopbackActive(false), 950);
          return 11;
        }

        if (prev >= 11) {
          return 1;
        }

        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlayingTrace, traceSpeed, isSimulatingBlocked]);

  // Auto select active node when trace progresses
  useEffect(() => {
    let targetNodeId = selectedNodeId;
    switch (activeStep) {
      case 1:
        targetNodeId = 'user_signal';
        break;
      case 2:
        targetNodeId = 'cli_bootstrap';
        break;
      case 3:
        targetNodeId = 'config_layer';
        break;
      case 4:
        targetNodeId = 'prompt_assembly';
        break;
      case 5:
        targetNodeId = 'model_inference';
        break;
      case 6:
        targetNodeId = 'agent_orchestrator';
        break;
      case 7:
        targetNodeId = 'capability_tools';
        break;
      case 8:
        targetNodeId = 'cross_permission';
        break;
      case 9:
        targetNodeId = 'observation';
        break;
      case 10:
        targetNodeId = 'control_loop';
        break;
      case 11:
        targetNodeId = 'user_output';
        break;
      default:
        break;
    }
    setSelectedNodeId(targetNodeId);
  }, [activeStep]);

  // Particle background & dynamic light ray animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 1080);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 810);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Floating cyber particles
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      size: Math.random() * 2 + 0.8,
      alpha: Math.random() * 0.5 + 0.2,
      color: Math.random() > 0.5 ? 'rgba(0, 240, 255,' : 'rgba(168, 85, 247,',
    }));

    let pulseT = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render floating stars
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00f0ff';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // High-precision organic trajectory-following photon flows & comet trails
      pulseT += 0.016 * traceSpeed;
      if (pulseT > 1) pulseT = 0;

      const scaleX = width / 1600;
      const scaleY = height / 780;

      // Define real active trajectory conduits based on activeStep
      interface Trajectory {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        cx?: number; // bezier control point
        cy?: number;
        color: string;
        glow: string;
      }

      let activeTrajectories: Trajectory[] = [];

      switch (activeStep) {
        case 1:
          activeTrajectories = [{ x1: 185, y1: 141, x2: 185, y2: 155, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
          break;
        case 2:
          activeTrajectories = [{ x1: 330, y1: 198, x2: 390, y2: 100, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
          break;
        case 3: // Triple parallel context fusion
          activeTrajectories = [
            { x1: 330, y1: 298, x2: 390, y2: 115, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
            { x1: 330, y1: 398, x2: 390, y2: 130, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
            { x1: 330, y1: 498, x2: 390, y2: 145, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
          ];
          break;
        case 4:
          activeTrajectories = [{ x1: 565, y1: 165, x2: 565, y2: 185, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
          break;
        case 5:
          activeTrajectories = [{ x1: 565, y1: 375, x2: 565, y2: 395, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
          break;
        case 6: // Orchestrator branch to 3 capabilities
          activeTrajectories = [
            { x1: 740, y1: 430, x2: 805, y2: 100, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' },
            { x1: 740, y1: 450, x2: 805, y2: 205, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' },
            { x1: 740, y1: 470, x2: 805, y2: 310, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' },
          ];
          break;
        case 7: // 3 capabilities converge to observation
          activeTrajectories = [
            { x1: 1140, y1: 100, x2: 1205, y2: 100, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.95)' },
            { x1: 1140, y1: 205, x2: 1205, y2: 125, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' },
            { x1: 1140, y1: 310, x2: 1205, y2: 145, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)' },
          ];
          break;
        case 8: // Security sentinel gate
          activeTrajectories = [
            {
              x1: 1140,
              y1: 528,
              x2: 1205,
              y2: 155,
              color: isSimulatingBlocked ? '#f43f5e' : '#10b981',
              glow: isSimulatingBlocked ? 'rgba(244, 63, 94, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            },
          ];
          break;
        case 9:
          activeTrajectories = [{ x1: 1380, y1: 170, x2: 1380, y2: 195, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
          break;
        case 10: // Smooth loopback curved trajectory
          activeTrajectories = [
            {
              x1: 1555,
              y1: 250,
              x2: 565,
              y2: 185,
              cx: 1000,
              cy: 28,
              color: '#38bdf8',
              glow: 'rgba(56, 189, 248, 0.95)',
            },
          ];
          break;
        case 11: // Delivery
          activeTrajectories = [
            { x1: 1380, y1: 310, x2: 1380, y2: 335, color: '#10b981', glow: 'rgba(16, 185, 129, 0.95)' },
            { x1: 1380, y1: 440, x2: 1380, y2: 465, color: '#10b981', glow: 'rgba(16, 185, 129, 0.95)' },
          ];
          break;
        default:
          activeTrajectories = [{ x1: 185, y1: 141, x2: 185, y2: 155, color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.95)' }];
      }

      // Render each active trajectory with smooth organic ease, comet tails, and arrival shockwaves
      activeTrajectories.forEach((traj) => {
        // Smooth sine ease
        const t = Math.sin(pulseT * Math.PI * 0.5);

        let currX: number;
        let currY: number;

        if (traj.cx !== undefined && traj.cy !== undefined) {
          // Quadratic bezier curve
          const invT = 1 - t;
          currX = (invT * invT * traj.x1 + 2 * invT * t * traj.cx + t * t * traj.x2) * scaleX;
          currY = (invT * invT * traj.y1 + 2 * invT * t * traj.cy + t * t * traj.y2) * scaleY;
        } else {
          // Straight line interpolation
          currX = (traj.x1 + (traj.x2 - traj.x1) * t) * scaleX;
          currY = (traj.y1 + (traj.y2 - traj.y1) * t) * scaleY;
        }

        // Draw flowing trailing stardust particles behind the head
        for (let i = 1; i <= 7; i++) {
          const tailT = Math.max(0, t - i * 0.04);
          let tailX: number;
          let tailY: number;
          if (traj.cx !== undefined && traj.cy !== undefined) {
            const invTail = 1 - tailT;
            tailX = (invTail * invTail * traj.x1 + 2 * invTail * tailT * traj.cx + tailT * tailT * traj.x2) * scaleX;
            tailY = (invTail * invTail * traj.y1 + 2 * invTail * tailT * traj.cy + tailT * tailT * traj.y2) * scaleY;
          } else {
            tailX = (traj.x1 + (traj.x2 - traj.x1) * tailT) * scaleX;
            tailY = (traj.y1 + (traj.y2 - traj.y1) * tailT) * scaleY;
          }

          const tailAlpha = (1 - i / 8) * 0.45;
          const tailSize = Math.max(1, (3.5 - i * 0.35) * scaleX);

          ctx.beginPath();
          ctx.arc(tailX, tailY, tailSize, 0, Math.PI * 2);
          ctx.fillStyle = traj.glow.replace(/[\d\.]+\)$/, `${tailAlpha})`);
          ctx.fill();
        }

        // Outer radial energy aura
        const auraRadius = 24 * scaleX;
        const grad = ctx.createRadialGradient(currX, currY, 0, currX, currY, auraRadius);
        grad.addColorStop(0, traj.glow);
        grad.addColorStop(0.4, traj.glow.replace(/[\d\.]+\)$/, '0.35)'));
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(currX, currY, auraRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core white-hot photon
        ctx.beginPath();
        ctx.arc(currX, currY, 3.8 * scaleX, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.shadowColor = traj.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arrival shockwave ring when photon nears destination
        if (pulseT > 0.82) {
          const destX = traj.x2 * scaleX;
          const destY = traj.y2 * scaleY;
          const rippleProgress = (pulseT - 0.82) / 0.18;
          const rippleRadius = rippleProgress * 22 * scaleX;
          const rippleAlpha = (1 - rippleProgress) * 0.8;

          ctx.beginPath();
          ctx.arc(destX, destY, rippleRadius, 0, Math.PI * 2);
          ctx.strokeStyle = traj.glow.replace(/[\d\.]+\)$/, `${rippleAlpha})`);
          ctx.lineWidth = 2 * scaleX;
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [traceSpeed, activeStep, isSimulatingBlocked]);

  const handleRunTrace = () => {
    soundFx.playChirp();
    setActiveStep(1);
    setIsPlayingTrace(true);
    onTriggerTrace?.();
  };

  const handleStepPlus = () => {
    soundFx.playKeyClick();
    setIsPlayingTrace(false);
    setActiveStep((prev) => (prev >= 11 ? 1 : prev + 1));
  };

  const handleReset = () => {
    soundFx.playKeyClick();
    setActiveStep(1);
    setIsPlayingTrace(false);
    setIsSimulatingBlocked(false);
    setSelectedNodeId('user_signal');
  };

  return (
    <div
      ref={containerRef}
      className={`w-full text-slate-200 flex flex-col font-sans select-none transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#02050f] overflow-y-auto p-2 sm:p-4 shadow-2xl'
          : 'bg-[#050914] border border-cyan-500/30 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.12)] relative overflow-hidden backdrop-blur-2xl'
      }`}
    >
      {/* =========================================================================
          TOP CYBERNETIC CONTROL HEADER
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 px-5 py-3 border-b border-cyan-900/50 bg-[#070e1c]/95 z-20">
        <div className="flex items-center gap-3">
          {/* Logo Badge [CC] */}
          <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-400 flex items-center justify-center shadow-[0_0_18px_rgba(0,240,255,0.4)] shrink-0">
            <span className="text-cyan-300 font-black font-mono text-sm tracking-tighter">[CC]</span>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-widest text-cyan-400/90 uppercase font-bold">
              NEURAL EXECUTION MAP // 2026
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black tracking-wider text-slate-100 font-mono">
                CLAUDE CODE // AGENT RUNTIME
              </h1>
              <span className="hidden md:inline-block text-[11px] font-mono text-slate-400">
                PROMPT IN · REASONING CORE · TOOL ORCHESTRATION · RESULT OUT
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Control Buttons */}
        <div className="flex items-center gap-2 self-stretch lg:self-auto justify-end flex-wrap">
          {/* MODEL DISPLAY BUTTON (模型显示与推理中枢) */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              setShowModelModal(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0e162c] hover:bg-[#18264a] text-purple-200 border border-purple-500/50 hover:border-purple-400 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.3)]"
            title={isZh ? '打开大模型深度显示与参数推理面板' : 'Open Model Display & Reasoning Center'}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>{isZh ? '模型显示' : 'MODEL'}:</span>
            <span className="text-cyan-300 font-bold">{currentModel.name}</span>
            {thinkingEnabled && currentModel.thinkingSupported && (
              <span className="hidden xl:inline text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                THINKING
              </span>
            )}
          </button>

          {/* FULLSCREEN TOGGLE BUTTON (全屏显示) */}
          <button
            onClick={handleToggleFullscreen}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer border ${
              isFullscreen
                ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.6)] animate-pulse'
                : 'bg-[#0a1528] hover:bg-[#122344] text-cyan-300 border-cyan-700/60'
            }`}
            title={isFullscreen ? '退出全屏 [Esc]' : '全屏显示'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{isZh ? '退出全屏' : 'EXIT FULL'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{isZh ? '全屏显示' : 'FULLSCREEN'}</span>
              </>
            )}
          </button>

          {/* Simulation status pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono ${
              isSimulatingBlocked
                ? 'bg-rose-950 border border-rose-500/60 text-rose-300 animate-pulse'
                : 'bg-[#0a1528] border border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSimulatingBlocked ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span>{isSimulatingBlocked ? 'BLOCKED AT GATE' : 'SYSTEM SIMULATION'}</span>
          </div>

          {/* RUN / PAUSE TRACE */}
          <button
            onClick={() => {
              if (isPlayingTrace) {
                setIsPlayingTrace(false);
              } else {
                handleRunTrace();
              }
            }}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs font-mono flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.4)]"
          >
            {isPlayingTrace ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black" />}
            <span>{isPlayingTrace ? 'PAUSE' : 'RUN TRACE'}</span>
          </button>

          {/* STEP + */}
          <button
            onClick={handleStepPlus}
            className="px-3 py-1.5 rounded-lg bg-[#0e1c36] hover:bg-[#152a52] text-cyan-300 border border-cyan-700/60 font-bold text-xs font-mono flex items-center gap-1 transition cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>STEP +</span>
          </button>

          {/* RESET ↺ */}
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-lg bg-[#0e1c36] hover:bg-[#152a52] text-slate-300 border border-slate-700 font-bold text-xs font-mono flex items-center gap-1 transition cursor-pointer"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ↺</span>
          </button>

          {/* Speed Toggle */}
          <div className="flex items-center rounded-lg bg-[#0a1528] border border-slate-800 p-0.5 font-mono text-[10px]">
            {[1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => setTraceSpeed(spd)}
                className={`px-1.5 py-0.5 rounded ${
                  traceSpeed === spd ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* High risk toggle simulation */}
          <button
            onClick={() => {
              const nextState = !isSimulatingBlocked;
              setIsSimulatingBlocked(nextState);
              if (nextState) {
                onTriggerDenial?.();
                setUserPromptInput('执行高危指令：rm -rf / 释放系统空间');
                setActiveStep(8);
              } else {
                setUserPromptInput('重构组件 ProductCard 为响应式网格布局，并执行 npm test 确保测试通过');
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer border ${
              isSimulatingBlocked
                ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                : 'bg-[#120a10] text-slate-400 border-rose-900/60 hover:text-rose-300'
            }`}
            title="高危指令熔断拦截测试"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>{isSimulatingBlocked ? '演练拦截中 🚨' : '演练高危拦截'}</span>
          </button>
        </div>
      </div>

      {/* Subheader: Scenario Preset Switcher & Direct Prompt Ingestion */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-5 py-2.5 bg-[#040813] border-b border-cyan-950/80 z-20 text-[11px] font-mono">
        {/* Preset scenario tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span className="text-slate-400 uppercase font-bold shrink-0 text-[10px]">SCENARIOS:</span>
          {scenarioPresets.map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                soundFx.playKeyClick();
                setUserPromptInput(sc.prompt);
                setIsSimulatingBlocked(sc.isRisk);
                if (sc.isRisk) onTriggerDenial?.();
                handleRunTrace();
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition cursor-pointer border ${
                userPromptInput === sc.prompt
                  ? sc.isRisk
                    ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'bg-[#091222] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {sc.isRisk && <AlertTriangle className="w-2.5 h-2.5 inline mr-1 text-rose-400" />}
              {sc.label}
            </button>
          ))}
        </div>

        {/* Live Input Field */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <span className="text-cyan-400 shrink-0 font-bold text-[10px]">PROMPT:</span>
          <input
            type="text"
            value={userPromptInput}
            onChange={(e) => setUserPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunTrace();
            }}
            placeholder="输入自然语言需求，敲回车或点击 RUN TRACE..."
            className="w-full bg-[#091224] border border-cyan-900/60 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
          />
        </div>
      </div>

      {/* =========================================================================
          MAIN TOPOLOGY & INSPECTOR CONTAINER (Responsive Dynamic Grid)
         ========================================================================= */}
      <div className={`grid grid-cols-1 ${!isFullscreen && showInspector ? 'xl:grid-cols-[1fr_370px]' : 'grid-cols-1'} w-full relative transition-all duration-300`}>
        {/* ================= LEFT: TOPOLOGY CANVAS FRAME ================= */}
        <div className="p-3 sm:p-4 flex flex-col justify-start items-center bg-[#030712] relative overflow-hidden">
          {/* Cyber Framing Brackets */}
          <div className="w-full relative rounded-xl border border-cyan-900/40 bg-[#040814]/80 p-3 sm:p-4 shadow-inner">
            {/* Top Subheader inside Frame: System Indicator + Active Step */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-cyan-950/70 text-[10px] font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  ● {isZh ? '实时流向追踪' : 'REAL-TIME FLOW TRACE'}
                </span>
                <span className="text-slate-400 uppercase tracking-wider hidden md:inline">
                  {isZh ? '逐级顺序光流流转 · 动态数据包载荷穿透' : 'SEQUENTIAL OPTICAL PACKET PROPAGATION'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1">
                  <span className="text-slate-500">{isZh ? '当前流向:' : 'Flow:'}</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-700/60 text-[11px]">
                    STEP 0{activeStep} // {isZh ? currentFlow.titleZh : currentFlow.titleEn}
                  </span>
                </span>

                {/* Canvas Viewport Zoom & Fullscreen Controls */}
                <div className="flex items-center gap-1 ml-auto bg-[#070e1c] p-0.5 rounded border border-cyan-950 font-mono text-[10px]">
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setZoomLevel(0.85);
                    }}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer text-[9px] font-bold ${
                      zoomLevel === 0.85
                        ? 'bg-cyan-900 text-cyan-200 border border-cyan-400'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-950'
                    }`}
                    title={isZh ? '适应全景 85%' : 'Fit View'}
                  >
                    {isZh ? '适应' : 'Fit'}
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setZoomLevel((prev) => Math.max(0.65, +(prev - 0.1).toFixed(1)));
                    }}
                    className="p-1 rounded hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                    title={isZh ? '缩小视图' : 'Zoom Out'}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setZoomLevel(1.0);
                    }}
                    className="px-1.5 py-0.5 rounded hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 transition cursor-pointer text-[9.5px]"
                    title={isZh ? '还原 100%' : 'Reset Zoom'}
                  >
                    {(zoomLevel * 100).toFixed(0)}%
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setZoomLevel((prev) => Math.min(1.4, +(prev + 0.1).toFixed(1)));
                    }}
                    className="p-1 rounded hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                    title={isZh ? '放大视图' : 'Zoom In'}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setShowInspector(!showInspector);
                    }}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      !showInspector
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title={isZh ? '展开/收起侧栏检查器 (快捷键: I)' : 'Toggle Inspector (Key: I)'}
                  >
                    <span>{showInspector ? (isZh ? '收起侧栏 ❯' : 'Hide Panel') : (isZh ? '❮ 展开侧栏' : 'Show Panel')}</span>
                  </button>
                  <button
                    onClick={handleToggleFullscreen}
                    className="p-1 rounded hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 transition cursor-pointer ml-0.5"
                    title={isFullscreen ? '退出全屏 [Esc]' : '全屏显示'}
                  >
                    {isFullscreen ? <Minimize2 className="w-3 h-3 text-cyan-300" /> : <Maximize2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* REAL-TIME SEQUENTIAL FLOW BROADCAST BANNER & 11-STEP INTERACTIVE STEPPER */}
            <div className="mb-3 p-2.5 rounded-lg bg-[#050a16] border border-cyan-800/50 shadow-[0_0_20px_rgba(0,240,255,0.08)] flex flex-col gap-2 font-mono text-[11px]">
              {/* Top Row: Live Active Flow Transmission Announcement */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500 text-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    {isZh ? '正在流向' : 'STREAMING'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-cyan-300">{isZh ? currentFlow.fromZh : currentFlow.fromEn}</span>
                    <span className="text-slate-500">───⚡</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/60 text-[10px]">
                      {isZh ? currentFlow.packetZh : currentFlow.packetEn}
                    </span>
                    <span className="text-slate-500">───▶</span>
                    <span className="text-emerald-300">{isZh ? currentFlow.toZh : currentFlow.toEn}</span>
                  </div>
                </div>

                {/* Packet payload telemetry badge */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="text-cyan-400 font-bold">● {isZh ? '实时动作' : 'ACTION'}:</span>
                  <span className="text-slate-200">{isZh ? currentFlow.actionZh : currentFlow.actionEn}</span>
                </div>
              </div>

              {/* Bottom Row: 11-Step Interactive Progress Stepper */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-[10px]">
                {[
                  { step: 1, label: '01 需求' },
                  { step: 2, label: '02 自举' },
                  { step: 3, label: '03 融合' },
                  { step: 4, label: '04 推理' },
                  { step: 5, label: '05 调度' },
                  { step: 6, label: '06 分发' },
                  { step: 7, label: '07 观测' },
                  { step: 8, label: '08 门禁' },
                  { step: 9, label: '09 控制' },
                  { step: 10, label: '10 自愈' },
                  { step: 11, label: '11 交付' },
                ].map((item) => {
                  const isCurrent = activeStep === item.step;
                  const isPast = activeStep > item.step;
                  return (
                    <button
                      key={item.step}
                      onClick={() => {
                        soundFx.playKeyClick();
                        setIsPlayingTrace(false);
                        setActiveStep(item.step);
                      }}
                      className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 shrink-0 border ${
                        isCurrent
                          ? 'bg-cyan-950 text-cyan-200 border-cyan-400 font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)] ring-1 ring-cyan-400'
                          : isPast
                          ? 'bg-[#061222] text-cyan-500/80 border-cyan-900/60 hover:text-cyan-300 hover:border-cyan-700'
                          : 'bg-[#040812] text-slate-500 border-slate-900 hover:text-slate-400'
                      }`}
                      title={`点击直接跳转到该流向阶段: ${item.label}`}
                    >
                      <span>{isPast ? '✓' : isCurrent ? '▶' : '○'}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable / Scalable Container to ensure cards never squash on small screens */}
            <div className="relative w-full overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-900 select-none">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                className="relative min-w-[1080px] w-full aspect-[1600/780] overflow-hidden"
              >
                {/* Floating On-Canvas Model Display HUD */}
                <div className="absolute top-2.5 right-3 z-30 hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#040814]/90 border border-purple-500/50 text-[10px] font-mono text-slate-300 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span className="font-bold text-slate-100">{currentModel.name}</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-bold">{currentModel.tps} TPS</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-cyan-300 font-bold">{currentModel.ttftMs}ms</span>
                  {thinkingEnabled && currentModel.thinkingSupported && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-300 font-bold">思考: {(thinkingBudget / 1024).toFixed(0)}K</span>
                    </>
                  )}
                  <button
                    onClick={() => {
                      soundFx.playKeyClick();
                      setShowModelModal(true);
                    }}
                    className="ml-1 px-1.5 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-600 font-bold cursor-pointer transition text-[9px] flex items-center gap-1 shadow-sm"
                  >
                    <span>{isZh ? '模型显示' : 'Model'}</span>
                    <span>↗</span>
                  </button>
                </div>

                {/* Layer 1: Background Canvas for floating particles and photon rays */}
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

                {/* Layer 2: Vector SVG Circuit Traces & Glow Paths */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  viewBox="0 0 1600 780"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <style>
                      {`
                        @keyframes flowCyan {
                          from { stroke-dashoffset: 40; }
                          to { stroke-dashoffset: 0; }
                        }
                        @keyframes flowPurple {
                          from { stroke-dashoffset: 40; }
                          to { stroke-dashoffset: 0; }
                        }
                        @keyframes flowAmber {
                          from { stroke-dashoffset: 40; }
                          to { stroke-dashoffset: 0; }
                        }
                        @keyframes flowEmerald {
                          from { stroke-dashoffset: 40; }
                          to { stroke-dashoffset: 0; }
                        }
                        @keyframes flowRose {
                          from { stroke-dashoffset: 40; }
                          to { stroke-dashoffset: 0; }
                        }
                        .stream-active-laser {
                          stroke-dasharray: 8 6;
                          animation: flowCyan 0.45s linear infinite;
                          filter: drop-shadow(0 0 8px #00f0ff);
                        }
                        .stream-active-purple {
                          stroke-dasharray: 8 6;
                          animation: flowPurple 0.45s linear infinite;
                          filter: drop-shadow(0 0 8px #c084fc);
                        }
                        .stream-active-amber {
                          stroke-dasharray: 8 6;
                          animation: flowAmber 0.45s linear infinite;
                          filter: drop-shadow(0 0 8px #f59e0b);
                        }
                        .stream-active-rose {
                          stroke-dasharray: 8 6;
                          animation: flowRose 0.4s linear infinite;
                          filter: drop-shadow(0 0 10px #f43f5e);
                        }
                        .stream-active-emerald {
                          stroke-dasharray: 8 6;
                          animation: flowEmerald 0.45s linear infinite;
                          filter: drop-shadow(0 0 8px #10b981);
                        }
                      `}
                    </style>

                    {/* Cyan Glow Filter */}
                    <filter id="neon-cyan" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Purple Glow Filter */}
                    <filter id="neon-purple" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Amber Glow Filter */}
                    <filter id="neon-amber" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Emerald Glow Filter */}
                    <filter id="neon-emerald" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Rose Glow Filter */}
                    <filter id="neon-rose" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Arrow markers */}
                    <marker id="cyan-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="#00f0ff" />
                    </marker>
                    <marker id="purple-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="#c084fc" />
                    </marker>
                    <marker id="amber-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="#f59e0b" />
                    </marker>
                    <marker id="emerald-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="#10b981" />
                    </marker>
                    <marker id="rose-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="#f43f5e" />
                    </marker>
                    <marker id="dormant-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 1 2 L 11 6 L 1 10 z" fill="rgba(71, 85, 105, 0.4)" />
                    </marker>
                  </defs>

                  {/* =========================================================
                      STATE-AWARE REAL-TIME CONDUITS (DORMANT vs ACTIVE vs COMPLETED)
                     ========================================================= */}

                  {/* 1. Spine: 01 USER SIGNAL -> CLI BOOTSTRAP (Step 1) */}
                  <g className="flow-conduit-1">
                    {activeStep === 1 ? (
                      <>
                        <path d="M 185 141 L 185 155" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 185 141 L 185 155" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 185 141 L 185 155" />
                        </circle>
                        {/* Flying Data Packet Capsule */}
                        <g>
                          <rect x="-32" y="-8" width="64" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">PROMPT [38T]</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 185 141 L 185 155" />
                        </g>
                      </>
                    ) : activeStep > 1 ? (
                      <path d="M 185 141 L 185 155" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 185 141 L 185 155" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 2. Spine: CLI BOOTSTRAP -> 02 CONTEXT FUSION (Step 2) */}
                  <g className="flow-conduit-2">
                    {activeStep === 2 ? (
                      <>
                        <path d="M 330 198 C 365 198, 365 100, 390 100" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 330 198 C 365 198, 365 100, 390 100" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 330 198 C 365 198, 365 100, 390 100" />
                        </circle>
                        <g>
                          <rect x="-35" y="-8" width="70" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">SESSION [CWD]</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 330 198 C 365 198, 365 100, 390 100" />
                        </g>
                      </>
                    ) : activeStep > 2 ? (
                      <path d="M 330 198 C 365 198, 365 100, 390 100" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 330 198 C 365 198, 365 100, 390 100" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 3. Left Context Feed lines into 02 CONTEXT FUSION (Step 3) */}
                  {/* Card 1: Config Layer -> Prompt Assembly */}
                  <g className="flow-conduit-config">
                    {activeStep === 3 ? (
                      <>
                        <path d="M 330 298 C 365 298, 365 115, 390 115" fill="none" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="3.5" />
                        <path d="M 330 298 C 365 298, 365 115, 390 115" fill="none" stroke="#c084fc" strokeWidth="3" className="stream-active-purple" markerEnd="url(#purple-arrow)" />
                        <circle cx="330" cy="298" r="4" fill="#c084fc" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-purple)">
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 330 298 C 365 298, 365 115, 390 115" />
                        </circle>
                        <g>
                          <rect x="-26" y="-8" width="52" height="16" rx="4" fill="#120624" stroke="#c084fc" strokeWidth="1.2" filter="url(#neon-purple)" />
                          <text x="0" y="3" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="monospace" fontWeight="bold">CONFIG</text>
                          <animateMotion dur="0.9s" repeatCount="indefinite" path="M 330 298 C 365 298, 365 115, 390 115" />
                        </g>
                      </>
                    ) : activeStep > 3 ? (
                      <path d="M 330 298 C 365 298, 365 115, 390 115" fill="none" stroke="rgba(168, 85, 247, 0.45)" strokeWidth="1.8" markerEnd="url(#purple-arrow)" />
                    ) : (
                      <path d="M 330 298 C 365 298, 365 115, 390 115" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Card 2: Project Rules -> Prompt Assembly */}
                  <g className="flow-conduit-rules">
                    {activeStep === 3 ? (
                      <>
                        <path d="M 330 398 C 365 398, 365 130, 390 130" fill="none" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="3.5" />
                        <path d="M 330 398 C 365 398, 365 130, 390 130" fill="none" stroke="#c084fc" strokeWidth="3" className="stream-active-purple" markerEnd="url(#purple-arrow)" />
                        <circle cx="330" cy="398" r="4" fill="#c084fc" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-purple)">
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 330 398 C 365 398, 365 130, 390 130" />
                        </circle>
                        <g>
                          <rect x="-30" y="-8" width="60" height="16" rx="4" fill="#120624" stroke="#c084fc" strokeWidth="1.2" filter="url(#neon-purple)" />
                          <text x="0" y="3" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="monospace" fontWeight="bold">CLAUDE.md</text>
                          <animateMotion dur="0.9s" repeatCount="indefinite" path="M 330 398 C 365 398, 365 130, 390 130" />
                        </g>
                      </>
                    ) : activeStep > 3 ? (
                      <path d="M 330 398 C 365 398, 365 130, 390 130" fill="none" stroke="rgba(168, 85, 247, 0.45)" strokeWidth="1.8" markerEnd="url(#purple-arrow)" />
                    ) : (
                      <path d="M 330 398 C 365 398, 365 130, 390 130" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Card 3: Context Sources -> Prompt Assembly */}
                  <g className="flow-conduit-sources">
                    {activeStep === 3 ? (
                      <>
                        <path d="M 330 498 C 365 498, 365 145, 390 145" fill="none" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="3.5" />
                        <path d="M 330 498 C 365 498, 365 145, 390 145" fill="none" stroke="#c084fc" strokeWidth="3" className="stream-active-purple" markerEnd="url(#purple-arrow)" />
                        <circle cx="330" cy="498" r="4" fill="#c084fc" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-purple)">
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 330 498 C 365 498, 365 145, 390 145" />
                        </circle>
                        <g>
                          <rect x="-28" y="-8" width="56" height="16" rx="4" fill="#120624" stroke="#c084fc" strokeWidth="1.2" filter="url(#neon-purple)" />
                          <text x="0" y="3" textAnchor="middle" fill="#c084fc" fontSize="7" fontFamily="monospace" fontWeight="bold">HISTORY</text>
                          <animateMotion dur="0.9s" repeatCount="indefinite" path="M 330 498 C 365 498, 365 145, 390 145" />
                        </g>
                      </>
                    ) : activeStep > 3 ? (
                      <path d="M 330 498 C 365 498, 365 145, 390 145" fill="none" stroke="rgba(168, 85, 247, 0.45)" strokeWidth="1.8" markerEnd="url(#purple-arrow)" />
                    ) : (
                      <path d="M 330 498 C 365 498, 365 145, 390 145" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 4. Spine: 02 CONTEXT FUSION -> 03 MODEL INFERENCE (Step 4) */}
                  <g className="flow-conduit-fusion-to-model">
                    {activeStep === 4 ? (
                      <>
                        <path d="M 565 165 L 565 185" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 565 165 L 565 185" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 565 165 L 565 185" />
                        </circle>
                        <g>
                          <rect x="-35" y="-8" width="70" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">SYNTHESIS [4.9K]</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 565 165 L 565 185" />
                        </g>
                      </>
                    ) : activeStep > 4 ? (
                      <path d="M 565 165 L 565 185" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 565 165 L 565 185" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 5. Spine: 03 MODEL INFERENCE -> 04 AGENT ORCHESTRATOR (Step 5) */}
                  <g className="flow-conduit-model-to-orch">
                    {activeStep === 5 ? (
                      <>
                        <path d="M 565 375 L 565 395" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 565 375 L 565 395" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 565 375 L 565 395" />
                        </circle>
                        <g>
                          <rect x="-35" y="-8" width="70" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">TOOL CALL [Intent]</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 565 375 L 565 395" />
                        </g>
                      </>
                    ) : activeStep > 5 ? (
                      <path d="M 565 375 L 565 395" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 565 375 L 565 395" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 6. Orchestrator across to 3 Capabilities in Column 3 (Step 6) */}
                  {/* To Capability A: Skills */}
                  <g className="flow-conduit-orch-skills">
                    {activeStep === 6 ? (
                      <>
                        <path d="M 740 430 C 775 430, 775 100, 805 100" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 740 430 C 775 430, 775 100, 805 100" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 740 430 C 775 430, 775 100, 805 100" />
                        </circle>
                        <g>
                          <rect x="-25" y="-8" width="50" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7" fontFamily="monospace" fontWeight="bold">SKILLS</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 740 430 C 775 430, 775 100, 805 100" />
                        </g>
                      </>
                    ) : activeStep > 6 ? (
                      <path d="M 740 430 C 775 430, 775 100, 805 100" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 740 430 C 775 430, 775 100, 805 100" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* To Capability B: MCP Server */}
                  <g className="flow-conduit-orch-mcp">
                    {activeStep === 6 ? (
                      <>
                        <path d="M 740 450 C 775 450, 775 205, 805 205" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 740 450 C 775 450, 775 205, 805 205" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 740 450 C 775 450, 775 205, 805 205" />
                        </circle>
                        <g>
                          <rect x="-24" y="-8" width="48" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7" fontFamily="monospace" fontWeight="bold">MCP</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 740 450 C 775 450, 775 205, 805 205" />
                        </g>
                      </>
                    ) : activeStep > 6 ? (
                      <path d="M 740 450 C 775 450, 775 205, 805 205" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 740 450 C 775 450, 775 205, 805 205" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* To Capability C: Built-in Tools */}
                  <g className="flow-conduit-orch-tools">
                    {activeStep === 6 ? (
                      <>
                        <path d="M 740 470 C 775 470, 775 310, 805 310" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 740 470 C 775 470, 775 310, 805 310" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 740 470 C 775 470, 775 310, 805 310" />
                        </circle>
                        <g>
                          <rect x="-25" y="-8" width="50" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7" fontFamily="monospace" fontWeight="bold">TOOLS</text>
                          <animateMotion dur="0.8s" repeatCount="indefinite" path="M 740 470 C 775 470, 775 310, 805 310" />
                        </g>
                      </>
                    ) : activeStep > 6 ? (
                      <path d="M 740 470 C 775 470, 775 310, 805 310" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 740 470 C 775 470, 775 310, 805 310" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 7. Capabilities into Observation in Column 4 (Step 7) */}
                  {/* Capability A -> Observation */}
                  <g className="flow-conduit-capA-obs">
                    {activeStep === 7 ? (
                      <>
                        <path d="M 1140 100 C 1175 100, 1175 100, 1205 100" fill="none" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="3.5" />
                        <path d="M 1140 100 C 1175 100, 1175 100, 1205 100" fill="none" stroke="#c084fc" strokeWidth="3" className="stream-active-purple" markerEnd="url(#purple-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-purple)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1140 100 C 1175 100, 1175 100, 1205 100" />
                        </circle>
                      </>
                    ) : activeStep > 7 ? (
                      <path d="M 1140 100 C 1175 100, 1175 100, 1205 100" fill="none" stroke="rgba(168, 85, 247, 0.45)" strokeWidth="1.8" markerEnd="url(#purple-arrow)" />
                    ) : (
                      <path d="M 1140 100 C 1175 100, 1175 100, 1205 100" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Capability B -> Observation */}
                  <g className="flow-conduit-capB-obs">
                    {activeStep === 7 ? (
                      <>
                        <path d="M 1140 205 C 1175 205, 1175 125, 1205 125" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 1140 205 C 1175 205, 1175 125, 1205 125" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1140 205 C 1175 205, 1175 125, 1205 125" />
                        </circle>
                        <g>
                          <rect x="-30" y="-8" width="60" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7" fontFamily="monospace" fontWeight="bold">RESULTS</text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 1140 205 C 1175 205, 1175 125, 1205 125" />
                        </g>
                      </>
                    ) : activeStep > 7 ? (
                      <path d="M 1140 205 C 1175 205, 1175 125, 1205 125" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 1140 205 C 1175 205, 1175 125, 1205 125" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Capability C -> Observation */}
                  <g className="flow-conduit-capC-obs">
                    {activeStep === 7 ? (
                      <>
                        <path d="M 1140 310 C 1175 310, 1175 145, 1205 145" fill="none" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="3.5" />
                        <path d="M 1140 310 C 1175 310, 1175 145, 1205 145" fill="none" stroke="#38bdf8" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1140 310 C 1175 310, 1175 145, 1205 145" />
                        </circle>
                      </>
                    ) : activeStep > 7 ? (
                      <path d="M 1140 310 C 1175 310, 1175 145, 1205 145" fill="none" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 1140 310 C 1175 310, 1175 145, 1205 145" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 8. Sentinel Gate Conduits (Step 8) */}
                  {/* Built-in Tools -> Hooks */}
                  <g className="flow-conduit-hooks">
                    {activeStep === 8 ? (
                      <>
                        <path d="M 972 355 L 972 375" fill="none" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="3.5" />
                        <path d="M 972 355 L 972 375" fill="none" stroke="#f59e0b" strokeWidth="3" className="stream-active-amber" markerEnd="url(#amber-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-amber)">
                          <animateMotion dur="0.6s" repeatCount="indefinite" path="M 972 355 L 972 375" />
                        </circle>
                      </>
                    ) : activeStep > 8 ? (
                      <path d="M 972 355 L 972 375" fill="none" stroke="rgba(245, 158, 11, 0.45)" strokeWidth="1.8" markerEnd="url(#amber-arrow)" />
                    ) : (
                      <path d="M 972 355 L 972 375" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Hooks -> Permission Gate */}
                  <g className="flow-conduit-gate">
                    {activeStep === 8 ? (
                      <>
                        <path d="M 972 465 L 972 480" fill="none" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="3.5" />
                        <path d="M 972 465 L 972 480" fill="none" stroke="#f59e0b" strokeWidth="3" className="stream-active-amber" markerEnd="url(#amber-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-amber)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 972 465 L 972 480" />
                        </circle>
                        <g>
                          <rect x="-26" y="-8" width="52" height="16" rx="4" fill="#1c0f04" stroke="#f59e0b" strokeWidth="1.2" filter="url(#neon-amber)" />
                          <text x="0" y="3" textAnchor="middle" fill="#f59e0b" fontSize="7" fontFamily="monospace" fontWeight="bold">AUDIT</text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 972 465 L 972 480" />
                        </g>
                      </>
                    ) : activeStep > 8 ? (
                      <path d="M 972 465 L 972 480" fill="none" stroke="rgba(245, 158, 11, 0.45)" strokeWidth="1.8" markerEnd="url(#amber-arrow)" />
                    ) : (
                      <path d="M 972 465 L 972 480" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* Permission Gate -> Observation */}
                  <g className="flow-conduit-gate-return">
                    {activeStep === 8 ? (
                      <>
                        <path
                          d="M 1140 528 C 1180 528, 1180 155, 1205 155"
                          fill="none"
                          stroke={isSimulatingBlocked ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}
                          strokeWidth="3.5"
                        />
                        <path
                          d="M 1140 528 C 1180 528, 1180 155, 1205 155"
                          fill="none"
                          stroke={isSimulatingBlocked ? '#f43f5e' : '#10b981'}
                          strokeWidth="3"
                          className={isSimulatingBlocked ? 'stream-active-rose' : 'stream-active-emerald'}
                          markerEnd={isSimulatingBlocked ? 'url(#rose-arrow)' : 'url(#emerald-arrow)'}
                        />
                        <circle r="4.5" fill="#ffffff" filter={isSimulatingBlocked ? 'url(#neon-rose)' : 'url(#neon-emerald)'}>
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1140 528 C 1180 528, 1180 155, 1205 155" />
                        </circle>
                        <g>
                          <rect
                            x="-32"
                            y="-8"
                            width="64"
                            height="16"
                            rx="4"
                            fill="#030816"
                            stroke={isSimulatingBlocked ? '#f43f5e' : '#10b981'}
                            strokeWidth="1.2"
                            filter={isSimulatingBlocked ? 'url(#neon-rose)' : 'url(#neon-emerald)'}
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fill={isSimulatingBlocked ? '#f43f5e' : '#10b981'}
                            fontSize="7"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {isSimulatingBlocked ? 'HARD_DENY' : 'ALLOW [0ms]'}
                          </text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 1140 528 C 1180 528, 1180 155, 1205 155" />
                        </g>
                      </>
                    ) : activeStep > 8 ? (
                      <path
                        d="M 1140 528 C 1180 528, 1180 155, 1205 155"
                        fill="none"
                        stroke={isSimulatingBlocked ? 'rgba(244, 63, 94, 0.45)' : 'rgba(16, 185, 129, 0.45)'}
                        strokeWidth="1.8"
                        markerEnd={isSimulatingBlocked ? 'url(#rose-arrow)' : 'url(#emerald-arrow)'}
                      />
                    ) : (
                      <path d="M 1140 528 C 1180 528, 1180 155, 1205 155" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 9. Observation bottom -> 05 CONTROL LOOP (Step 9) */}
                  <g className="flow-conduit-obs-to-loop">
                    {activeStep === 9 ? (
                      <>
                        <path d="M 1380 170 L 1380 195" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 1380 170 L 1380 195" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1380 170 L 1380 195" />
                        </circle>
                        <g>
                          <rect x="-32" y="-8" width="64" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">EVALUATE</text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 1380 170 L 1380 195" />
                        </g>
                      </>
                    ) : activeStep > 9 ? (
                      <path d="M 1380 170 L 1380 195" fill="none" stroke="rgba(0, 240, 255, 0.45)" strokeWidth="2" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 1380 170 L 1380 195" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 10. Dedicated ITERATION LOOP (Feedback Loopback to 03 Model Inference, Step 10) */}
                  <g className="flow-conduit-loopback">
                    {loopbackActive || activeStep === 10 ? (
                      <>
                        <path d="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" fill="none" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="4" />
                        <path
                          d="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185"
                          fill="none"
                          stroke="#00f0ff"
                          strokeWidth="3.5"
                          className="stream-active-laser"
                          filter="url(#neon-cyan)"
                          markerEnd="url(#cyan-arrow)"
                        />
                        <circle r="5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="1.2s" repeatCount="indefinite" path="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" />
                        </circle>
                        <circle r="2.5" fill="#00f0ff" opacity="0.6">
                          <animateMotion dur="1.2s" begin="-0.3s" repeatCount="indefinite" path="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" />
                        </circle>
                        <g>
                          <rect x="-42" y="-8" width="84" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">AUTONOMOUS LOOP ↺</text>
                          <animateMotion dur="1.4s" repeatCount="indefinite" path="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" />
                        </g>
                      </>
                    ) : activeStep > 10 ? (
                      <path d="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" fill="none" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1.8" markerEnd="url(#cyan-arrow)" />
                    ) : (
                      <path d="M 1555 250 C 1590 250, 1580 28, 1400 28 L 700 28 C 580 28, 565 120, 565 185" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                    <text
                      x="1050"
                      y="20"
                      fill={loopbackActive || activeStep === 10 ? '#00f0ff' : 'rgba(100, 116, 139, 0.6)'}
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ↺ AUTONOMOUS REACT SELF-CORRECTION LOOPBACK (自主报错自愈回路)
                    </text>
                  </g>

                  {/* 11. Control Loop bottom -> FINALIZE (Step 11) */}
                  <g className="flow-conduit-loop-to-finalize">
                    {activeStep === 11 ? (
                      <>
                        <path d="M 1380 310 L 1380 335" fill="none" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="3.5" />
                        <path d="M 1380 310 L 1380 335" fill="none" stroke="#00f0ff" strokeWidth="3" className="stream-active-laser" markerEnd="url(#cyan-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-cyan)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1380 310 L 1380 335" />
                        </circle>
                        <g>
                          <rect x="-30" y="-8" width="60" height="16" rx="4" fill="#040914" stroke="#00f0ff" strokeWidth="1.2" filter="url(#neon-cyan)" />
                          <text x="0" y="3" textAnchor="middle" fill="#00f0ff" fontSize="7" fontFamily="monospace" fontWeight="bold">FINALIZE</text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 1380 310 L 1380 335" />
                        </g>
                      </>
                    ) : (
                      <path d="M 1380 310 L 1380 335" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>

                  {/* 12. FINALIZE bottom -> USER OUTPUT (Step 11) */}
                  <g className="flow-conduit-finalize-to-output">
                    {activeStep === 11 ? (
                      <>
                        <path d="M 1380 440 L 1380 465" fill="none" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="3.5" />
                        <path d="M 1380 440 L 1380 465" fill="none" stroke="#10b981" strokeWidth="3" className="stream-active-emerald" markerEnd="url(#emerald-arrow)" />
                        <circle r="4.5" fill="#ffffff" filter="url(#neon-emerald)">
                          <animateMotion dur="0.5s" repeatCount="indefinite" path="M 1380 440 L 1380 465" />
                        </circle>
                        <g>
                          <rect x="-32" y="-8" width="64" height="16" rx="4" fill="#02160d" stroke="#10b981" strokeWidth="1.2" filter="url(#neon-emerald)" />
                          <text x="0" y="3" textAnchor="middle" fill="#10b981" fontSize="7" fontFamily="monospace" fontWeight="bold">DELIVERY ↗</text>
                          <animateMotion dur="0.7s" repeatCount="indefinite" path="M 1380 440 L 1380 465" />
                        </g>
                      </>
                    ) : (
                      <path d="M 1380 440 L 1380 465" fill="none" stroke="rgba(71, 85, 105, 0.25)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dormant-arrow)" />
                    )}
                  </g>
                </svg>

                {/* 4 Architectural Phase Header Banners across 1600x780 Canvas */}
                <div
                  style={{ left: `${(40 / 1600) * 100}%`, top: `${(16 / 780) * 100}%`, width: `${(290 / 1600) * 100}%` }}
                  className="absolute pointer-events-none flex items-center justify-between px-2.5 py-1 rounded bg-cyan-950/50 border border-cyan-800/50 text-[10px] font-mono font-bold text-cyan-300 backdrop-blur-sm"
                >
                  <span>PHASE 01 // 摄取与环境</span>
                  <span className="text-[8.5px] text-cyan-400/80">INGESTION</span>
                </div>

                <div
                  style={{ left: `${(390 / 1600) * 100}%`, top: `${(16 / 780) * 100}%`, width: `${(350 / 1600) * 100}%` }}
                  className="absolute pointer-events-none flex items-center justify-between px-2.5 py-1 rounded bg-purple-950/50 border border-purple-800/50 text-[10px] font-mono font-bold text-purple-300 backdrop-blur-sm"
                >
                  <span>PHASE 02 // 认知推理中枢</span>
                  <span className="text-[8.5px] text-purple-400/80">REASONING CORE</span>
                </div>

                <div
                  style={{ left: `${(805 / 1600) * 100}%`, top: `${(16 / 780) * 100}%`, width: `${(335 / 1600) * 100}%` }}
                  className="absolute pointer-events-none flex items-center justify-between px-2.5 py-1 rounded bg-amber-950/50 border border-amber-800/50 text-[10px] font-mono font-bold text-amber-300 backdrop-blur-sm"
                >
                  <span>PHASE 03 // 工具矩阵与门禁</span>
                  <span className="text-[8.5px] text-amber-400/80">CAPABILITIES & POLICY</span>
                </div>

                <div
                  style={{ left: `${(1205 / 1600) * 100}%`, top: `${(16 / 780) * 100}%`, width: `${(350 / 1600) * 100}%` }}
                  className="absolute pointer-events-none flex items-center justify-between px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-800/50 text-[10px] font-mono font-bold text-emerald-300 backdrop-blur-sm"
                >
                  <span>PHASE 04 // 观测与产物交付</span>
                  <span className="text-[8.5px] text-emerald-400/80">OBSERVATION & OUTPUT</span>
                </div>

                {/* Bottom Concurrency & Runtime Bus Live Strip */}
                <div
                  style={{ left: `${(40 / 1600) * 100}%`, top: `${(600 / 780) * 100}%`, width: `${(1515 / 1600) * 100}%`, height: `${(160 / 780) * 100}%` }}
                  className="absolute rounded-xl border border-cyan-900/60 bg-[#040816]/90 p-3 backdrop-blur-md flex flex-col justify-between text-xs font-mono"
                >
                  <div className="flex items-center justify-between border-b border-cyan-950/80 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span className="font-bold text-cyan-300 tracking-wider text-[11px]">RUNTIME BUS & CONCURRENCY // 实时运行总线与并发监控</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[9px] border border-cyan-800">100% HEALTHY</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[9.5px] text-slate-400">
                      <span>IO: <strong className="text-emerald-400">STDIO / PTY</strong></span>
                      <span>MEMORY: <strong className="text-purple-300">142.8 MB RSS</strong></span>
                      <span>LATENCY: <strong className="text-cyan-300">0.4ms LAG</strong></span>
                      <span>ZERO-TRUST: <strong className={isSimulatingBlocked ? "text-rose-400 animate-pulse" : "text-emerald-400"}>{isSimulatingBlocked ? "TRIPWIRE HARD_DENY" : "ACTIVE ENFORCED"}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5 text-[10px] pt-1 text-slate-300">
                    <div className="bg-[#061022] rounded p-2 border border-cyan-950/70">
                      <div className="text-[8.5px] text-slate-500 uppercase font-bold">Phase 1 Status</div>
                      <div className="text-cyan-300 font-bold mt-0.5 truncate">Prompt & AST Synced</div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">482 Files Indexed · 0ms Drift</div>
                    </div>
                    <div className="bg-[#0b0c24] rounded p-2 border border-purple-950/70">
                      <div className="text-[8.5px] text-slate-500 uppercase font-bold">Phase 2 Inference</div>
                      <div className="text-purple-300 font-bold mt-0.5 truncate">{currentModel.name} · {currentModel.tps} TPS</div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">TTFT: {currentModel.ttftMs}ms · Thinking Ready</div>
                    </div>
                    <div className="bg-[#1c1206] rounded p-2 border border-amber-950/70">
                      <div className="text-[8.5px] text-slate-500 uppercase font-bold">Phase 3 Dispatch</div>
                      <div className="text-amber-300 font-bold mt-0.5 truncate">3 Capability Bridges Online</div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">Skills + MCP stdio + Shell Sandbox</div>
                    </div>
                    <div className="bg-[#041a12] rounded p-2 border border-emerald-950/70">
                      <div className="text-[8.5px] text-slate-500 uppercase font-bold">Phase 4 Loopback</div>
                      <div className="text-emerald-300 font-bold mt-0.5 truncate">Turn 1/8 · Converged</div>
                      <div className="text-[8.5px] text-slate-400 mt-0.5">Diff Ready for User Delivery</div>
                    </div>
                  </div>
                </div>

                {/* Layer 3: Interactive DOM Nodes Placed via Strict Percentage Coordinates */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isCurrentTraceStep =
                    (activeStep === 1 && node.id === 'user_signal') ||
                    (activeStep === 2 && node.id === 'cli_bootstrap') ||
                    (activeStep === 3 &&
                      (node.id === 'config_layer' ||
                        node.id === 'project_rules' ||
                        node.id === 'context_sources')) ||
                    (activeStep === 4 && node.id === 'prompt_assembly') ||
                    (activeStep === 5 && node.id === 'model_inference') ||
                    (activeStep === 6 && node.id === 'agent_orchestrator') ||
                    (activeStep === 7 &&
                      (node.id === 'capability_skills' ||
                        node.id === 'capability_mcp' ||
                        node.id === 'capability_tools')) ||
                    (activeStep === 8 &&
                      (node.id === 'cross_hooks' || node.id === 'cross_permission')) ||
                    (activeStep === 9 && node.id === 'observation') ||
                    (activeStep === 10 && node.id === 'control_loop') ||
                    (activeStep === 11 &&
                      (node.id === 'finalize' || node.id === 'user_output'));

                  // Theming per category
                  let borderClass = 'border-cyan-800/80 bg-[#091324]/95 text-slate-200';
                  let titleColor = 'text-cyan-300';
                  let activeHalo = 'shadow-[0_0_24px_rgba(0,240,255,0.7)] ring-1.5 ring-cyan-400';

                  if (node.category === 'context') {
                    borderClass = 'border-purple-800/80 bg-[#120d26]/95 text-slate-200';
                    titleColor = 'text-purple-300';
                    activeHalo = 'shadow-[0_0_24px_rgba(168,85,247,0.7)] ring-1.5 ring-purple-400';
                  } else if (node.category === 'policy') {
                    if (isSimulatingBlocked && node.id === 'cross_permission') {
                      borderClass = 'border-rose-500 bg-[#2b0816]/95 text-rose-100';
                      titleColor = 'text-rose-300';
                      activeHalo = 'shadow-[0_0_28px_rgba(244,63,94,0.9)] ring-2 ring-rose-400';
                    } else {
                      borderClass = 'border-amber-700/80 bg-[#1c1407]/95 text-slate-200';
                      titleColor = 'text-amber-300';
                      activeHalo = 'shadow-[0_0_24px_rgba(245,158,11,0.7)] ring-1.5 ring-amber-400';
                    }
                  } else if (node.id === 'user_output') {
                    borderClass = 'border-emerald-500 bg-emerald-950/90 text-emerald-200';
                    titleColor = 'text-emerald-300';
                    activeHalo = 'shadow-[0_0_24px_rgba(16,185,129,0.8)] ring-2 ring-emerald-400';
                  }

                  return (
                    <div
                      key={node.id}
                      onClick={() => {
                        soundFx.playKeyClick();
                        setSelectedNodeId(node.id);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      style={{
                        position: 'absolute',
                        left: `${(node.x / 1600) * 100}%`,
                        top: `${(node.y / 780) * 100}%`,
                        width: `${(node.w / 1600) * 100}%`,
                        height: `${(node.h / 780) * 100}%`,
                      }}
                      className={`z-20 rounded-lg px-2.5 py-1.5 flex flex-col justify-between border transition-all duration-300 cursor-pointer overflow-hidden ${borderClass} ${
                        isSelected || isCurrentTraceStep
                          ? activeHalo
                          : 'hover:border-cyan-400 hover:bg-[#0c1a32]'
                      }`}
                    >
                      {/* Header Row: Code & Tag */}
                      <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                        <span className={`${titleColor} font-bold tracking-tight truncate`}>
                          {node.code}
                        </span>
                        <div className="flex items-center gap-1">
                          {node.tag && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 whitespace-nowrap">
                              {node.tag}
                            </span>
                          )}
                          {node.id === 'model_inference' && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
                          )}
                          {isCurrentTraceStep && node.id !== 'model_inference' && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Main Title */}
                      <div className="text-[11px] font-bold text-slate-100 truncate">
                        {isZh ? node.titleZh : node.titleEn}
                      </div>

                      {/* Subtitle */}
                      <div className="text-[9px] text-slate-400 truncate leading-tight">
                        {isZh ? node.subtitleZh : node.subtitleEn}
                      </div>

                      {/* Model Quick Actions on Node Card */}
                      {node.id === 'model_inference' && (
                        <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-cyan-800/60 font-mono text-[8.5px]">
                          <span className="text-cyan-300 font-bold flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            {currentModel.name} · {currentModel.tps} TPS
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              soundFx.playKeyClick();
                              setShowModelModal(true);
                            }}
                            className="px-1.5 py-0.2 rounded bg-purple-950/90 hover:bg-purple-800 text-purple-200 border border-purple-500 font-bold transition cursor-pointer shrink-0 shadow-sm"
                            title={isZh ? '打开模型显示与参数控制面板' : 'Open Model Display'}
                          >
                            {isZh ? '👁️ 模型显示' : '👁️ Model'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Re-Open Inspector Tab when collapsed or when in fullscreen */}
        {(!showInspector || isFullscreen) && (
          <button
            onClick={() => {
              soundFx.playKeyClick();
              setShowInspector((prev) => !prev);
            }}
            className={`fixed md:absolute right-4 ${
              isFullscreen ? 'top-16 z-50' : 'top-1/2 -translate-y-1/2 z-30'
            } bg-[#040a18]/95 hover:bg-cyan-950 border border-cyan-500/60 text-cyan-300 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.35)] transition flex items-center gap-1.5 hover:text-white`}
            title={isZh ? '展开/收起检查器侧栏 (快捷键: I)' : 'Toggle Inspector Panel (Key: I)'}
          >
            <span>{showInspector ? '✕' : 'ℹ️'}</span>
            <span>{isZh ? (showInspector ? '收起检查器' : '节点检查器') : (showInspector ? 'Close Panel' : 'Inspector')}</span>
          </button>
        )}

        {/* ================= RIGHT: TRACE INSPECTOR & TELEMETRY ================= */}
        {showInspector && (
          <div
            className={`${
              isFullscreen
                ? 'fixed top-16 right-4 bottom-4 w-[390px] max-w-[90vw] z-50 bg-[#060b18]/95 backdrop-blur-xl border border-cyan-500/60 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.85)]'
                : 'bg-[#060b18] border-t xl:border-t-0 xl:border-l border-cyan-900/50 max-h-[880px]'
            } p-4 sm:p-5 flex flex-col gap-4 text-xs font-sans z-20 overflow-y-auto`}
          >
            {/* Header Section */}
            <div className="border-b border-cyan-900/50 pb-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <span className="font-bold uppercase tracking-wider">TRACE INSPECTOR</span>
                <button
                  onClick={() => setShowInspector(false)}
                  className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer font-bold flex items-center gap-1"
                  title={isZh ? '收起侧栏检查器 (快捷键: I)' : 'Hide Panel'}
                >
                  <span>{isZh ? '收起 ✕' : 'Hide ✕'}</span>
                </button>
              </div>
            <h2 className="text-sm font-bold text-slate-100 font-mono mt-1">
              SYSTEM OVERVIEW // Agent 神经网络链路
            </h2>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              选择任意节点查看职责、输入输出与执行边界。运行 Trace 可模拟端到端真实调用路径。
            </p>
          </div>

          {/* Active Inspected Node Card */}
          <div className="bg-[#091326] border border-cyan-800/60 rounded-xl p-3.5 shadow-lg flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                {activeNode.code}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  activeNode.riskLevel === 'critical'
                    ? 'bg-rose-950 text-rose-300 border border-rose-500'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {activeNode.riskLevel === 'critical' ? 'RISK: CRITICAL' : 'RISK: NOMINAL'}
              </span>
            </div>

            <div className="text-sm font-black text-slate-100 font-mono">
              {isZh ? activeNode.titleZh : activeNode.titleEn}
            </div>

            <div className="text-[11px] text-cyan-300/90 leading-relaxed bg-[#050a14] p-2.5 rounded border border-cyan-950">
              {isZh ? activeNode.roleZh : activeNode.roleEn}
            </div>

            {/* Inputs & Outputs */}
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="bg-black/50 p-2 rounded border border-slate-800">
                <div className="text-[9px] text-slate-400 uppercase font-bold text-cyan-400">
                  INPUT SOURCE:
                </div>
                <div className="text-slate-200 mt-0.5 truncate">
                  {isZh ? activeNode.inputZh : activeNode.inputEn}
                </div>
              </div>
              <div className="bg-black/50 p-2 rounded border border-slate-800">
                <div className="text-[9px] text-slate-400 uppercase font-bold text-emerald-400">
                  OUTPUT ARTIFACT:
                </div>
                <div className="text-slate-200 mt-0.5 truncate">
                  {isZh ? activeNode.outputZh : activeNode.outputEn}
                </div>
              </div>
            </div>

            {/* Telemetry JSON snippet */}
            <div className="bg-black/70 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-slate-400">
              <div className="text-[9px] text-purple-400 font-bold mb-1">NODE RUNTIME TELEMETRY:</div>
              <pre className="text-cyan-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(activeNode.telemetry, null, 2)}
              </pre>
            </div>
          </div>

          {/* Execution Pipeline (5 Phases) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-300">
                EXECUTION PIPELINE
              </span>
              <span>5 PHASES</span>
            </div>

            <div className="space-y-1 text-[11px] font-mono">
              {[
                { phase: '01', title: 'INPUT / BOOTSTRAP', desc: 'Prompt · CLI · Session · Config' },
                { phase: '02', title: 'CONTEXT FUSION', desc: 'CLAUDE.md · History · Prompt Assembly' },
                { phase: '03', title: 'REASON / ROUTE', desc: 'LLM · Orchestrator · Skill / MCP / Tools' },
                { phase: '04', title: 'GUARD / EXECUTE', desc: 'Hooks · Permissions · Tool result' },
                { phase: '05', title: 'OBSERVE / ITERATE', desc: 'Context update · Retry · Final output' },
              ].map((item, idx) => {
                const phaseNum = idx + 1;
                const isPhaseActive = activeNode.phaseId === phaseNum;
                return (
                  <div
                    key={item.phase}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border transition ${
                      isPhaseActive
                        ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                        : 'bg-[#091222]/60 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isPhaseActive ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.phase}
                    </span>
                    <div>
                      <div className={`font-bold ${isPhaseActive ? 'text-slate-100' : 'text-slate-300'}`}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Runtime Telemetry (Simulated 4-grid) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-300">
                RUNTIME TELEMETRY
              </span>
              <span className="text-emerald-400 font-bold">SIMULATED</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="bg-[#091224] border border-cyan-900/50 p-2.5 rounded-lg">
                <div className="text-lg font-black text-cyan-300">0{activeStep}</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">TRACE STEPS</div>
              </div>
              <div className="bg-[#091224] border border-cyan-900/50 p-2.5 rounded-lg">
                <div className="text-lg font-black text-purple-300">17</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">CORE NODES</div>
              </div>
              <div className="bg-[#091224] border border-cyan-900/50 p-2.5 rounded-lg">
                <div className="text-lg font-black text-amber-300">02</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">CONTROL GATES</div>
              </div>
              <div className="bg-[#091224] border border-cyan-900/50 p-2.5 rounded-lg">
                <div className="text-lg font-black text-emerald-300">∞</div>
                <div className="text-[10px] text-slate-400 uppercase mt-0.5">LOOP CAPACITY</div>
              </div>
            </div>
          </div>

          {/* Architecture Note Callout */}
          <div className="bg-[#07101f] border border-slate-800 p-3 rounded-lg text-[10px] text-slate-400 leading-relaxed font-sans">
            <div className="text-cyan-400 font-bold font-mono text-[11px] mb-1">
              ARCHITECTURE NOTE
            </div>
            概念架构，不是私有源码追踪。Claude Code 的真实内部提示词模板、模型调用顺序及运行时实现并非全部公开。Skills、MCP、Hooks 都是按任务和配置触发的能力，不代表每次请求必经；权限机制也可能因运行模式而异。
          </div>
        </div>
      )}
    </div>

      {/* Model Display & Reasoning Center Modal */}
      <ModelDisplayModal
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        language={language}
        selectedModelId={selectedModelId}
        onSelectModel={(modelId) => {
          setSelectedModelId(modelId);
          soundFx.playChirp();
        }}
        thinkingEnabled={thinkingEnabled}
        onToggleThinking={setThinkingEnabled}
        thinkingBudget={thinkingBudget}
        onChangeThinkingBudget={setThinkingBudget}
        temperature={temperature}
        onChangeTemperature={setTemperature}
        promptSnippet={userPromptInput}
      />
    </div>
  );
};
