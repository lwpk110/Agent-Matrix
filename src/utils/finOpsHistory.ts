import { BurnRatePoint } from '../types/matrix';

/**
 * Generates an authentic 60-minute historical burn rate trend
 * representing T-60m down to T-0m (the current moment).
 */
export function generate60mHistory(
  baseRate: number,
  peakRate: number,
  scenario: 'real' | 'auth' | 'k8s' | 'doris',
  currentRate?: number
): BurnRatePoint[] {
  const points: BurnRatePoint[] = [];
  const now = Date.now();
  const effectiveCurrent = currentRate ?? baseRate;

  let cumulativeCost = 0;

  for (let m = -60; m <= 0; m++) {
    const timestamp = now + m * 60 * 1000;
    const progress = (m + 60) / 60; // 0 to 1

    let rate = baseRate;

    if (scenario === 'real') {
      // Real workspace: quiet baseline with slight spikes around tools/git
      const wave = Math.sin(m * 0.15) * 0.01;
      const noise = (Math.sin(m * 1.3) + Math.cos(m * 0.7)) * 0.008;
      // Spike at -12m and -4m (representing git status or tool check)
      let spike = 0;
      if (m >= -15 && m <= -10) spike = 0.04 * Math.sin(((m + 15) / 5) * Math.PI);
      if (m >= -6 && m <= -2) spike = 0.03 * Math.sin(((m + 6) / 4) * Math.PI);
      rate = Math.max(0.01, baseRate + wave + noise + spike);
    } else if (scenario === 'auth') {
      // Auth refactor: ramp up during AST parsing around -35m to -20m, then steady test suite execution
      const mainWave = Math.sin(progress * Math.PI) * (peakRate - baseRate);
      const subWave = Math.sin(m * 0.35) * 0.025;
      const burst = m >= -30 && m <= -15 ? 0.06 : 0;
      rate = Math.max(0.04, baseRate + mainWave * 0.85 + subWave + burst);
    } else if (scenario === 'k8s') {
      // K8s scaling: moderate steady state with a steep spike at -12m to -5m (CRD schema & stress testing)
      const baseClimb = baseRate + progress * 0.05;
      const peakSpike = m >= -18 && m <= -6 ? (peakRate - baseRate) * Math.sin(((m + 18) / 12) * Math.PI) : 0;
      const ripple = Math.cos(m * 0.4) * 0.02;
      rate = Math.max(0.05, baseClimb + peakSpike + ripple);
    } else if (scenario === 'doris') {
      // Doris: periodic bursty query plan explain cycles
      const burstCycle = Math.pow(Math.sin(m * 0.28), 4) * (peakRate - baseRate);
      const jitter = (Math.sin(m * 0.9) * 0.015);
      rate = Math.max(0.03, baseRate + burstCycle + jitter);
    }

    // Force the last point (m === 0) to exactly match current rate
    if (m === 0) {
      rate = effectiveCurrent;
    }

    rate = +Math.max(0.01, rate).toFixed(3);

    // Approximate token count: standard blend ~ 33,000 tokens per $1 (roughly Claude 3.5 Sonnet mixed rate)
    const tokensPerMin = Math.round(rate * 33333);
    cumulativeCost += (rate / 60);

    let eventTag: string | undefined;
    if (rate >= peakRate * 0.92) {
      eventTag = 'PEAK';
    } else if (scenario === 'real' && (m === -12 || m === -4)) {
      eventTag = 'TOOL_USE';
    } else if (scenario === 'auth' && m === -22) {
      eventTag = 'AST_SCAN';
    } else if (m === 0) {
      eventTag = 'NOW';
    }

    const timeLabel = m === 0 ? 'NOW' : `${m}m`;

    points.push({
      minute: m,
      timestamp,
      timeLabel,
      burnRate: rate,
      tokensPerMin,
      costCumulative: +cumulativeCost.toFixed(3),
      eventTag,
    });
  }

  return points;
}

/**
 * Calculate statistical summary of the 60m historical window
 */
export function calculate60mStats(history: BurnRatePoint[]) {
  if (!history || history.length === 0) {
    return {
      peakRate: 0,
      peakMinute: 0,
      avgRate: 0,
      minRate: 0,
      totalTokens60m: 0,
      totalCost60m: 0,
      currentRate: 0,
    };
  }

  let peakRate = -Infinity;
  let peakMinute = 0;
  let minRate = Infinity;
  let sumRate = 0;
  let totalTokens = 0;

  history.forEach((pt) => {
    if (pt.burnRate > peakRate) {
      peakRate = pt.burnRate;
      peakMinute = pt.minute;
    }
    if (pt.burnRate < minRate) {
      minRate = pt.burnRate;
    }
    sumRate += pt.burnRate;
    totalTokens += pt.tokensPerMin;
  });

  const avgRate = +(sumRate / history.length).toFixed(3);
  const currentRate = history[history.length - 1]?.burnRate ?? 0;
  const totalCost60m = +(sumRate / 60).toFixed(3);

  return {
    peakRate: +peakRate.toFixed(3),
    peakMinute,
    avgRate,
    minRate: +minRate.toFixed(3),
    totalTokens60m: totalTokens,
    totalCost60m,
    currentRate,
  };
}
