import type {
  MedicationDoseUnit,
  MedicationLogStatus,
  MedicationRoute,
} from '@/types/health';

interface Message {
  role: 'system' | 'user';
  content: string;
}

export interface MedicationTranscriptExtraction {
  medicationName?: string;
  status?: MedicationLogStatus;
  doseAmount?: number;
  doseUnit?: MedicationDoseUnit;
  route?: MedicationRoute;
  occurredAt?: string;
  timeExpression?: string;
}

const MAX_TRANSCRIPT_LENGTH = 1_000;
const MAX_MEDICATION_NAME_LENGTH = 120;
const STATUS_VALUES = new Set<MedicationLogStatus>(['taken', 'skipped', 'missed']);
const DOSE_UNIT_VALUES = new Set<MedicationDoseUnit>([
  'mg',
  'mcg',
  'g',
  'mL',
  'units',
  'tablet',
  'capsule',
  'other',
]);
const ROUTE_VALUES = new Set<MedicationRoute>([
  'oral',
  'injection',
  'topical',
  'inhaled',
  'sublingual',
  'other',
]);
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'and', 'a',
  'an', 'half',
] as const;
const NUMBER_WORD_PATTERN = NUMBER_WORDS.join('|');
const DOSE_UNIT_PATTERN =
  /(milligrams?|mg|micrograms?|mcg|grams?|g|milliliters?|millilitres?|ml|units?|tablets?|capsules?)\b/gi;
const MISSED_EVENT =
  /\b(?:missed|forgot(?:\s+to\s+take)?|did\s+not\s+take|didn['’]?t\s+take|was\s+unable\s+to\s+take)\b/i;
const SKIPPED_EVENT = /\bskipped\b/i;
const TAKEN_EVENT =
  /\b(?:(?:i\s+)?(?:took|have\s+taken)|i['’]ve\s+taken|used(?!\s+to\b)|applied|injected|administered|swallowed)\b/i;

export class MedicationTranscriptExtractionError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isContiguouslyGrounded(value: string, transcript: string): boolean {
  const candidate = normalizeWords(value);
  const source = normalizeWords(transcript);
  if (candidate.length === 0 || candidate.length > source.length) return false;
  return source.some((_, index) =>
    candidate.every((word, offset) => source[index + offset] === word),
  );
}

function normalizedSentence(value: string): string {
  const reviewed = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\bi\b/g, 'I')
    .trim();
  if (!reviewed) return reviewed;
  const capitalized = reviewed.charAt(0).toLocaleUpperCase() + reviewed.slice(1);
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

export function validateMedicationTranscript(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new MedicationTranscriptExtractionError(
      'A spoken medication event is required.',
    );
  }
  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) {
    throw new MedicationTranscriptExtractionError(
      'The medication description is too long.',
    );
  }
  return trimmed;
}

export function refineMedicationTranscript(transcript: string): string {
  return normalizedSentence(validateMedicationTranscript(transcript));
}

export function detectMedicationEventStatus(
  transcript: string,
): MedicationLogStatus | undefined {
  if (MISSED_EVENT.test(transcript)) return 'missed';
  if (SKIPPED_EVENT.test(transcript)) return 'skipped';
  if (TAKEN_EVENT.test(transcript)) return 'taken';
  return undefined;
}

function normalizedDoseUnit(value: string): MedicationDoseUnit {
  const unit = value.toLocaleLowerCase();
  if (unit === 'mg' || unit.startsWith('milligram')) return 'mg';
  if (unit === 'mcg' || unit.startsWith('microgram')) return 'mcg';
  if (unit === 'g' || unit.startsWith('gram')) return 'g';
  if (unit === 'ml' || unit.startsWith('milliliter') || unit.startsWith('millilitre')) {
    return 'mL';
  }
  if (unit.startsWith('unit')) return 'units';
  if (unit.startsWith('tablet')) return 'tablet';
  return 'capsule';
}

function parseWholeNumberWords(words: readonly string[]): number | undefined {
  const small: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    if (word === 'and') continue;
    if (word === 'a' || word === 'an') {
      current += 1;
      found = true;
      continue;
    }
    if (word === 'hundred') {
      current = Math.max(1, current) * 100;
      found = true;
      continue;
    }
    if (word === 'thousand') {
      total += Math.max(1, current) * 1_000;
      current = 0;
      found = true;
      continue;
    }
    if (small[word] === undefined) return undefined;
    current += small[word];
    found = true;
  }
  return found ? total + current : undefined;
}

function parseSpokenNumber(value: string): number | undefined {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const words = value.toLocaleLowerCase().replace(/-/g, ' ').trim().split(/\s+/);
  const halfIndex = words.indexOf('half');
  if (halfIndex >= 0) {
    const baseWords = words.slice(0, halfIndex).filter((word) => word !== 'a' && word !== 'an' && word !== 'and');
    const base = baseWords.length > 0 ? parseWholeNumberWords(baseWords) : 0;
    return base === undefined ? undefined : base + 0.5;
  }
  return parseWholeNumberWords(words);
}

function precedingDoseNumber(transcript: string, unitIndex: number): number | undefined {
  const prefix = transcript.slice(Math.max(0, unitIndex - 80), unitIndex);
  const numeric = prefix.match(/(\d+(?:\.\d+)?)\s*$/);
  if (numeric) return Number(numeric[1]);
  const words = prefix.match(
    new RegExp(`((?:(?:${NUMBER_WORD_PATTERN})(?:[\\s-]+|$)){1,8})$`, 'i'),
  );
  return words ? parseSpokenNumber(words[1].trim()) : undefined;
}

function extractExplicitDose(
  transcript: string,
): Pick<MedicationTranscriptExtraction, 'doseAmount' | 'doseUnit'> {
  DOSE_UNIT_PATTERN.lastIndex = 0;
  for (const match of transcript.matchAll(DOSE_UNIT_PATTERN)) {
    const amount = precedingDoseNumber(transcript, match.index ?? 0);
    if (amount !== undefined && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000) {
      return {
        doseAmount: amount,
        doseUnit: normalizedDoseUnit(match[1]),
      };
    }
  }
  return {};
}

function extractExplicitRoute(transcript: string): MedicationRoute | undefined {
  if (/\b(?:sublingual(?:ly)?|under\s+(?:my|the)\s+tongue)\b/i.test(transcript)) {
    return 'sublingual';
  }
  if (/\b(?:by\s+mouth|orally|swallowed)\b/i.test(transcript)) return 'oral';
  if (/\b(?:injected|injection|shot)\b/i.test(transcript)) return 'injection';
  if (/\b(?:inhaled|inhaler|nebulized|nebuliser|nebulizer)\b/i.test(transcript)) {
    return 'inhaled';
  }
  if (/\b(?:topical(?:ly)?|on\s+(?:my|the)\s+skin|skin\s+patch)\b/i.test(transcript)) {
    return 'topical';
  }
  return undefined;
}

function medicationActionEnd(transcript: string, status: MedicationLogStatus): number {
  const pattern = status === 'missed'
    ? MISSED_EVENT
    : status === 'skipped'
      ? SKIPPED_EVENT
      : TAKEN_EVENT;
  const match = pattern.exec(transcript);
  return match ? (match.index ?? 0) + match[0].length : 0;
}

function doseExpressionPattern(): RegExp {
  return new RegExp(
    `(?:\\d+(?:\\.\\d+)?|(?:(?:${NUMBER_WORD_PATTERN})(?:[\\s-]+|$)){1,8})\\s*` +
      '(?:milligrams?|mg|micrograms?|mcg|grams?|g|milliliters?|millilitres?|ml|units?|tablets?|capsules?)\\b',
    'gi',
  );
}

function fallbackMedicationName(
  transcript: string,
  status: MedicationLogStatus,
): string | undefined {
  let candidate = transcript.slice(medicationActionEnd(transcript, status));
  candidate = candidate
    .replace(doseExpressionPattern(), ' ')
    .split(/\b(?:by\s+mouth|orally|sublingual(?:ly)?|under\s+(?:my|the)\s+tongue|at\s+\d|today|yesterday|tonight|this\s+(?:morning|afternoon|evening)|because|since)\b/i)[0]
    .replace(/^[\s,.;]*(?:(?:my|the|a|an)\s+)*(?:dose\s+of\s+|of\s+)?/i, '')
    .replace(/^(?:morning|afternoon|evening|nightly)\s+/i, '')
    .replace(/[\s,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!candidate || candidate.length > MAX_MEDICATION_NAME_LENGTH) return undefined;
  return candidate;
}

function parseExplicitClockTime(
  transcript: string,
): { hour: number; minute: number; expression: string } | undefined {
  const patterns = [
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|this\s+morning|this\s+afternoon|this\s+evening|tonight)?\b/i,
    /\b(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/i,
    /\b(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|this\s+morning|this\s+afternoon|this\s+evening|tonight)\b/i,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (!match) continue;
    const rawHour = Number(match[1]);
    const hasColon = match[0].includes(':');
    const minute = hasColon ? Number(match[2] ?? 0) : 0;
    const context = (hasColon ? match[3] : match[2] ?? match[3] ?? '')
      .toLocaleLowerCase()
      .replace(/[.\s]/g, '');
    if (!Number.isInteger(rawHour) || !Number.isInteger(minute) || minute > 59) continue;
    if (!context && rawHour <= 12 && !hasColon) continue;
    if (rawHour > 23 || (context && rawHour > 12) || rawHour < 0) continue;
    const isPm = context.startsWith('p') || context.includes('afternoon') ||
      context.includes('evening') || context.includes('tonight');
    const isAm = context.startsWith('a') || context.includes('morning');
    let hour = rawHour;
    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;
    return { hour, minute, expression: match[0].trim() };
  }
  return undefined;
}

function extractExplicitTime(
  transcript: string,
  referenceDate: Date,
): Pick<MedicationTranscriptExtraction, 'occurredAt' | 'timeExpression'> {
  const clock = parseExplicitClockTime(transcript);
  if (!clock || !Number.isFinite(referenceDate.getTime())) return {};
  const occurredAt = new Date(referenceDate);
  if (/\byesterday\b/i.test(transcript)) occurredAt.setDate(occurredAt.getDate() - 1);
  occurredAt.setHours(clock.hour, clock.minute, 0, 0);
  if (occurredAt.getTime() > referenceDate.getTime() + 5 * 60_000) return {};
  return {
    occurredAt: occurredAt.toISOString(),
    timeExpression: clock.expression,
  };
}

export function extractGroundedMedicationFromTranscript(
  transcript: string,
  referenceDate = new Date(),
): MedicationTranscriptExtraction {
  const reviewedTranscript = validateMedicationTranscript(transcript);
  const status = detectMedicationEventStatus(reviewedTranscript);
  if (!status) return {};
  return {
    medicationName: fallbackMedicationName(reviewedTranscript, status),
    status,
    ...extractExplicitDose(reviewedTranscript),
    ...(extractExplicitRoute(reviewedTranscript)
      ? { route: extractExplicitRoute(reviewedTranscript) }
      : {}),
    ...extractExplicitTime(reviewedTranscript, referenceDate),
  };
}

function extractJsonObject(value: string): string {
  const withoutThinking = value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const firstBrace = withoutThinking.indexOf('{');
  const lastBrace = withoutThinking.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new MedicationTranscriptExtractionError(
      'The local model did not return a structured medication draft.',
    );
  }
  return withoutThinking.slice(firstBrace, lastBrace + 1);
}

export function buildMedicationTranscriptMessages(transcript: string): Message[] {
  const reviewedTranscript = validateMedicationTranscript(transcript);
  return [
    {
      role: 'system',
      content: 'Extract a reviewable medication event from the transcript. Return only JSON with exactly these fields: {"medicationName":"exact spoken name or null","status":"taken, skipped, missed, or null","doseAmount":number or null,"doseUnit":"mg, mcg, g, mL, units, tablet, capsule, other, or null","route":"oral, injection, topical, inhaled, sublingual, other, or null","timeExpression":"exact spoken time phrase or null"}. Describe only an event the speaker says already happened. "Supposed to take," "need to take," schedules, and future plans are not completed events. Never correct or invent a medication name. Never infer a dose, unit, route, or time. A missed or skipped event may omit dose details. Use null for anything not explicit. Do not provide instructions, interaction checks, dosing advice, diagnosis, treatment, or recommendations.',
    },
    { role: 'user', content: `Medication transcript:\n${reviewedTranscript}` },
  ];
}

export function parseMedicationTranscriptExtraction(
  modelOutput: string,
  transcript: string,
  referenceDate = new Date(),
): MedicationTranscriptExtraction {
  const reviewedTranscript = validateMedicationTranscript(transcript);
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(modelOutput));
  } catch (error) {
    if (error instanceof MedicationTranscriptExtractionError) throw error;
    throw new MedicationTranscriptExtractionError(
      'The local model returned malformed medication details.',
    );
  }
  if (!isRecord(parsed)) {
    throw new MedicationTranscriptExtractionError('The medication draft must be an object.');
  }
  const allowedFields = new Set([
    'medicationName', 'status', 'doseAmount', 'doseUnit', 'route', 'timeExpression',
  ]);
  const unexpectedFields = Object.keys(parsed).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    throw new MedicationTranscriptExtractionError(
      `The medication draft included unsupported fields: ${unexpectedFields.join(', ')}.`,
    );
  }

  const deterministic = extractGroundedMedicationFromTranscript(
    reviewedTranscript,
    referenceDate,
  );
  if (!deterministic.status) {
    throw new MedicationTranscriptExtractionError(
      'The transcript did not describe a medication event that already happened.',
    );
  }
  if (
    parsed.status !== null && parsed.status !== undefined &&
    (typeof parsed.status !== 'string' ||
      !STATUS_VALUES.has(parsed.status as MedicationLogStatus) ||
      parsed.status !== deterministic.status)
  ) {
    throw new MedicationTranscriptExtractionError(
      'The proposed medication status was not supported by the transcript.',
    );
  }
  if (typeof parsed.medicationName !== 'string') {
    throw new MedicationTranscriptExtractionError('A spoken medication name is required.');
  }
  const medicationName = parsed.medicationName.trim();
  if (
    !medicationName || medicationName.length > MAX_MEDICATION_NAME_LENGTH ||
    !isContiguouslyGrounded(medicationName, reviewedTranscript)
  ) {
    throw new MedicationTranscriptExtractionError(
      'The proposed medication name was not stated in the transcript.',
    );
  }

  const modelDoseSpecified = parsed.doseAmount !== null && parsed.doseAmount !== undefined ||
    parsed.doseUnit !== null && parsed.doseUnit !== undefined;
  if (modelDoseSpecified) {
    if (
      typeof parsed.doseAmount !== 'number' ||
      !Number.isFinite(parsed.doseAmount) ||
      typeof parsed.doseUnit !== 'string' ||
      !DOSE_UNIT_VALUES.has(parsed.doseUnit as MedicationDoseUnit) ||
      parsed.doseAmount !== deterministic.doseAmount ||
      parsed.doseUnit !== deterministic.doseUnit
    ) {
      throw new MedicationTranscriptExtractionError(
        'The proposed dose was not explicitly supported by the transcript.',
      );
    }
  }
  if (parsed.route !== null && parsed.route !== undefined) {
    if (
      typeof parsed.route !== 'string' ||
      !ROUTE_VALUES.has(parsed.route as MedicationRoute) ||
      parsed.route !== deterministic.route
    ) {
      throw new MedicationTranscriptExtractionError(
        'The proposed route was not explicitly supported by the transcript.',
      );
    }
  }
  if (parsed.timeExpression !== null && parsed.timeExpression !== undefined) {
    if (
      typeof parsed.timeExpression !== 'string' ||
      !isContiguouslyGrounded(parsed.timeExpression, reviewedTranscript)
    ) {
      throw new MedicationTranscriptExtractionError(
        'The proposed time was not explicitly supported by the transcript.',
      );
    }
  }

  return {
    ...deterministic,
    medicationName,
  };
}
