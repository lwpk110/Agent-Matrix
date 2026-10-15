import React from 'react';
import { MatrixMode, WsConnectionState, TelemetryMode } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { Terminal, Volume2, VolumeX, Play, Pause, FastForward, ShieldAlert, Languages, Zap, Radio, RefreshCw } from 'lucide-react';

interface TerminalHeaderProps {
  mode: MatrixMode;
  onSetMode: (mode: MatrixMode) => void;
  language: Language;
  onToggleLanguage: () => void;
  wsState: WsConnectionState;
  telemetryMode: TelemetryMode;
  onToggleTelemetryMode: () => void;
  onOpenLocalAgentModal: () => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  speed: number;
  onChangeSpeed: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  alertActive: boolean;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  mode,
  onSetMode,
  language,
  onToggleLanguage,
  wsState,
  telemetryMode,
  onToggleTelemetryMode,
  onOpenLocalAgentModal,
  isStreaming,
  onToggleStreaming,
  speed,
  onChangeSpeed,
  soundEnabled,
  onToggleSound,
  alertActive,
}) => {
  const t = translations[language];
  const isZh = language === 'zh';

  return (
    <header className="bg-[#05070c] border-b border-slate-800/90 px-3 py-2 flex flex-wrap items-center justify-between gap-3 font-mono">
      {/* Left: Window Dots & Title */}
      <div className="flex items-center gap-3">
        {/* Retro MacOS/Zsh window buttons */}
        <div className="flex items-center gap-1.5 select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
        </div>

        {/* HUD Title */}
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-extrabold text-white tracking-wider flex items-center gap-1.5">
            <span>{t.appTitle}</span>
            <span className="text-slate-500 font-normal">·</span>
            <span className="text-teal-400 animate-pulse">{t.appSubtitle}</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
            CONTROL PLANE v2.4
          </span>
        </div>

        {/* WebSocket Connection LED & Mode Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleTelemetryMode}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              wsState === 'connected'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : wsState === 'probing'
                ? 'bg-teal-950/80 text-teal-300 border-teal-500 animate-pulse'
                : 'bg-amber-950/70 text-amber-300 border-amber-600/70'
            }`}
            title={isZh ? '点击在真实本地网关与实时仿真演练之间切换' : 'Click to toggle between Live Local Gateway and Simulation'}
          >
            {wsState === 'connected' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                <span>{isZh ? '7788 网关在线 [LIVE]' : 'GATEWAY: 7788 [LIVE]'}</span>
              </>
            ) : wsState === 'probing' ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 text-teal-400 animate-spin" />
                <span>{isZh ? '网关探针重试中 [PROBE]' : 'PROBING: 7788'}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>{isZh ? '演练仿真模式 [SIM]' : 'SIMULATION MODE'}</span>
              </>
            )}
          </button>
        </div>

        {/* High Risk Alarm Indicator */}
        {alertActive && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-600 px-2 py-0.5 rounded animate-pulse">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>{t.alertBanner}</span>
          </div>
        )}
      </div>

      {/* Center: Dual Model Mode Switcher */}
      <div className="flex items-center bg-[#090d16] p-0.5 rounded border border-slate-800 text-[10.5px]">
        <button
          onClick={() => onSetMode('claude')}
          className={`px-2.5 py-1 rounded transition cursor-pointer font-semibold ${
            mode === 'claude'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.modeClaude}
        </button>
        <button
          onClick={() => onSetMode('codex')}
          className={`px-2.5 py-1 rounded transition cursor-pointer font-semibold ${
            mode === 'codex'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.modeCodex}
        </button>
        <button
          onClick={() => onSetMode('hybrid')}
          className={`px-2.5 py-1 rounded transition cursor-pointer font-semibold ${
            mode === 'hybrid'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.modeHybrid}
        </button>
      </div>

      {/* Right: Connect Local Agent Button + Diagnostics */}
      <div className="flex items-center gap-2 text-[11px]">
        {/* Prominent Connect Local Agent Button */}
        <button
          onClick={onOpenLocalAgentModal}
          className="px-2.5 py-1 rounded bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-500 font-bold tracking-tight transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-950 animate-pulse-subtle"
          title={isZh ? '获取本地 Claude/Codex 快速接入配置与网关脚本' : 'Get local Claude/Codex gateway scripts & settings'}
        >
          <Zap className="w-3.5 h-3.5 text-teal-300" />
          <span>{isZh ? '⚡ 接入本地 Claude/Codex' : '⚡ Connect Local Agent'}</span>
        </button>

        {/* Language Switcher (EN / 中文) */}
        <button
          onClick={onToggleLanguage}
          className="px-2 py-1 rounded bg-[#090d16] hover:bg-teal-950/80 text-teal-300 hover:text-teal-200 border border-teal-800/80 transition flex items-center gap-1.5 cursor-pointer font-bold"
          title={language === 'en' ? 'Switch to Chinese / 切换为中文' : '切换为英文 / Switch to English'}
        >
          <Languages className="w-3.5 h-3.5 text-teal-400" />
          <span>{language === 'en' ? '中文' : 'EN'}</span>
        </button>

        {/* Play / Pause simulation */}
        <button
          onClick={onToggleStreaming}
          className={`px-2 py-1 rounded border transition flex items-center gap-1 cursor-pointer ${
            isStreaming
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : 'bg-amber-950 text-amber-300 border-amber-800'
          }`}
          title={isStreaming ? t.statusActive : t.statusPaused}
        >
          {isStreaming ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>{isStreaming ? t.statusActive : t.statusPaused}</span>
        </button>

        {/* Speed multiplier */}
        <button
          onClick={onChangeSpeed}
          className="px-2 py-1 rounded bg-[#090d16] hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center gap-1 cursor-pointer"
          title={t.speed}
        >
          <FastForward className="w-3 h-3 text-teal-400" />
          <span>{speed}x</span>
        </button>

        {/* Audio FX */}
        <button
          onClick={onToggleSound}
          className="p-1 rounded bg-[#090d16] hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
          title={soundEnabled ? t.muteAudio : t.unmuteAudio}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-teal-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>
    </header>
  );
};
