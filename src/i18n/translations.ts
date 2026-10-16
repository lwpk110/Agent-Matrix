export type Language = 'en' | 'zh';

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  terminalVersion: string;
  statusActive: string;
  statusPaused: string;
  modeClaude: string;
  modeCodex: string;
  modeHybrid: string;
  speed: string;
  muteAudio: string;
  unmuteAudio: string;
  alertBanner: string;
  
  // Advisor Panel
  advisorTitle: string;
  advisorRoleCode: string;
  advisorStandby: string;
  advisorWoken: string;
  riskGate: string;
  riskCeiling: string;
  astWatchers: string;
  securityBreachProtocol: string;
  proposedAstPatch: string;
  btnSignPatch: string;
  btnDismissFalse: string;
  simulateRisk: string;
  autopilotActive: string;
  checks: {
    evalGuard: string;
    fsGuard: string;
    oauthWatcher: string;
    consensus: string;
    passed: string;
    failed: string;
    watching: string;
  };

  // Main Session Panel
  mainSessionTitle: string;
  planExecution: string;
  contextTokens: string;
  activeDirective: string;
  defaultDirective: string;
  synthesizingDiff: string;
  activePlanHierarchy: string;
  planSteps: string[];

  // JEV Router Panel
  routerTitle: string;
  routerSubtitle: string;
  entropy: string;
  monteCarlo: string;
  pInlineTitle: string;
  pInlineLatency: string;
  pInlineCost: string;
  pSubagentsTitle: string;
  pSubagentsDesc: string;
  pSubagentsArgmax: string;
  pEscalateTitle: string;
  pEscalateDesc: string;
  pEscalateGate: string;
  routerDirective: string;
  btnForceInline: string;
  btnForceFleet: string;
  btnRecalculate: string;

  // Subagents Dispatcher Panel
  dispatcherTitle: string;
  dispatcherSubtitle: string;
  ch1Dispatch: string;
  worker01Title: string;
  worker01Payload: string;
  explorer02Title: string;
  explorer02Payload: string;
  researcher03Title: string;
  researcher03Payload: string;
  progress: string;
  itemsProcessed: string;
  btnTick: string;
  btnRestartAll: string;

  // Neural Badges
  badgeReview: string;
  badgePlan: string;
  badgeRoute: string;
  badgeAst: string;
  badgeDocs: string;
  badgeTests: string;

  // Live Session Log
  liveLogTitle: string;
  eventsCount: string;
  filterAll: string;
  filterDiff: string;
  filterTool: string;
  filterRouter: string;
  filterAlert: string;
  btnAutoScroll: string;
  btnClearBuffer: string;
  bufferEmpty: string;

  // Interactive CLI Bar
  injectToolCall: string;
  toolBash: string;
  toolFileEdit: string;
  toolGrep: string;
  toolAst: string;
  toggleMode: string;
  triggerOAuthAlert: string;
  dispatchFleet: string;
  tuiScriptBtn: string;
  cliInputPlaceholder: string;
  btnRun: string;

  // Native TUI Modal
  modalTitle: string;
  tabMatrix: string;
  tabHook: string;
  btnCopy: string;
  btnCopied: string;
  btnDownload: string;
  modalRunLocally: string;
  modalDesc: string;

  // Agent Black Box Deconstruction HUD
  blackBox: {
    title: string;
    subtitle: string;
    tabPipeline: string;
    tabPrompts: string;
    tabMcpHooks: string;
    tabPermissions: string;
    btnRunFullTrace: string;
    btnTriggerMcpHook: string;
    btnSimulateDenial: string;
    btnInjectDirective: string;
    stagePrompt: string;
    stageLlm: string;
    stageMcpHook: string;
    stagePermission: string;
    stageSandbox: string;
    stageFeedback: string;
    promptAnatomy: string;
    systemPrompt: string;
    mcpToolDefs: string;
    dynamicContext: string;
    injectedDirectives: string;
    mcpRegistry: string;
    hookTimeline: string;
    zeroTrustSandbox: string;
    securityFirewall: string;
    tokenBurnBreakdown: string;
    livePacketStream: string;
    tabCallChain: string;
    stepNumber: string;
    callerCallee: string;
    autoFlow: string;
    stepThrough: string;
    resetChain: string;
    flowRate: string;
    scenarioSelector: string;
    scenarioStandard: string;
    scenarioBlocked: string;
    scenarioMultiMcp: string;
    dataPayloads: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    appTitle: 'AGENT MATRIX',
    appSubtitle: 'NEURAL TREE',
    terminalVersion: 'v2.4-TUI',
    statusActive: 'LIVE',
    statusPaused: 'PAUSED',
    modeClaude: 'Claude Code',
    modeCodex: 'OpenAI Codex',
    modeHybrid: 'Hybrid Matrix',
    speed: 'Speed',
    muteAudio: 'Mute audio FX',
    unmuteAudio: 'Enable audio FX',
    alertBanner: 'OPUS WOKEN: RISK ALERT',

    // Advisor Panel
    advisorTitle: 'On-Call Advisor',
    advisorRoleCode: 'ANTHROPIC::CLAUDE-OPUS',
    advisorStandby: 'STATUS: ON-CALL STANDBY',
    advisorWoken: 'STATUS: WOKEN (HIGH RISK)',
    riskGate: 'Invariant Risk Gate:',
    riskCeiling: 'ceil',
    astWatchers: 'AST Policy Watchers',
    securityBreachProtocol: 'SECURITY BREACH PROTOCOL',
    proposedAstPatch: 'Proposed AST Invariant Patch:',
    btnSignPatch: 'SIGN & PATCH',
    btnDismissFalse: 'DISMISS FALSE',
    simulateRisk: 'Simulate Risk',
    autopilotActive: 'AUTOPILOT: ACTIVE',
    checks: {
      evalGuard: 'eval() / Function() injection guard',
      fsGuard: 'fs.writeFile mutation bounds (src/)',
      oauthWatcher: 'OAuth credential exfiltration watcher',
      consensus: 'Subagent AST patch consensus',
      passed: 'PASS',
      failed: 'FAIL',
      watching: 'WATCH',
    },

    // Main Session Panel
    mainSessionTitle: 'Main Session Controller',
    planExecution: 'PLAN EXECUTION:',
    contextTokens: 'CONTEXT:',
    activeDirective: 'Active Agent Directive',
    defaultDirective:
      'Refactor authentication pipeline to zero-trust OAuth2 with PKCE state verification, AST transformation, and parallel test suite verification.',
    synthesizingDiff: 'SYNTHESIZING DIFF',
    activePlanHierarchy: 'Active Plan Hierarchy',
    planSteps: [
      '01. Index authentication call sites (14 files)',
      '02. Validate OAuth2 RFC PKCE security bounds',
      '03. JEV Fork: Delegate AST patch to 3x Haiku Fleet',
      '04. Run test regression suite (112/112 suites)',
    ],

    // JEV Router Panel
    routerTitle: 'JEV Fork Probability Router',
    routerSubtitle: 'JOINT EXPECTED VALUE · HEURISTIC ESTIMATOR',
    entropy: 'ENTROPY:',
    monteCarlo: 'MONTE-CARLO:',
    pInlineTitle: 'P(Inline Single-Shot)',
    pInlineLatency: 'Latency: ~800ms',
    pInlineCost: 'Cost: $0.003',
    pSubagentsTitle: 'P(Triple Subagents)',
    pSubagentsDesc: 'Delegated Fleet (x3)',
    pSubagentsArgmax: 'ARGMAX CHOICE',
    pEscalateTitle: 'P(Advisor Escalation)',
    pEscalateDesc: 'Trigger: Risk > 5%',
    pEscalateGate: 'Opus Gate',
    routerDirective: 'ROUTER DIRECTIVE:',
    btnForceInline: 'Force Single-Shot',
    btnForceFleet: 'Force Parallel Fleet',
    btnRecalculate: 'Recalculate JEV distribution',

    // Subagents Dispatcher Panel
    dispatcherTitle: 'Subagent Dispatcher',
    dispatcherSubtitle: 'LOW-LATENCY PARALLEL WORKERS',
    ch1Dispatch: 'CH1: DISPATCH',
    worker01Title: 'Worker #01',
    worker01Payload: 'Synthesizing AST Node visitor for PKCE token validation in src/auth/oauth2.ts',
    explorer02Title: 'Explorer #02',
    explorer02Payload: 'Semantic grep across RFC 7636 PKCE spec & local authorization callbacks',
    researcher03Title: 'Researcher #03',
    researcher03Payload: 'Running Vitest fuzz regression matrix: 112/112 test suites passing',
    progress: 'PROGRESS',
    itemsProcessed: 'items',
    btnTick: 'Tick',
    btnRestartAll: 'Restart all 3 parallel subagents',

    // Neural Badges
    badgeReview: '[review]',
    badgePlan: '[plan]',
    badgeRoute: '[route]',
    badgeAst: '[AST]',
    badgeDocs: '[docs]',
    badgeTests: '[112/112]',

    // Live Session Log
    liveLogTitle: 'LIVE SESSION LOG STREAM',
    eventsCount: 'events',
    filterAll: 'ALL',
    filterDiff: 'DIFF',
    filterTool: 'TOOL',
    filterRouter: 'ROUTER',
    filterAlert: 'ALERT',
    btnAutoScroll: 'Auto',
    btnClearBuffer: 'Clear current stream buffer',
    bufferEmpty: 'Buffer empty. Click "Inject Tool Call" or trigger subagent activity to stream events.',

    // Interactive CLI Bar
    injectToolCall: 'Inject Tool Call',
    toolBash: 'Bash: git status --porcelain',
    toolFileEdit: 'FileEdit: src/auth/oauth2.ts',
    toolGrep: 'Grep: OAuth2Callback / PKCE',
    toolAst: 'ASTParse: ts.createSourceFile()',
    toggleMode: 'Mode:',
    triggerOAuthAlert: 'Trigger OAuth Risk Alert',
    dispatchFleet: 'Dispatch Fleet',
    tuiScriptBtn: 'Terminal TUI Script (.py)',
    cliInputPlaceholder: "type 'help', 'inject bash', 'alert', 'mode codex', 'clear', 'lang zh'...",
    btnRun: 'RUN',

    // Native TUI Modal
    modalTitle: 'Native Terminal TUI Scripts (cli/ & hooks/)',
    tabMatrix: 'cli/agent_matrix.py',
    tabHook: 'hooks/emit_event.py',
    btnCopy: 'Copy',
    btnCopied: 'Copied',
    btnDownload: 'Download .py',
    modalRunLocally: 'Run locally:',
    modalDesc: 'Pure Linux terminal Textual TUI',

    // Agent Black Box Deconstruction HUD
    blackBox: {
      title: 'AGENT BLACK BOX OBSERVABILITY MATRIX',
      subtitle: 'PROMPTS • MCP HOOKS • PERMISSIONS • DYNAMIC TRACE',
      tabPipeline: '⚡ Dynamic Pipeline Topology',
      tabPrompts: '🔮 Live Prompt Decomposition',
      tabMcpHooks: '🪝 MCP Hook Interception Stream',
      tabPermissions: '🛡️ Zero-Trust Permission Firewall',
      btnRunFullTrace: 'Run Full Black Box Trace',
      btnTriggerMcpHook: 'Trigger MCP PreTool Hook',
      btnSimulateDenial: 'Simulate Permission Denial',
      btnInjectDirective: 'Inject Dynamic Prompt',
      stagePrompt: 'Task & Context Rules',
      stageLlm: 'AI Reasoning & Plan',
      stageMcpHook: 'Tools & Skills Prep',
      stagePermission: 'Safety Sentinel & Gate',
      stageSandbox: 'Execution Sandbox',
      stageFeedback: 'Verification & Next Step',
      promptAnatomy: 'Task Structure & Context Tokens',
      systemPrompt: 'System Rules & Guidelines',
      mcpToolDefs: 'MCP Tool Schemas',
      dynamicContext: 'Dynamic Context & AST State',
      injectedDirectives: 'Injected Directives',
      mcpRegistry: 'Active MCP Server Registry',
      hookTimeline: 'Hook Lifecycle Stream',
      zeroTrustSandbox: 'Zero-Trust Capability Matrix',
      securityFirewall: 'Least-Privilege Security Rules',
      tokenBurnBreakdown: 'Token Layer Distribution',
      livePacketStream: 'Dynamic Packet Trace',
      tabCallChain: 'Call Chain & Orderly Flow',
      stepNumber: 'Execution Step',
      callerCallee: 'Caller ➔ Callee',
      autoFlow: 'Auto Flow (Loop)',
      stepThrough: 'Step Through (Next)',
      resetChain: 'Reset Pipeline',
      flowRate: 'Packet Speed',
      scenarioSelector: 'Pipeline Scenario',
      scenarioStandard: 'Normal Tool Execution Chain',
      scenarioBlocked: 'Zero-Trust Denial & Intercept',
      scenarioMultiMcp: 'Multi-MCP Coordinated Pipeline',
      dataPayloads: 'Flowing Data Packets & Payloads',
    },
  },

  zh: {
    appTitle: '智能体矩阵',
    appSubtitle: '神经拓扑树',
    terminalVersion: 'v2.4-TUI',
    statusActive: '实时运行',
    statusPaused: '已暂停',
    modeClaude: 'Claude Code 体系',
    modeCodex: 'OpenAI Codex 体系',
    modeHybrid: '混合矩阵模式',
    speed: '仿真倍速',
    muteAudio: '静音终端音效',
    unmuteAudio: '开启终端音效',
    alertBanner: 'OPUS 被唤醒: 安全告警',

    // Advisor Panel
    advisorTitle: '值守安全顾问',
    advisorRoleCode: 'ANTHROPIC::CLAUDE-OPUS-值守',
    advisorStandby: '状态: 在线值守 (低风险)',
    advisorWoken: '状态: 深度唤醒 (高危介入)',
    riskGate: '代码不变量风险门限:',
    riskCeiling: '上限',
    astWatchers: 'AST 语法安全守卫监控项',
    securityBreachProtocol: '安全违规应急协议触发',
    proposedAstPatch: '拟定 AST 不变量安全补丁:',
    btnSignPatch: '签署并注入补丁',
    btnDismissFalse: '误报解除',
    simulateRisk: '模拟风险逃逸',
    autopilotActive: '自动审计: 激活',
    checks: {
      evalGuard: 'eval() 与 Function 注入防护',
      fsGuard: 'fs.writeFile 写入边界约束 (src/)',
      oauthWatcher: 'OAuth 凭证越权与回传外泄嗅探',
      consensus: '并行子智能体 AST 补丁共识签名',
      passed: '通过',
      failed: '违规',
      watching: '监控中',
    },

    // Main Session Panel
    mainSessionTitle: '主会话控制台',
    planExecution: '计划执行进度:',
    contextTokens: '上下文配额:',
    activeDirective: '当前智能体核心指令',
    defaultDirective:
      '重构认证链路为零信任 OAuth2 架构，集成 PKCE 状态参数校验、AST 语法树自动转换及并行回归套件验证。',
    synthesizingDiff: '生成代码补丁中',
    activePlanHierarchy: '执行计划阶梯图',
    planSteps: [
      '01. 索引全量认证调用点 (14 个文件)',
      '02. 校验 OAuth2 RFC PKCE 安全不变量边界',
      '03. JEV 分叉: 分发 AST 转换至 3 路 Haiku 子智能体',
      '04. 触发安全模糊测试套件 (112/112 通过)',
    ],

    // JEV Router Panel
    routerTitle: 'JEV 联合期望分叉概率路由',
    routerSubtitle: 'JOINT EXPECTED VALUE · 决策启发式估算器',
    entropy: '信息熵:',
    monteCarlo: '蒙特卡洛模拟:',
    pInlineTitle: 'P(单步内联执行)',
    pInlineLatency: '耗时: ~800ms',
    pInlineCost: '成本: $0.003',
    pSubagentsTitle: 'P(并行子智能体集群)',
    pSubagentsDesc: '分发至 3 路低延迟集群',
    pSubagentsArgmax: '最优决策 ARGMAX',
    pEscalateTitle: 'P(升级至 Opus 顾问)',
    pEscalateDesc: '触发条件: 风险 > 5%',
    pEscalateGate: 'Opus 门控',
    routerDirective: '路由裁决:',
    btnForceInline: '强制单步执行',
    btnForceFleet: '强制并行集群',
    btnRecalculate: '重算 JEV 分叉分布',

    // Subagents Dispatcher Panel
    dispatcherTitle: '子智能体集群调度器',
    dispatcherSubtitle: '低延迟并行计算单元',
    ch1Dispatch: '通道1: 调度波形',
    worker01Title: '工作体 #01',
    worker01Payload: '为 src/auth/oauth2.ts 生成 PKCE 令牌校验 AST 语法树访问器节点',
    explorer02Title: '探测体 #02',
    explorer02Payload: '语义索引 RFC 7636 PKCE 协议规范并解析本地回调符号表',
    researcher03Title: '验证体 #03',
    researcher03Payload: '执行 Vitest 模糊安全回归矩阵: 112/112 套件通过',
    progress: '任务进度',
    itemsProcessed: '已处理项',
    btnTick: '步进',
    btnRestartAll: '重启全量 3 路并行子智能体',

    // Neural Badges
    badgeReview: '[审查]',
    badgePlan: '[计划]',
    badgeRoute: '[路由]',
    badgeAst: '[AST树]',
    badgeDocs: '[文档]',
    badgeTests: '[112/112]',

    // Live Session Log
    liveLogTitle: '实时会话日志流 · 差异对比与遥测',
    eventsCount: '条事件',
    filterAll: '全部',
    filterDiff: '差异',
    filterTool: '工具',
    filterRouter: '路由',
    filterAlert: '告警',
    btnAutoScroll: '自动滚屏',
    btnClearBuffer: '清空日志缓冲区',
    bufferEmpty: '缓冲区为空。点击“注入工具调用”或触发子智能体活动以查看实时流。',

    // Interactive CLI Bar
    injectToolCall: '注入工具调用',
    toolBash: 'Bash: git status --porcelain',
    toolFileEdit: 'FileEdit: src/auth/oauth2.ts',
    toolGrep: 'Grep: OAuth2Callback / PKCE',
    toolAst: 'ASTParse: ts.createSourceFile()',
    toggleMode: '核心模型:',
    triggerOAuthAlert: '触发 OAuth 高危告警',
    dispatchFleet: '调度集群',
    tuiScriptBtn: '原生终端 TUI 脚本 (.py)',
    cliInputPlaceholder: "输入命令: 'help', 'inject bash', 'alert', 'mode codex', 'clear', 'lang en'...",
    btnRun: '执行',

    // Native TUI Modal
    modalTitle: '原生终端 TUI 脚本文件 (cli/ 与 hooks/)',
    tabMatrix: 'cli/agent_matrix.py',
    tabHook: 'hooks/emit_event.py',
    btnCopy: '复制源码',
    btnCopied: '已复制',
    btnDownload: '下载 .py 文件',
    modalRunLocally: '本地终端运行命令:',
    modalDesc: '纯 Linux/macOS 终端 Textual 交互式界面',

    // Agent Black Box Deconstruction HUD
    blackBox: {
      title: 'AGENT 黑盒全景透视阵列',
      subtitle: '提示词剖析 • MCP HOOK 拦截 • 权限与沙箱管控 • 动态运行动效',
      tabPipeline: '⚡ 黑盒动态全景拓扑',
      tabPrompts: '🔮 提示词层级与实时注入',
      tabMcpHooks: '🪝 MCP Hook 协议链路监控',
      tabPermissions: '🛡️ 零信任权限与沙箱矩阵',
      btnRunFullTrace: '运行黑盒全链路模拟',
      btnTriggerMcpHook: '触发 MCP PreTool Hook 拦截',
      btnSimulateDenial: '模拟越权拦截 (Denial)',
      btnInjectDirective: '注入自定义需求指令',
      stagePrompt: '需求输入与规则设定',
      stageLlm: 'AI 思考与任务规划',
      stageMcpHook: '工具与技能准备',
      stagePermission: '安全检查与权限门禁',
      stageSandbox: '受控环境实际执行',
      stageFeedback: '执行验证与下一步',
      promptAnatomy: '任务输入结构与上下文消耗',
      systemPrompt: '系统规则与安全守则',
      mcpToolDefs: '可用工具与命令定义 (MCP)',
      dynamicContext: '当前工作区代码与上下文',
      injectedDirectives: '用户补充的新需求',
      mcpRegistry: '已连接的扩展服务 (MCP)',
      hookTimeline: '工具调用生命周期',
      zeroTrustSandbox: '安全执行能力边界',
      securityFirewall: '高危命令拦截规则',
      tokenBurnBreakdown: 'Token 层级消耗分布',
      livePacketStream: '毫秒级动态数据包轨迹',
      tabCallChain: '时序调用链路与数据流',
      stepNumber: '执行步骤',
      callerCallee: '调用方 ➔ 承接节点',
      autoFlow: '自动流动 (连续循环)',
      stepThrough: '单步推进 (Next Step)',
      resetChain: '重置链路',
      flowRate: '数据包流速',
      scenarioSelector: '执行链路场景',
      scenarioStandard: '标准工具调用链路 (AST 解析与编辑)',
      scenarioBlocked: '零信任越权阻断链路 (高危拦截)',
      scenarioMultiMcp: '多 MCP 协同编排链路 (分布式)',
      dataPayloads: '动态流转数据包与报文',
    },
  },
};
