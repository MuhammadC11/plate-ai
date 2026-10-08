export const colors = {
  bg: '#0B0F14',
  surface: '#141A22',
  surfaceHigh: '#1D2530',
  border: '#26303D',
  text: '#F2F5F9',
  textMuted: '#8A97A8',
  textFaint: '#5A6675',

  accent: '#7BE38B',
  accentDim: '#2A4633',

  protein: '#6BA8FF',
  carbs: '#FFB454',
  fat: '#FF7A93',

  danger: '#FF6B6B',
  overlay: 'rgba(11, 15, 20, 0.82)',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const macroColor = {
  protein: colors.protein,
  carbs: colors.carbs,
  fat: colors.fat,
} as const;
