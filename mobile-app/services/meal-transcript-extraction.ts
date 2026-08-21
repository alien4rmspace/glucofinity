import type { Message } from 'react-native-executorch';

export interface MealTranscriptExtraction {
  mealName?: string;
  foods: string[];
}

export class MealTranscriptExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealTranscriptExtractionError';
  }
}

const MAX_TRANSCRIPT_LENGTH = 4000;
const MAX_MEAL_NAME_LENGTH = 80;
const MAX_FOOD_NAME_LENGTH = 80;
const MAX_FOODS = 20;

const MEAL_TYPE_WORDS = new Set([
  'breakfast', 'brunch', 'lunch', 'dinner', 'supper', 'snack', 'meal',
]);

const PORTION_WORDS = new Set([
  'a', 'an', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty',
  'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'half', 'quarter',
  'percent', 'gram', 'grams', 'g', 'ounce', 'ounces', 'oz', 'cup', 'cups',
  'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp', 'slice',
  'slices', 'piece', 'pieces', 'item', 'items', 'container', 'containers',
]);

const CONNECTOR_WORDS = new Set([
  'and', 'of', 'plus', 'with', 'then', 'also', 'next', 'finally', 'afterward', 'afterwards',
]);

const FOOD_BOUNDARY_CONNECTOR_PATTERN =
  '(?:and|plus|with|then|also|next|finally|afterwards?)';
const LEADING_FOOD_CONNECTORS = new RegExp(
  `^(?:${FOOD_BOUNDARY_CONNECTOR_PATTERN}(?:\\s+|$))+`,
  'i'
);
const TRAILING_FOOD_CONNECTORS = new RegExp(
  `(?:\\s+${FOOD_BOUNDARY_CONNECTOR_PATTERN})+$`,
  'i'
);
const SPOKEN_NUMBER_PATTERN =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
const SPOKEN_QUANTITY_PATTERN =
  `(?:a|an|half|quarter|\\d+(?:\\.\\d+)?|${SPOKEN_NUMBER_PATTERN}(?:[\\s-]+${SPOKEN_NUMBER_PATTERN})*(?:\\s+and\\s+(?:a\\s+)?half)?)`;
const PORTION_UNIT_PATTERN =
  '(?:grams?|g|ounces?|oz|cups?|tablespoons?|tbsp|teaspoons?|tsp|slices?|pieces?|items?|containers?)';
const UNPUNCTUATED_PORTION_START = new RegExp(
  `\\b${SPOKEN_QUANTITY_PATTERN}\\s+${PORTION_UNIT_PATTERN}\\b`,
  'gi'
);
const MISHEARD_GRAM_UNIT = new RegExp(
  `\\b(${SPOKEN_QUANTITY_PATTERN})\\s+grands?\\b`,
  'gi'
);

const MEAL_TIME_CONTEXT_PATTERN =
  '(?:today|tonight|this\\s+(?:morning|afternoon|evening))';
const MEAL_ACTION_PATTERN =
  '(?:had|ate|have|am\\s+having|are\\s+having)';
const MISSING_TIME_CONTEXT_ACTION = new RegExp(
  `^(${MEAL_TIME_CONTEXT_PATTERN})\\s*,?\\s+i\\s+(?=${SPOKEN_QUANTITY_PATTERN}\\s+${PORTION_UNIT_PATTERN}\\b)`,
  'i'
);
const MISSING_FIRST_PERSON_ACTION = new RegExp(
  `^i\\s+(?=${SPOKEN_QUANTITY_PATTERN}\\s+${PORTION_UNIT_PATTERN}\\b)`,
  'i'
);
const LEADING_MEAL_CONTEXT = [
  /^(?:today|tonight|this\s+(?:morning|afternoon|evening))\b\s*,?\s*/i,
  /^(?:for|at)\s+(?:breakfast|brunch|lunch|dinner|supper|snack|my meal)\s*,?\s*/i,
  /^(?:my\s+(?:breakfast|brunch|lunch|dinner|supper|snack|meal)\s+(?:was|included)\s+)/i,
  /^(?:(?:i|we)\s+)?(?:had|ate|have|am having|are having)(?:\s+|$)/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedWords(value: string): string[] {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

function isGroundedInTranscript(value: string, transcript: string): boolean {
  const transcriptWords = new Set(normalizedWords(transcript));
  const candidateWords = normalizedWords(value).filter((word) => word.length > 2);
  return candidateWords.length > 0 && candidateWords.every((word) => transcriptWords.has(word));
}

function isNumericWord(value: string): boolean {
  return /^\d+$/.test(value);
}

function isPortionOnlyDescription(value: string): boolean {
  const words = normalizedWords(value);
  return words.length > 0 && words.every((word) =>
    PORTION_WORDS.has(word) || CONNECTOR_WORDS.has(word) || isNumericWord(word)
  );
}

function foodNameWords(value: string): string[] {
  const words = normalizedWords(value).filter((word) =>
    !PORTION_WORDS.has(word) && !MEAL_TYPE_WORDS.has(word) && !isNumericWord(word)
  );
  while (words.length > 0 && CONNECTOR_WORDS.has(words[0])) words.shift();
  while (words.length > 0 && CONNECTOR_WORDS.has(words[words.length - 1])) words.pop();
  return words;
}

function foodName(value: string): string | undefined {
  const words = foodNameWords(value);
  if (words.length === 0) return undefined;
  return words.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1)).join(' ');
}

function removeLeadingMealContext(value: string): string {
  let reviewed = value.trim();
  for (const pattern of LEADING_MEAL_CONTEXT) reviewed = reviewed.replace(pattern, '');
  return reviewed.trim();
}

function normalizeSpeechPortionUnits(value: string): string {
  return value.replace(MISHEARD_GRAM_UNIT, (_match, quantity: string) => `${quantity} grams`);
}

function capitalizeSentenceStart(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function normalizeSentenceText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\bi\b/g, 'I')
    .trim();
}

function ensureSentenceEnding(value: string): string {
  const capitalized = capitalizeSentenceStart(value);
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

function readableMealIntro(value: string): string | undefined {
  const timeContext = value.match(new RegExp(
    `^(${MEAL_TIME_CONTEXT_PATTERN})\\s*,?\\s+((?:I|we)\\s+${MEAL_ACTION_PATTERN})\\s+`,
    'i'
  ));
  if (timeContext) {
    return capitalizeSentenceStart(
      normalizeSentenceText(`${timeContext[1]} ${timeContext[2]}`)
    );
  }

  const mealContext = value.match(new RegExp(
    `^((?:for|at)\\s+(?:breakfast|brunch|lunch|dinner|supper|snack))\\s*,?\\s+((?:I|we)\\s+${MEAL_ACTION_PATTERN})\\s+`,
    'i'
  ));
  if (mealContext) {
    return `${capitalizeSentenceStart(mealContext[1].toLocaleLowerCase())}, ${normalizeSentenceText(mealContext[2])}`;
  }

  const firstPerson = value.match(new RegExp(
    `^((?:I|we)\\s+${MEAL_ACTION_PATTERN})\\s+`,
    'i'
  ));
  if (!firstPerson) return undefined;
  return capitalizeSentenceStart(normalizeSentenceText(firstPerson[1]));
}

function joinFoodSentence(foods: readonly string[]): string {
  if (foods.length <= 1) return foods[0] ?? '';
  if (foods.length === 2) return `${foods[0]} and ${foods[1]}`;
  return `${foods.slice(0, -1).join(', ')}, and ${foods[foods.length - 1]}`;
}

function splitUnpunctuatedPortionClauses(value: string): string[] {
  const boundaries = [0];
  UNPUNCTUATED_PORTION_START.lastIndex = 0;
  for (const match of value.matchAll(UNPUNCTUATED_PORTION_START)) {
    const matchIndex = match.index;
    const currentStart = boundaries[boundaries.length - 1];
    if (matchIndex === 0 || matchIndex === currentStart) continue;
    const precedingClause = value.slice(currentStart, matchIndex).trim();
    if (foodNameWords(precedingClause).length > 0) boundaries.push(matchIndex);
  }
  return boundaries.map((start, index) =>
    value.slice(start, boundaries[index + 1] ?? value.length).trim()
  );
}

function cleanFoodClause(value: string): string {
  return value.trim().replace(/[.!?]+$/u, '').trim()
    .replace(LEADING_FOOD_CONNECTORS, '').replace(TRAILING_FOOD_CONNECTORS, '').trim();
}

function splitFoodClauses(value: string): string[] {
  const reviewed = removeLeadingMealContext(value);
  return reviewed
    .split(/\s*(?:,|;)\s*|\s+(?:and|plus|with)\s+(?!a\s+half\b)/i)
    .flatMap(splitUnpunctuatedPortionClauses)
    .map(cleanFoodClause)
    .filter((food) => food.length > 0 && food.length <= MAX_FOOD_NAME_LENGTH)
    .slice(0, MAX_FOODS);
}

export function splitFoodDescriptions(value: string): string[] {
  return value.split(/[\n,;]+/).map(cleanFoodClause).filter(Boolean).slice(0, MAX_FOODS);
}

export function deriveMealNameFromFoods(foods: readonly string[]): string | undefined {
  const names = foods.map(foodName).filter((name): name is string => Boolean(name)).filter(
    (name, index, values) => values.findIndex((candidate) =>
      candidate.toLocaleLowerCase() === name.toLocaleLowerCase()) === index
  );
  if (names.length === 0) return undefined;
  return names.join(', ').slice(0, MAX_MEAL_NAME_LENGTH);
}

/**
 * Conservatively makes a rough speech transcript readable before meal extraction.
 * It adds only grammar, separators, capitalization, and known portion-unit repair;
 * food names and quantities continue to come from the transcript itself.
 */
export function refineMealTranscript(transcript: string): string {
  let reviewed = normalizeSentenceText(
    normalizeSpeechPortionUnits(validateMealTranscript(transcript))
  );
  reviewed = reviewed.replace(
    MISSING_TIME_CONTEXT_ACTION,
    (_match, context: string) => `${capitalizeSentenceStart(context.toLocaleLowerCase())} I ate `
  );
  reviewed = reviewed.replace(MISSING_FIRST_PERSON_ACTION, 'I ate ');

  const intro = readableMealIntro(reviewed);
  if (!intro) return ensureSentenceEnding(reviewed);

  const foods = splitFoodClauses(reviewed);
  if (foods.length === 0) return ensureSentenceEnding(reviewed);
  return `${intro} ${joinFoodSentence(foods)}.`;
}

export function extractGroundedMealFromTranscript(transcript: string): MealTranscriptExtraction {
  const reviewedTranscript = normalizeSpeechPortionUnits(validateMealTranscript(transcript));
  const foods = splitFoodClauses(reviewedTranscript).filter(
    (food, index, values) => values.findIndex((candidate) =>
      candidate.toLocaleLowerCase() === food.toLocaleLowerCase()) === index
  );
  return { mealName: deriveMealNameFromFoods(foods), foods };
}

function optionalGroundedString(
  value: unknown,
  transcript: string,
  fieldName: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new MealTranscriptExtractionError(`${fieldName} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new MealTranscriptExtractionError(`${fieldName} is too long or empty.`);
  }
  if (!isGroundedInTranscript(trimmed, transcript)) {
    throw new MealTranscriptExtractionError(`${fieldName} included words that were not present in the transcript.`);
  }
  return trimmed;
}

function extractJsonObject(value: string): string {
  const withoutThinking = value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const firstBrace = withoutThinking.indexOf('{');
  const lastBrace = withoutThinking.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new MealTranscriptExtractionError('The local model did not return a structured meal draft.');
  }
  return withoutThinking.slice(firstBrace, lastBrace + 1);
}

export function validateMealTranscript(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) throw new MealTranscriptExtractionError('A spoken meal description is required.');
  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) throw new MealTranscriptExtractionError('The meal description is too long.');
  return trimmed;
}

export function buildMealTranscriptMessages(transcript: string): Message[] {
  const reviewedTranscript = normalizeSpeechPortionUnits(validateMealTranscript(transcript));
  return [
    {
      role: 'system',
      content: 'Extract editable meal details from the transcript. Return only JSON with this exact shape: {"mealName":"food-name summary only","foods":["food and portion explicitly stated"]}. The mealName must contain food names, never meal types such as breakfast, lunch, dinner, or snack. Return one foods array item for every explicitly stated food, including its own stated quantity and unit; never combine multiple foods into one item and never return a quantity or unit alone. Never return a discourse connector such as then or also alone. Speech transcripts may omit all punctuation and connector words; repeated quantities and units start separate foods. Examples: {"mealName":"White rice","foods":["nine grams of white rice"]} and {"mealName":"Brown rice, salmon","foods":["nine grams of brown rice","five grams of salmon"]}. Preserve stated quantities and units. Use only words, quantities, units, and foods stated in the transcript. Omit uncertain details. Do not estimate nutrition, glucose effects, medication, diagnosis, treatment, or advice.',
    },
    { role: 'user', content: `Meal transcript:\n${reviewedTranscript}` },
  ];
}

export function parseMealTranscriptExtraction(
  modelOutput: string,
  transcript: string
): MealTranscriptExtraction {
  const reviewedTranscript = normalizeSpeechPortionUnits(validateMealTranscript(transcript));
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(modelOutput));
  } catch (error) {
    if (error instanceof MealTranscriptExtractionError) throw error;
    throw new MealTranscriptExtractionError('The local model returned malformed meal details.');
  }
  if (!isRecord(parsed)) throw new MealTranscriptExtractionError('The meal draft must be an object.');
  const unexpectedFields = Object.keys(parsed).filter((field) => field !== 'mealName' && field !== 'foods');
  if (unexpectedFields.length > 0) {
    throw new MealTranscriptExtractionError(`The meal draft included unsupported fields: ${unexpectedFields.join(', ')}.`);
  }
  if (!Array.isArray(parsed.foods)) throw new MealTranscriptExtractionError('The meal draft foods must be an array.');
  if (parsed.foods.length > MAX_FOODS) throw new MealTranscriptExtractionError('The meal draft included too many foods.');

  const foods = parsed.foods.flatMap((food, index) => {
    const validated = optionalGroundedString(food, reviewedTranscript, `foods[${index}]`, MAX_FOOD_NAME_LENGTH);
    if (!validated) throw new MealTranscriptExtractionError(`foods[${index}] is required.`);
    return splitFoodClauses(validated);
  });
  const groundedModelMealName = optionalGroundedString(
    parsed.mealName, reviewedTranscript, 'mealName', MAX_MEAL_NAME_LENGTH
  );
  let reviewedFoods = foods.filter((food, index) => foods.findIndex((candidate) =>
    candidate.toLocaleLowerCase() === food.toLocaleLowerCase()) === index);

  if (reviewedFoods.length === 1 && groundedModelMealName && isPortionOnlyDescription(reviewedFoods[0])) {
    const groundedFoodName = foodName(groundedModelMealName);
    if (groundedFoodName) {
      const repairedFood = `${reviewedFoods[0]} ${groundedFoodName}`;
      if (isGroundedInTranscript(repairedFood, reviewedTranscript)) reviewedFoods = [repairedFood];
    }
  }
  return {
    mealName: deriveMealNameFromFoods(reviewedFoods) ?? foodName(groundedModelMealName ?? ''),
    foods: reviewedFoods,
  };
}
