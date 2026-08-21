import type { TargetRange, UserSettings } from '@/types/health';

export const palette = {
  background: '#F4F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF2F7',
  navy: '#102A43',
  text: '#243B53',
  textMuted: '#627D98',
  border: '#D9E2EC',
  blue: '#2563EB',
  blueSoft: '#E8F0FF',
  purple: '#7357D8',
  purpleSoft: '#F0ECFF',
  cyan: '#0E7490',
  cyanSoft: '#E0F7FA',
  green: '#18794E',
  greenSoft: '#E7F6EE',
  amber: '#A15C00',
  amberSoft: '#FFF3D6',
  red: '#B42318',
  redSoft: '#FDECEC',
  shadow: '#102A43',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const defaultTargetRange: TargetRange = {
  lowMgDl: 70,
  highMgDl: 180,
};

export const defaultSettings: UserSettings = {
  units: 'mg/dL',
  targetRange: defaultTargetRange,
  glucoseDisplayRangePreset: 'custom',
  glucoseDataSource: 'none',
};
