import React from 'react';
import { Language, translations } from '../i18n/translations';

interface NeuralConnectorsProps {
  alertActive: boolean;
  activeStep: number;
  riskPercent: string;
  language: Language;
}

export const NeuralConnectors: React.FC<NeuralConnectorsProps> = ({
  alertActive,
  activeStep,
  riskPercent,
  language,
}) => {
  const t = translations[language];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block overflow-visible select-none">
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Neon filters */}
          <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="grad-purple-amber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="grad-amber-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="grad-cyan-emerald" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="grad-risk-alert" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* 1. Advisor (Left) <---> Main Session (Top Right) */}
        <path
          d="M 32% 16% L 34% 16%"
          stroke="url(#grad-purple-amber)"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="animate-laser"
        />

        {/* 2. Main Session (Top) ---> JEV Router (Middle) */}
        <path
          d="M 64% 28% L 64% 34%"
          stroke="url(#grad-amber-cyan)"
          strokeWidth="2"
          strokeDasharray="5 3"
          className="animate-laser"
        />

        {/* 3. JEV Router (Middle) ---> Haiku Subagents (Bottom Fleet) */}
        {/* Branch 1 -> Worker #01 Left */}
        <path
          d="M 54% 48% Q 44% 52% 44% 57%"
          stroke="#2dd4bf"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
          opacity="0.85"
        />

        {/* Branch 2 -> Explorer #02 Center */}
        <path
          d="M 64% 48% L 64% 57%"
          stroke="url(#grad-cyan-emerald)"
          strokeWidth="2"
          strokeDasharray="4 4"
          fill="none"
        />

        {/* Branch 3 -> Researcher #03 Right */}
        <path
          d="M 74% 48% Q 84% 52% 84% 57%"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
          opacity="0.85"
        />

        {/* 4. Risk Invariant Feedback Circuit */}
        <path
          d="M 34% 68% C 26% 68%, 22% 50%, 22% 36%"
          stroke={alertActive ? "url(#grad-risk-alert)" : "#a855f7"}
          strokeWidth={alertActive ? "2.5" : "1.2"}
          strokeDasharray={alertActive ? "3 3" : "6 4"}
          fill="none"
          opacity={alertActive ? "0.95" : "0.5"}
          filter={alertActive ? "url(#glow-red)" : "url(#glow-purple)"}
        />
      </svg>
    </div>
  );
};
