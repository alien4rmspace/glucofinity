import type {
  MedicationDoseUnit,
  MedicationEntry,
  MedicationLogStatus,
  MedicationRoute,
} from '@/types/health';

export const MEDICATION_DOSE_UNITS: readonly {
  value: MedicationDoseUnit;
  label: string;
}[] = [
  { value: 'mg', label: 'mg' },
  { value: 'mcg', label: 'mcg' },
  { value: 'g', label: 'g' },
  { value: 'mL', label: 'mL' },
  { value: 'units', label: 'Units' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'other', label: 'Other' },
] as const;

export const MEDICATION_ROUTES: readonly {
  value: MedicationRoute;
  label: string;
}[] = [
  { value: 'oral', label: 'Oral' },
  { value: 'injection', label: 'Injection' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhaled', label: 'Inhaled' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'other', label: 'Other' },
] as const;

const DOSE_UNITS = new Set<MedicationDoseUnit>(
  MEDICATION_DOSE_UNITS.map(({ value }) => value),
);
const ROUTES = new Set<MedicationRoute>(
  MEDICATION_ROUTES.map(({ value }) => value),
);
const STATUSES = new Set<MedicationLogStatus>(['taken', 'skipped', 'missed']);

export function medicationStatusLabel(status: MedicationLogStatus): string {
  const labels: Record<MedicationLogStatus, string> = {
    taken: 'Taken',
    skipped: 'Skipped',
    missed: 'Missed',
  };
  return labels[status];
}

export function medicationRouteLabel(route: MedicationRoute): string {
  return MEDICATION_ROUTES.find(({ value }) => value === route)?.label ?? route;
}

export function formatMedicationDose(entry: MedicationEntry): string | undefined {
  if (entry.doseAmount === undefined || entry.doseUnit === undefined) return undefined;
  const amount = Number.isInteger(entry.doseAmount)
    ? String(entry.doseAmount)
    : String(Math.round(entry.doseAmount * 1000) / 1000);
  const unit = entry.doseUnit === 'tablet' || entry.doseUnit === 'capsule'
    ? `${entry.doseUnit}${entry.doseAmount === 1 ? '' : 's'}`
    : entry.doseUnit;
  return `${amount} ${unit}`;
}

export function sortMedicationEntries(
  entries: readonly MedicationEntry[],
): MedicationEntry[] {
  return [...entries].sort(
    (first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp),
  );
}

export function normalizeMedicationEntry(value: unknown): MedicationEntry | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || !value.id.trim()) return undefined;
  if (typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp))) {
    return undefined;
  }
  if (
    typeof value.timezoneOffsetMinutes !== 'number' ||
    !Number.isInteger(value.timezoneOffsetMinutes) ||
    value.timezoneOffsetMinutes < -840 ||
    value.timezoneOffsetMinutes > 840
  ) {
    return undefined;
  }
  if (typeof value.medicationName !== 'string') return undefined;
  const medicationName = value.medicationName.trim();
  if (!medicationName || medicationName.length > 120) return undefined;
  if (
    typeof value.status !== 'string' ||
    !STATUSES.has(value.status as MedicationLogStatus) ||
    value.source !== 'manual'
  ) {
    return undefined;
  }

  const doseAmount = value.doseAmount;
  const doseUnit = value.doseUnit;
  if (doseAmount !== undefined) {
    if (
      typeof doseAmount !== 'number' ||
      !Number.isFinite(doseAmount) ||
      doseAmount <= 0 ||
      doseAmount > 1_000_000 ||
      typeof doseUnit !== 'string' ||
      !DOSE_UNITS.has(doseUnit as MedicationDoseUnit)
    ) {
      return undefined;
    }
  } else if (doseUnit !== undefined) {
    return undefined;
  }

  const route = value.route;
  if (
    route !== undefined &&
    (typeof route !== 'string' || !ROUTES.has(route as MedicationRoute))
  ) {
    return undefined;
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') return undefined;
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  if (notes.length > 500) return undefined;

  return {
    id: value.id.trim(),
    timestamp: new Date(value.timestamp).toISOString(),
    timezoneOffsetMinutes: value.timezoneOffsetMinutes,
    medicationName,
    ...(doseAmount === undefined
      ? {}
      : {
          doseAmount,
          doseUnit: doseUnit as MedicationDoseUnit,
        }),
    ...(route === undefined ? {} : { route: route as MedicationRoute }),
    status: value.status as MedicationLogStatus,
    ...(notes ? { notes } : {}),
    source: 'manual',
  };
}

export function findPotentialDuplicateMedicationLog(
  entries: readonly MedicationEntry[],
  candidate: MedicationEntry,
  maximumDistanceMinutes = 15,
): MedicationEntry | undefined {
  if (candidate.status !== 'taken') return undefined;
  const candidateTime = Date.parse(candidate.timestamp);
  const maximumDistanceMs = Math.max(0, maximumDistanceMinutes) * 60_000;
  const normalizedName = candidate.medicationName.trim().toLocaleLowerCase();

  return entries.find((entry) =>
    entry.id !== candidate.id &&
    entry.status === 'taken' &&
    entry.medicationName.trim().toLocaleLowerCase() === normalizedName &&
    Math.abs(Date.parse(entry.timestamp) - candidateTime) <= maximumDistanceMs
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
