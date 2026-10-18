/** A compact ECG beat: P wave, sharp QRS complex, then a soft T wave. */
export function runtimeHeartbeat(x: number): number {
  if (Math.abs(x) >= 1) return 0;
  const knots = [
    [-0.24, 0], [-0.13, -0.18], [0, 1], [0.12, -0.44], [0.24, 0],
  ];
  if (x >= -0.24 && x <= 0.24) {
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i][0]) {
        const [a, b] = knots[i - 1];
        const [c, d] = knots[i];
        return b + (d - b) * ((x - a) / (c - a));
      }
    }
  }
  const bump = (center: number, radius: number, amplitude: number) => {
    const t = Math.abs((x - center) / radius);
    return t >= 1 ? 0 : amplitude * (1 + Math.cos(t * Math.PI)) / 2;
  };
  return bump(-0.58, 0.23, 0.19) + bump(0.58, 0.3, 0.25);
}
