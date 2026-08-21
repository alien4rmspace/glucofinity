function normalizeTranscript(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function comparisonWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

function startsWithWords(value: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= value.length && prefix.every((word, index) => value[index] === word);
}

export function mergeLiveSpeechTranscript(existingValue: string, incomingValue: string): string {
  const existing = normalizeTranscript(existingValue);
  const incoming = normalizeTranscript(incomingValue);
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingWords = comparisonWords(existing);
  const incomingWords = comparisonWords(incoming);
  if (existingWords.length === 0) return incoming;
  if (incomingWords.length === 0) return existing;
  if (startsWithWords(incomingWords, existingWords)) return incoming;
  if (startsWithWords(existingWords, incomingWords)) return existing;

  const maximumOverlap = Math.min(existingWords.length, incomingWords.length);
  for (let overlap = maximumOverlap; overlap > 0; overlap -= 1) {
    const existingSuffix = existingWords.slice(existingWords.length - overlap);
    if (existingSuffix.every((word, index) => word === incomingWords[index])) {
      const incomingOriginalWords = incoming.split(/\s+/);
      return normalizeTranscript(
        `${existing} ${incomingOriginalWords.slice(overlap).join(' ')}`,
      );
    }
  }

  let sharedPrefixLength = 0;
  while (
    sharedPrefixLength < maximumOverlap &&
    existingWords[sharedPrefixLength] === incomingWords[sharedPrefixLength]
  ) {
    sharedPrefixLength += 1;
  }
  if (sharedPrefixLength >= 2) {
    // Apple may revise an unstable partial result. A meaningful shared prefix
    // means the incoming value is a correction, not a new spoken segment.
    return incoming;
  }

  // When a pause causes Apple to begin a fresh segment, retain the completed
  // words and append the new partial instead of replacing the visible history.
  return `${existing} ${incoming}`;
}
