import React, { useEffect, useRef } from 'react';

interface OscilloscopeProps {
  active: boolean;
  intensity?: number; // 0.5 to 2.0
  color?: string;
  className?: string;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  active = true,
  intensity = 1.0,
  color = '#10b981',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Clear with slight trailing persistence
      ctx.fillStyle = 'rgba(6, 7, 10, 0.45)';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle phosphor reticle / grid
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.lineWidth = 1;

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Vertical divisions
      const step = 20;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, centerY - 3);
        ctx.lineTo(x, centerY + 3);
        ctx.stroke();
      }

      // Draw primary glowing sine waveform
      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = active ? 8 : 2;

      const baseFreq = 0.045 * (active ? intensity : 0.4);
      const amp = (height * 0.32) * (active ? intensity : 0.15);

      for (let x = 0; x < width; x++) {
        // Multi-frequency harmonic superposition for high-tech signal appearance
        const harm1 = Math.sin(x * baseFreq + phase) * amp;
        const harm2 = Math.sin(x * baseFreq * 2.3 + phase * 1.4) * (amp * 0.28);
        const harm3 = active ? Math.cos(x * 0.015 - phase * 0.8) * (amp * 0.12) : 0;
        
        // Occasional micro-jitter if actively computing
        const jitter = active ? (Math.random() - 0.5) * 1.5 : 0;
        const y = centerY + harm1 + harm2 + harm3 + jitter;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Second faint echo wave
      ctx.beginPath();
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
      for (let x = 0; x < width; x += 2) {
        const y = centerY + Math.sin(x * baseFreq * 1.2 - phase * 0.7) * (amp * 0.6);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += active ? 0.085 * intensity : 0.02;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, intensity, color]);

  return (
    <div className={`relative flex items-center bg-[#07090e] border border-emerald-950/60 rounded px-1.5 py-1 ${className}`}>
      <canvas
        ref={canvasRef}
        width={160}
        height={32}
        className="w-full h-8 block rounded"
      />
      <div className="absolute right-2 top-1 text-[9px] font-mono tracking-tight text-emerald-400/80 pointer-events-none select-none flex items-center gap-1.5">
        <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
        <span>CH1: DISPATCH</span>
      </div>
    </div>
  );
};
