/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Brain,
  Sliders,
  Sparkles,
  Zap,
  Gauge,
  CheckCircle,
  X,
  RefreshCw,
  Eye,
  Layers,
  Activity,
  Terminal,
  FileCode,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { Language } from '../i18n/translations';

export interface ModelPreset {
  id: string;
  name: string;
  family: 'Anthropic' | 'DeepSeek' | 'OpenAI' | 'Google';
  badge: string;
  architecture: string;
  contextWindow: string;
  contextTokens: number;
  tps: number;
  ttftMs: number;
  thinkingSupported: boolean;
  defaultThinkingBudget: number;
  pricing: string;
  color: string;
  accentBorder: string;
  accentBg: string;
  descriptionZh: string;
  descriptionEn: string;
  strengthsZh: string[];
  strengthsEn: string[];
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    family: 'Anthropic',
    badge: '旗舰混合推理 · Extended Thinking',
    architecture: 'Transformer with Dynamic Extended Thinking Engine',
    contextWindow: '200K Tokens',
    contextTokens: 200000,
    tps: 84.5,
    ttftMs: 240,
    thinkingSupported: true,
    defaultThinkingBudget: 16384,
    pricing: '$3.00 / $15.00 每百万 Token (缓存读取 $0.30)',
    color: '#00f0ff',
    accentBorder: 'border-cyan-500',
    accentBg: 'bg-cyan-950/40',
    descriptionZh:
      'Anthropic 最新混合推理旗舰。既能执行毫秒级单步快速工具分发，又可在复杂场景展开深度思考树（Extended Thinking），自主校验边界用例与修复代码。',
    descriptionEn:
      'Anthropic hybrid reasoning flagship. Balances instant tool dispatching with deep extended thinking chains for self-healing code synthesis.',
    strengthsZh: [
      '动态可控思维链（1K ~ 64K Token 预算）',
      '超精密 Tool Call 结构化入参生成',
      '工程级复杂 AST 重构与跨文件依赖推理',
      'Prompt Caching 命中率高达 80%+',
    ],
    strengthsEn: [
      'Controllable thinking budget (1K - 64K tokens)',
      'Sub-millimeter Tool Calling accuracy',
      'Multi-file architectural refactoring',
      '80%+ Prompt Caching efficiency',
    ],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet (v2)',
    family: 'Anthropic',
    badge: '极速代码生产力标杆',
    architecture: 'Dense Multi-Query Attention Transformer',
    contextWindow: '200K Tokens',
    contextTokens: 200000,
    tps: 92.4,
    ttftMs: 180,
    thinkingSupported: false,
    defaultThinkingBudget: 0,
    pricing: '$3.00 / $15.00 每百万 Token',
    color: '#38bdf8',
    accentBorder: 'border-sky-500',
    accentBg: 'bg-sky-950/40',
    descriptionZh:
      '行业公认的高效代码编写与单步工具执行基准模型。无需思考链预热，首字延迟低至 180ms，吞吐稳定流畅。',
    descriptionEn:
      'The industry standard for high-throughput coding and deterministic tool use. Instant response with 180ms TTFT.',
    strengthsZh: [
      '低延迟即时代码补全',
      '确定性工具调用与参数绑定',
      '优秀的代码审查与静态 Bug 定位',
      '高并发吞吐稳定性',
    ],
    strengthsEn: [
      'Low latency code completion',
      'Deterministic tool invocation',
      'Code review & static defect triage',
      'High concurrency stability',
    ],
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    family: 'Anthropic',
    badge: '85ms 极速智能体调度器',
    architecture: 'Lightweight Highly-Optimized Transformer',
    contextWindow: '200K Tokens',
    contextTokens: 200000,
    tps: 165.0,
    ttftMs: 85,
    thinkingSupported: false,
    defaultThinkingBudget: 0,
    pricing: '$0.80 / $4.00 每百万 Token',
    color: '#a855f7',
    accentBorder: 'border-purple-500',
    accentBg: 'bg-purple-950/40',
    descriptionZh:
      '极致速度与高能效比模型。适合前置会话自举、意图分类、MCP 工具快速路由分发与粗筛，降低智能体整体运行成本。',
    descriptionEn:
      'Ultra-fast, cost-efficient model. Ideal for intent classification, rapid bootstrap, and early MCP tool filtering.',
    strengthsZh: [
      '85ms 首字生成，165 TPS 极速流式输出',
      '高性价比智能体前置路由器',
      '海量工具 Schema 快速过滤与分流',
      '轻量代码差异验证与语法自检',
    ],
    strengthsEn: [
      '85ms TTFT, 165 TPS generation speed',
      'Cost-effective front-of-pipe router',
      'Rapid tool schema filtering',
      'Lightweight syntax checks',
    ],
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    family: 'DeepSeek',
    badge: '开源强化学习推理链',
    architecture: 'Multi-Head Latent Attention (MLA) + Pure RL CoT',
    contextWindow: '128K Tokens',
    contextTokens: 128000,
    tps: 68.2,
    ttftMs: 320,
    thinkingSupported: true,
    defaultThinkingBudget: 24576,
    pricing: '$0.55 / $2.19 每百万 Token',
    color: '#f59e0b',
    accentBorder: 'border-amber-500',
    accentBg: 'bg-amber-950/40',
    descriptionZh:
      '基于大规模强化学习（RL）自主涌现的开放长思维链推理模型。在复杂算法、严密数学证明与代码逻辑漏洞挖掘上表现突出。',
    descriptionEn:
      'Open-weights model with emergent long chain-of-thought reasoning from large-scale RL, excelling at algorithmic logic and verification.',
    strengthsZh: [
      '纯强化学习训练涌现的长思维链（CoT）',
      'MLA 架构显存消耗极低，吞吐成本低',
      '深入推导复杂边界条件与潜在竞态问题',
      '详尽自我纠错与假设反思过程',
    ],
    strengthsEn: [
      'Emergent reasoning via pure RL',
      'Multi-Head Latent Attention memory savings',
      'Deep exploration of race conditions',
      'Exhaustive self-reflection tokens',
    ],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    family: 'OpenAI',
    badge: '全模态融合推理引擎',
    architecture: 'Omni-Modal Native Cross-Attention Transformer',
    contextWindow: '128K Tokens',
    contextTokens: 128000,
    tps: 105.0,
    ttftMs: 195,
    thinkingSupported: false,
    defaultThinkingBudget: 0,
    pricing: '$2.50 / $10.00 每百万 Token',
    color: '#10b981',
    accentBorder: 'border-emerald-500',
    accentBg: 'bg-emerald-950/40',
    descriptionZh:
      'OpenAI 全模态旗舰，具备原生视觉、音频与文本综合处理能力。在前端 UI 设计稿精准还原、图表数据解析与跨模态工具协同中极具优势。',
    descriptionEn:
      'OpenAI multimodal flagship with native cross-attention. Exceptional at UI design translation, image OCR diffs, and multimodal tools.',
    strengthsZh: [
      'UI 视觉截图直接转代码与精确像素还原',
      '海量开放 API Schema 自动适配',
      '高吞吐结构化 JSON 输出保障',
      '多语言编码与工程规范通用性',
    ],
    strengthsEn: [
      'Visual screenshot to responsive CSS/JSX',
      'Universal JSON Schema adherence',
      'High throughput structured outputs',
      'Broad polyglot coding prowess',
    ],
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    family: 'Google',
    badge: '100万长上下文 & Grounding',
    architecture: 'Next-Gen Multimodal MoE + Web Grounding',
    contextWindow: '1,048,576 Tokens (1M)',
    contextTokens: 1048576,
    tps: 140.0,
    ttftMs: 110,
    thinkingSupported: true,
    defaultThinkingBudget: 12288,
    pricing: '$0.10 / $0.40 每百万 Token',
    color: '#ec4899',
    accentBorder: 'border-pink-500',
    accentBg: 'bg-pink-950/40',
    descriptionZh:
      'Google 次世代百万级超长上下文引擎，支持整仓代码全量检索（无需切片）与实时 Google 搜索挂载（Grounding），性价比极高。',
    descriptionEn:
      'Google 1M ultra-long context multimodal engine with built-in search grounding. Ingests full repo codebases without chunking loss.',
    strengthsZh: [
      '1,048,576 (1M) 极限上下文，整仓依赖一次性加载',
      '原生实时搜索挂载与最新依赖库文档校准',
      '140 TPS 超高速流式响应',
      '次世代 MoE 架构极致成本优势',
    ],
    strengthsEn: [
      '1M full repository ingestion without loss',
      'Native Google Search grounding for latest APIs',
      '140 TPS high-velocity generation',
      'Ultra cost-effective MoE architecture',
    ],
  },
];

interface ModelDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  thinkingEnabled: boolean;
  onToggleThinking: (enabled: boolean) => void;
  thinkingBudget: number;
  onChangeThinkingBudget: (budget: number) => void;
  temperature: number;
  onChangeTemperature: (temp: number) => void;
  promptSnippet: string;
}

export const ModelDisplayModal: React.FC<ModelDisplayModalProps> = ({
  isOpen,
  onClose,
  language,
  selectedModelId,
  onSelectModel,
  thinkingEnabled,
  onToggleThinking,
  thinkingBudget,
  onChangeThinkingBudget,
  temperature,
  onChangeTemperature,
  promptSnippet,
}) => {
  const isZh = language === 'zh';
  const [activeTab, setActiveTab] = useState<'matrix' | 'thinking' | 'attention' | 'spec'>('matrix');
  const [streamingProgress, setStreamingProgress] = useState<number>(0);
  const [isSimulatingInference, setIsSimulatingInference] = useState<boolean>(true);

  const currentModel = MODEL_PRESETS.find((m) => m.id === selectedModelId) || MODEL_PRESETS[0];

  // Simulated Thinking Chain generation stream
  useEffect(() => {
    if (!isOpen) return;
    setStreamingProgress(0);
    const interval = setInterval(() => {
      setStreamingProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 5;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isOpen, selectedModelId, thinkingEnabled]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-sans select-none overflow-y-auto">
      {/* Outer Cyber Modal Container */}
      <div className="relative w-full max-w-5xl bg-[#060b18] border border-cyan-500/40 rounded-2xl shadow-[0_0_80px_rgba(0,240,255,0.25)] flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-900/60 bg-[#081226]/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Cpu className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold flex items-center gap-2">
                <span>NEURAL INFERENCE ARCHITECTURE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 font-mono tracking-wide flex items-center gap-2">
                <span>{isZh ? '模型显示与神经推理中枢' : 'MODEL DISPLAY & INFERENCE CORE'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono">
                  {currentModel.name}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playKeyClick();
                setIsSimulatingInference(!isSimulatingInference);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1730] hover:bg-[#12234a] border border-cyan-800 text-cyan-300 text-xs font-mono transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingInference ? 'animate-spin' : ''}`} />
              <span>{isZh ? '刷新推理流' : 'Refresh Stream'}</span>
            </button>
            <button
              onClick={() => {
                soundFx.playKeyClick();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-200 transition cursor-pointer"
              title="Close [Esc]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-cyan-950 bg-[#050914] text-xs font-mono overflow-x-auto">
          {[
            { id: 'matrix', labelZh: '模型矩阵切换', labelEn: 'Model Matrix', icon: Boxes },
            { id: 'thinking', labelZh: '思维链 (Thinking Stream)', labelEn: 'Thinking Chain', icon: Brain },
            { id: 'attention', labelZh: 'KV 缓存与注意力图谱', labelEn: 'KV Cache & Attention', icon: Layers },
            { id: 'spec', labelZh: '架构与性能规格', labelEn: 'Architecture Specs', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playKeyClick();
                  setActiveTab(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
                  isActive
                    ? 'bg-cyan-950/80 text-cyan-200 border-cyan-400 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{isZh ? tab.labelZh : tab.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-slate-200 text-xs">
          {/* TAB 1: MODEL MATRIX SWITCHER */}
          {activeTab === 'matrix' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                    <span>{isZh ? '可选核心大语言模型矩阵' : 'CORE LLM INFERENCE ENGINE SELECTION'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({isZh ? '点击卡片直接热切换推理引擎' : 'Click card to hot-swap inference engine'})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isZh
                      ? '不同模型具备不同推理特性、思维链预算、上下文吞吐与工具调用精度，实时调整拓扑行为。'
                      : 'Each model exhibits distinct reasoning dynamics, thinking budgets, context throughput, and tool calling fidelity.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-1 rounded">
                    ACTIVE: {currentModel.name}
                  </span>
                </div>
              </div>

              {/* 6 Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {MODEL_PRESETS.map((m) => {
                  const isSelected = m.id === selectedModelId;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        soundFx.playChirp();
                        onSelectModel(m.id);
                        if (m.thinkingSupported) {
                          onToggleThinking(true);
                          onChangeThinkingBudget(m.defaultThinkingBudget);
                        } else {
                          onToggleThinking(false);
                        }
                      }}
                      className={`relative rounded-xl p-3.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? `bg-[#0a1832] ${m.accentBorder} shadow-[0_0_24px_rgba(0,240,255,0.35)] ring-1 ring-cyan-400`
                          : 'bg-[#081022] border-slate-800/90 hover:border-slate-700 hover:bg-[#0c1834]'
                      }`}
                    >
                      {/* Top Row: Name, Badge & Selection Indicator */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-100 font-mono">{m.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                {m.family}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono mt-0.5" style={{ color: m.color }}>
                              {m.badge}
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition shrink-0 ${
                              isSelected
                                ? 'bg-cyan-500 border-cyan-300 text-black shadow-[0_0_8px_#00f0ff]'
                                : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                          {isZh ? m.descriptionZh : m.descriptionEn}
                        </p>
                      </div>

                      {/* Specs Mini Pill Grid */}
                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80 font-mono text-[10px]">
                        <div className="bg-black/40 px-2 py-1 rounded flex items-center justify-between">
                          <span className="text-slate-500">SPEED:</span>
                          <span className="text-emerald-400 font-bold">{m.tps} TPS</span>
                        </div>
                        <div className="bg-black/40 px-2 py-1 rounded flex items-center justify-between">
                          <span className="text-slate-500">TTFT:</span>
                          <span className="text-cyan-300 font-bold">{m.ttftMs}ms</span>
                        </div>
                        <div className="bg-black/40 px-2 py-1 rounded flex items-center justify-between">
                          <span className="text-slate-500">CONTEXT:</span>
                          <span className="text-purple-300 font-bold">{m.contextWindow}</span>
                        </div>
                        <div className="bg-black/40 px-2 py-1 rounded flex items-center justify-between">
                          <span className="text-slate-500">THINKING:</span>
                          <span className={m.thinkingSupported ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                            {m.thinkingSupported ? (isZh ? '支持思考' : 'Supported') : (isZh ? '不支持' : 'None')}
                          </span>
                        </div>
                      </div>

                      {/* Key Strengths Tags */}
                      <div className="flex flex-wrap gap-1">
                        {(isZh ? m.strengthsZh : m.strengthsEn).slice(0, 2).map((st, i) => (
                          <span
                            key={i}
                            className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400"
                          >
                            ✓ {st}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Model Deep Dive & Parameter Tuning Bar */}
              <div className="p-4 rounded-xl bg-[#09152a] border border-cyan-800/60 shadow-lg flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-cyan-950">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono font-bold text-slate-100 text-xs">
                      {isZh ? '实时推理参数微调' : 'REAL-TIME INFERENCE PARAMETER TUNING'}
                    </span>
                    <span className="text-[10px] text-cyan-300 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                      {currentModel.name}
                    </span>
                  </div>

                  {currentModel.thinkingSupported && (
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400">{isZh ? '扩展思考 (Thinking):' : 'Extended Thinking:'}</span>
                      <button
                        onClick={() => {
                          soundFx.playKeyClick();
                          onToggleThinking(!thinkingEnabled);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                          thinkingEnabled
                            ? 'bg-cyan-950 text-cyan-200 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span>{thinkingEnabled ? (isZh ? '已开启 ON' : 'ENABLED') : (isZh ? '已关闭 OFF' : 'DISABLED')}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
                  {/* Thinking Budget Slider */}
                  <div className="bg-[#050a16] p-3 rounded-lg border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold flex items-center gap-1">
                        <Brain className="w-3.5 h-3.5 text-purple-400" />
                        {isZh ? '思考 Token 预算' : 'Thinking Budget'}:
                      </span>
                      <span className="text-cyan-300 font-bold">
                        {thinkingEnabled ? `${thinkingBudget.toLocaleString()} Tokens` : 'OFF'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1024}
                      max={64000}
                      step={1024}
                      value={thinkingBudget}
                      disabled={!thinkingEnabled || !currentModel.thinkingSupported}
                      onChange={(e) => onChangeThinkingBudget(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer disabled:opacity-30"
                    />
                    <div className="flex items-center justify-between text-[9px] text-slate-500">
                      <span>1,024</span>
                      <span>16,384</span>
                      <span>64,000</span>
                    </div>
                  </div>

                  {/* Temperature Slider */}
                  <div className="bg-[#050a16] p-3 rounded-lg border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        {isZh ? '温度 (Temperature)' : 'Temperature'}:
                      </span>
                      <span className="text-amber-300 font-bold">{temperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={temperature}
                      onChange={(e) => onChangeTemperature(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[9px] text-slate-500">
                      <span>0.00 (严密代码)</span>
                      <span>0.50</span>
                      <span>1.00 (创意探索)</span>
                    </div>
                  </div>

                  {/* Pricing & Latency Estimation */}
                  <div className="bg-[#050a16] p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold text-emerald-400">
                        {isZh ? '预估性能与计费' : 'ESTIMATED COST & LATENCY'}:
                      </div>
                      <div className="text-slate-200 mt-1 font-bold">{currentModel.pricing}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2">
                      TTFT: <span className="text-cyan-300 font-bold">{currentModel.ttftMs}ms</span> · 吞吐:
                      <span className="text-emerald-400 font-bold ml-1">{currentModel.tps} TPS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THINKING STREAM PREVIEW */}
          {activeTab === 'thinking' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span>{isZh ? '扩展思维链流式推导 (Thinking Stream Trace)' : 'EXTENDED THINKING TRACE'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isZh
                      ? '实时展现模型在输出 ToolCall 前的内在推理自检，包括假设推导、反例论证与工具参数校验。'
                      : 'Real-time observation of the model internal thought process, hypothesis generation, and tool arguments validation.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    THINKING: {thinkingEnabled ? `${thinkingBudget} TOKENS MAX` : 'OFF'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    PROGRESS: {streamingProgress}%
                  </span>
                </div>
              </div>

              {/* Streaming Terminal Card */}
              <div className="bg-[#030712] border border-cyan-900/60 rounded-xl p-4 font-mono text-xs shadow-inner flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-cyan-950 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="text-slate-300 font-bold ml-2">THINKING_STREAM_BUFFER // PID 49102</span>
                  </div>
                  <div className="text-purple-400 font-bold animate-pulse">● STREAMING TOKENS</div>
                </div>

                <div className="bg-[#060c1c] p-3 rounded-lg border border-purple-900/50 text-[11px] text-purple-200 leading-relaxed max-h-[380px] overflow-y-auto space-y-2">
                  <div className="text-purple-400 font-bold">
                    &lt;thinking&gt;
                  </div>
                  <p className="text-slate-300">
                    1. 目标分析：用户指令为「{promptSnippet || '重构组件 ProductCard 为响应式网格布局，并执行 npm test 确保测试通过'}」。
                  </p>
                  <p className="text-slate-300">
                    2. 上下文校验：已解析 CLAUDE.md 工程规范。发现项目使用 Tailwind CSS，断点标准为 sm:640px, md:768px, lg:1024px。
                  </p>
                  <p className="text-slate-300">
                    3. 潜在风险与约束核查：
                    <br />
                    - 原卡片是否存在绝对定位（fixed/absolute）挤压文字隐患？是。
                    <br />
                    - 是否需要调用原生运行环境？需要执行 npm test，需向权限门禁申请子进程执行权限。
                  </p>
                  <p className="text-slate-300">
                    4. 规划行动树 (Action Tree)：
                    <br />
                    - 步骤 A: 派发 view_file 读取 src/components/ProductCard.tsx 现有结构。
                    <br />
                    - 步骤 B: 派发 replace_file_content 替换 grid 布局，应用 1080px 基准自适应流。
                    <br />
                    - 步骤 C: 派发 run_command 执行 npm test -- ProductCard.test.tsx。
                  </p>
                  <p className="text-slate-300">
                    5. 工具调用决策 (Tool Decision)：
                    <br />
                    生成首批并发 ToolCall Payload，绑定参数 TargetFile 与 Instruction，提交至 04 智能体调度总线。
                  </p>
                  <div className="text-purple-400 font-bold">
                    &lt;/thinking&gt;
                  </div>
                </div>

                {/* Emitted ToolCall Output */}
                <div className="bg-[#071322] p-3 rounded-lg border border-cyan-800 text-[11px] text-cyan-200">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">
                    MODEL EMITTED PAYLOAD // TOOL CALL JSON:
                  </div>
                  <pre className="text-slate-300 overflow-x-auto">
{JSON.stringify(
  {
    tool: 'view_file',
    parameters: {
      AbsolutePath: '/src/components/ProductCard.tsx',
      StartLine: 1,
      EndLine: 120,
    },
    routingMeta: {
      confidence: 0.994,
      modelUsed: currentModel.name,
      thinkingTokensUsed: 1420,
    },
  },
  null,
  2
)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENTION & KV CACHE MAP */}
          {activeTab === 'attention' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>{isZh ? 'KV-Cache 命中与多头注意力图谱' : 'KV CACHE & MULTI-HEAD ATTENTION'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isZh
                      ? 'Prompt Caching 允许对系统提示词、CLAUDE.md 与大型工具 Schema 零延迟复用，节约 90% 成本并提速 4 倍。'
                      : 'Prompt caching enables 0ms TTFT reuse on static rules and massive tool schemas, slashing costs by 90%.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CACHE HIT: 78.4%
                  </span>
                </div>
              </div>

              {/* Context Breakdown Bar */}
              <div className="bg-[#050a16] p-4 rounded-xl border border-slate-800 flex flex-col gap-3 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">TOTAL PROMPT CONTEXT: 4,920 TOKENS</span>
                  <span className="text-cyan-400 font-bold">WINDOW LIMIT: {currentModel.contextWindow}</span>
                </div>

                {/* Stacked Progress Bar */}
                <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                  <div style={{ width: '45%' }} className="bg-purple-600 h-full" title="System Prompt & Rules (45%)" />
                  <div style={{ width: '33%' }} className="bg-cyan-500 h-full" title="Tool JSON Schemas (33%)" />
                  <div style={{ width: '12%' }} className="bg-amber-500 h-full" title="Conversation History (12%)" />
                  <div style={{ width: '10%' }} className="bg-emerald-500 h-full" title="User Signal Prompt (10%)" />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-purple-600 inline-block" />
                    <span className="text-slate-300">系统提示与规范: 2,210T (Cached ✓)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" />
                    <span className="text-slate-300">工具 Schemas: 1,630T (Cached ✓)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                    <span className="text-slate-300">历史与上下文: 590T</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                    <span className="text-slate-300">用户最新输入: 490T</span>
                  </div>
                </div>
              </div>

              {/* Attention Heatmap Visualization */}
              <div className="bg-[#050a16] p-4 rounded-xl border border-slate-800 flex flex-col gap-3 font-mono">
                <div className="text-xs font-bold text-slate-200">
                  ATTENTION HEAD ACTIVATION HEATMAP (HEADS 1 - 32)
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const intensity = (Math.sin(i * 1.3) + 1) / 2;
                    return (
                      <div
                        key={i}
                        className="h-7 rounded flex flex-col items-center justify-center text-[9px] font-bold border border-cyan-900/50"
                        style={{
                          backgroundColor: `rgba(0, 240, 255, ${0.15 + intensity * 0.75})`,
                          color: intensity > 0.4 ? '#ffffff' : '#94a3b8',
                        }}
                        title={`Attention Head ${i + 1}: ${(intensity * 100).toFixed(1)}%`}
                      >
                        H{i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE SPECIFICATIONS */}
          {activeTab === 'spec' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>{isZh ? '模型底层技术架构与基准对比' : 'TECHNICAL ARCHITECTURE & BENCHMARK SPECS'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isZh
                      ? '对比各模型在 SWE-bench Verified、Aider 与 HumanEval 编程基准下的综合表现。'
                      : 'Comprehensive benchmark comparison across SWE-bench Verified, Aider, and HumanEval.'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-[#081226] text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">MODEL</th>
                      <th className="p-2.5">SWE-BENCH</th>
                      <th className="p-2.5">THINKING</th>
                      <th className="p-2.5">CONTEXT</th>
                      <th className="p-2.5">TPS</th>
                      <th className="p-2.5">TTFT</th>
                      <th className="p-2.5">COST / 1M</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#050a14]">
                    {MODEL_PRESETS.map((m) => (
                      <tr
                        key={m.id}
                        className={m.id === selectedModelId ? 'bg-cyan-950/40 font-bold text-cyan-200' : 'text-slate-400'}
                      >
                        <td className="p-2.5 text-slate-200">{m.name}</td>
                        <td className="p-2.5 text-emerald-400">
                          {m.id === 'claude-3-7-sonnet'
                            ? '70.3%'
                            : m.id === 'claude-3-5-sonnet'
                            ? '65.2%'
                            : m.id === 'deepseek-r1'
                            ? '63.8%'
                            : m.id === 'gemini-2-flash'
                            ? '61.4%'
                            : '56.8%'}
                        </td>
                        <td className="p-2.5">{m.thinkingSupported ? '✓ 动态思维链' : '—'}</td>
                        <td className="p-2.5">{m.contextWindow}</td>
                        <td className="p-2.5 text-emerald-400">{m.tps}</td>
                        <td className="p-2.5">{m.ttftMs}ms</td>
                        <td className="p-2.5 text-slate-300">{m.pricing.split(' ')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-cyan-900/60 bg-[#070e1c] text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span>{isZh ? '当前选定引擎:' : 'SELECTED ENGINE:'}</span>
            <span className="font-bold text-cyan-300">{currentModel.name}</span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              ({currentModel.architecture})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playChirp();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              {isZh ? '确认应用并关闭' : 'Apply & Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
