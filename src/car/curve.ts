export function curve_at(curve: readonly (readonly [number, number])[], x: number): number {
  for (let i = 1; i < curve.length; i++) {
    const x1 = curve[i][0];
    if (x <= x1) {
      const y1 = curve[i][1];
      const x0 = curve[i - 1][0];
      const y0 = curve[i - 1][1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}
