export type ProductBarcodeType =
  | 'ean13'
  | 'ean8'
  | 'itf14'
  | 'upc_a'
  | 'upc_e'
  | 'unknown';

const SUPPORTED_LENGTHS = new Set([8, 12, 13, 14]);

export function barcodeDigits(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /[^\d\s-]/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/[\s-]/g, '');
  return SUPPORTED_LENGTHS.has(digits.length) ? digits : undefined;
}

export function hasValidGtinCheckDigit(digits: string): boolean {
  if (!SUPPORTED_LENGTHS.has(digits.length) || !/^\d+$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  const expected = Number(digits.at(-1));
  let sum = 0;
  for (let index = body.length - 1, position = 1; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === expected;
}

export function canonicalGtin14(value: string): string | undefined {
  const digits = barcodeDigits(value);
  if (!digits || !hasValidGtinCheckDigit(digits)) return undefined;
  return digits.padStart(14, '0');
}

export function expandUpcE(value: string): string | undefined {
  const digits = barcodeDigits(value);
  if (!digits || digits.length !== 8) return undefined;
  const [numberSystem, first, second, third, fourth, fifth, sixth, checkDigit] = digits;
  if (numberSystem !== '0' && numberSystem !== '1') return undefined;

  let body: string;
  if (sixth === '0' || sixth === '1' || sixth === '2') {
    body = `${numberSystem}${first}${second}${sixth}0000${third}${fourth}${fifth}`;
  } else if (sixth === '3') {
    body = `${numberSystem}${first}${second}${third}00000${fourth}${fifth}`;
  } else if (sixth === '4') {
    body = `${numberSystem}${first}${second}${third}${fourth}00000${fifth}`;
  } else {
    body = `${numberSystem}${first}${second}${third}${fourth}${fifth}0000${sixth}`;
  }
  const upcA = `${body}${checkDigit}`;
  return hasValidGtinCheckDigit(upcA) ? upcA : undefined;
}

export function barcodeLookupCandidates(
  value: string,
  type: ProductBarcodeType = 'unknown',
): string[] {
  const digits = barcodeDigits(value);
  if (!digits) return [];
  const candidates: string[] = [];

  if (type !== 'upc_e') {
    const direct = canonicalGtin14(digits);
    if (direct) candidates.push(direct);
  }
  if (digits.length === 8 && (type === 'upc_e' || type === 'unknown')) {
    const expanded = expandUpcE(digits);
    const canonicalExpanded = expanded ? canonicalGtin14(expanded) : undefined;
    if (canonicalExpanded) candidates.push(canonicalExpanded);
  }

  return [...new Set(candidates)];
}

export function supportedProductBarcodeType(type: string): ProductBarcodeType {
  if (
    type === 'ean13' ||
    type === 'ean8' ||
    type === 'itf14' ||
    type === 'upc_a' ||
    type === 'upc_e'
  ) {
    return type;
  }
  return 'unknown';
}
