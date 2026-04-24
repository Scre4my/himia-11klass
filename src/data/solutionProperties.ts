export type SolutionPropertyKey =
  | 'CaCl2'
  | 'KCl'
  | 'KOH'
  | 'K2CO3'
  | 'NH4NO3'
  | 'NaCl'
  | 'NaNO3'
  | 'NaOH'
  | 'Na2SO4';

type PointMap = Record<number, number>;

type SolutionProperty = {
  key: SolutionPropertyKey;
  label: string;
  density: PointMap;
  atmosphericDepression: PointMap;
};

export const SOLUTION_PROPERTIES: SolutionProperty[] = [
  {
    key: 'CaCl2',
    label: 'CaCl2',
    density: { 5: 1014, 10: 1084, 20: 1178 },
    atmosphericDepression: { 10: 1.5, 20: 4.5, 30: 10.5, 35: 14.3, 40: 19.0, 45: 24.3, 50: 30.0, 55: 36.5, 60: 43.0, 70: 60.0 },
  },
  {
    key: 'KCl',
    label: 'KCl',
    density: { 5: 1030, 10: 1063, 20: 1133 },
    atmosphericDepression: { 10: 1.3, 20: 3.3, 30: 6.1, 35: 8.0 },
  },
  {
    key: 'KOH',
    label: 'KOH',
    density: { 5: 1045, 10: 1092, 20: 1188 },
    atmosphericDepression: { 10: 2.2, 20: 6.0, 30: 12.2, 35: 17.0, 40: 23.6, 45: 33.0, 50: 45.0, 55: 60.4, 60: 78.8, 70: 126.5, 80: 190.3 },
  },
  {
    key: 'K2CO3',
    label: 'K2CO3',
    density: { 5: 1044, 10: 1090, 20: 1190, 50: 1540 },
    atmosphericDepression: { 10: 0.8, 20: 2.2, 30: 4.4, 35: 6.0, 40: 8.0, 45: 10.9, 50: 14.6, 55: 19.0, 60: 24.0 },
  },
  {
    key: 'NH4NO3',
    label: 'NH4NO3',
    density: { 5: 1019, 10: 1040, 20: 1038, 50: 1226 },
    atmosphericDepression: { 10: 1.1, 20: 2.5, 30: 4.0, 35: 5.1, 40: 6.3, 45: 7.5, 50: 9.1, 55: 11.0, 60: 13.2, 70: 19.0, 80: 28.0 },
  },
  {
    key: 'NaCl',
    label: 'NaCl',
    density: { 5: 1034, 10: 1071, 20: 1148 },
    atmosphericDepression: { 10: 1.9, 20: 4.9, 30: 9.6 },
  },
  {
    key: 'NaNO3',
    label: 'NaNO3',
    density: { 5: 1032, 10: 1067, 20: 1143 },
    atmosphericDepression: { 10: 1.2, 20: 2.6, 30: 4.5, 35: 5.6, 40: 6.8, 45: 8.4, 50: 10.0, 55: 12.0 },
  },
  {
    key: 'NaOH',
    label: 'NaOH',
    density: { 5: 1054, 10: 1109, 20: 1219, 50: 1525 },
    atmosphericDepression: { 10: 2.8, 20: 8.2, 30: 17.0, 35: 22.0, 40: 28.0, 45: 35.0, 50: 42.2, 55: 50.6, 60: 59.6, 70: 79.6, 80: 106.6 },
  },
  {
    key: 'Na2SO4',
    label: 'Na2SO4',
    density: { 5: 1044, 10: 1092, 20: 1192 },
    atmosphericDepression: { 10: 0.8, 20: 1.8, 30: 2.8 },
  },
];

const interpolate = (points: PointMap, concentrationPercent: number): number => {
  const xs = Object.keys(points).map(Number).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  if (concentrationPercent <= xs[0]) return points[xs[0]];
  if (concentrationPercent >= xs[xs.length - 1]) return points[xs[xs.length - 1]];

  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (concentrationPercent <= x1) {
      const t = (concentrationPercent - x0) / (x1 - x0);
      return points[x0] + t * (points[x1] - points[x0]);
    }
  }
  return points[xs[xs.length - 1]];
};

export const getSolutionProperty = (key?: string) =>
  SOLUTION_PROPERTIES.find(item => item.key === key);

export const getSolutionDensity = (key: string | undefined, concentrationPercent: number, fallback = 1100) => {
  const property = getSolutionProperty(key);
  return property ? interpolate(property.density, concentrationPercent) : fallback;
};

export const getSolutionAtmosphericDepression = (key: string | undefined, concentrationPercent: number, fallback = 1.5) => {
  const property = getSolutionProperty(key);
  return property ? interpolate(property.atmosphericDepression, concentrationPercent) : fallback;
};

export const estimateBodyConcentrations = (
  feedFlowRateKgH: number,
  initialConcentrationPercent: number,
  finalConcentrationPercent: number,
  numberOfEffects: number,
) => {
  const gn = feedFlowRateKgH / 3600;
  const xn = initialConcentrationPercent / 100;
  const xk = finalConcentrationPercent / 100;
  if (!Number.isFinite(gn) || !Number.isFinite(xn) || !Number.isFinite(xk) || gn <= 0 || xn <= 0 || xk <= xn || numberOfEffects <= 0) {
    return Array.from({ length: Math.max(numberOfEffects, 1) }, () => initialConcentrationPercent || 0);
  }
  const wTotal = gn * (1 - xn / xk);
  const ratios = Array.from({ length: numberOfEffects }, (_, i) => 1 + i * 0.1);
  const ratioSum = ratios.reduce((sum, value) => sum + value, 0);
  const w = ratios.map(value => value * wTotal / ratioSum);
  let cumulativeW = 0;
  return w.map(value => {
    cumulativeW += value;
    return (gn * xn / (gn - cumulativeW)) * 100;
  });
};
