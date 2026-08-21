import type { GlucoseDisplayRangePreset, TargetRange } from '@/types/health';

const DIABETES_DISPLAY_RANGE: TargetRange = {
  lowMgDl: 70,
  highMgDl: 180,
};

const PREDIABETES_OR_NO_DIABETES_DISPLAY_RANGE: TargetRange = {
  lowMgDl: 70,
  highMgDl: 140,
};

export function targetRangeForDisplayPreset(
  preset: GlucoseDisplayRangePreset
): TargetRange | null {
  if (preset === 'diabetes') return { ...DIABETES_DISPLAY_RANGE };
  if (preset === 'prediabetes-or-no-diabetes') {
    return { ...PREDIABETES_OR_NO_DIABETES_DISPLAY_RANGE };
  }
  return null;
}

export function displayRangePresetDescription(
  preset: GlucoseDisplayRangePreset
): string {
  if (preset === 'diabetes') {
    return '70–180 mg/dL, a commonly used CGM display range for many adults with diabetes.';
  }
  if (preset === 'prediabetes-or-no-diabetes') {
    return '70–140 mg/dL, the Stelo display range for prediabetes or no diabetes.';
  }
  return 'Use the lower and upper fields to choose a custom display range.';
}
