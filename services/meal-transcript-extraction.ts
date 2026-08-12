import type { MealTranscriptExtraction } from "@/types/voice-entry";

export class MealTranscriptExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealTranscriptExtractionError";
  }
}

const MAX_TRANSCRIPT_LENGTH = 4_000;
const MAX_MEAL_NAME_LENGTH = 80;
const MAX_FOOD_NAME_LENGTH = 80;
const MAX_FOODS = 20;

const MEAL_TYPE_WORDS = new Set([
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "supper",
  "snack",
  "meal",
]);

const PORTION_WORDS = new Set([
  "a",
  "an",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "half",
  "quarter",
  "percent",
  "gram",
  "grams",
  "g",
  "ounce",
  "ounces",
  "oz",
  "cup",
  "cups",
  "tablespoon",
  "tablespoons",
  "tbsp",
  "teaspoon",
  "teaspoons",
  "tsp",
  "slice",
  "slices",
  "piece",
  "pieces",
  "item",
  "items",
  "container",
  "containers",
]);

const CONNECTOR_WORDS = new Set(["and", "of"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
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
  return (
    words.length > 0 &&
    words.every(
      (word) => PORTION_WORDS.has(word) || CONNECTOR_WORDS.has(word) || isNumericWord(word),
    )
  );
}

function foodNameWords(value: string): string[] {
  const words = normalizedWords(value).filter(
    (word) =>
      !PORTION_WORDS.has(word) && !MEAL_TYPE_WORDS.has(word) && !isNumericWord(word),
  );
  while (words.length > 0 && CONNECTOR_WORDS.has(words[0])) words.shift();
  while (words.length > 0 && CONNECTOR_WORDS.has(words[words.length - 1])) words.pop();
  return words;
}

function foodName(value: string): string | undefined {
  const words = foodNameWords(value);
  if (words.length === 0) return undefined;
  return words
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveMealNameFromFoods(foods: readonly string[]): string | undefined {
  const names = foods
    .map(foodName)
    .filter((name): name is string => Boolean(name))
    .filter(
      (name, index, values) =>
        values.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ) === index,
    );
  if (names.length === 0) return undefined;
  return names.join(", ").slice(0, MAX_MEAL_NAME_LENGTH);
}

function optionalGroundedString(
  value: unknown,
  transcript: string,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new MealTranscriptExtractionError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new MealTranscriptExtractionError(`${fieldName} is too long or empty.`);
  }
  if (!isGroundedInTranscript(trimmed, transcript)) {
    throw new MealTranscriptExtractionError(
      `${fieldName} included words that were not present in the transcript.`,
    );
  }
  return trimmed;
}

function extractJsonObject(value: string): string {
  const withoutThinking = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const firstBrace = withoutThinking.indexOf("{");
  const lastBrace = withoutThinking.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new MealTranscriptExtractionError(
      "The local model did not return a structured meal draft.",
    );
  }
  return withoutThinking.slice(firstBrace, lastBrace + 1);
}

export function validateMealTranscript(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new MealTranscriptExtractionError("A spoken meal description is required.");
  }
  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) {
    throw new MealTranscriptExtractionError("The meal description is too long.");
  }
  return trimmed;
}

export function buildMealTranscriptMessages(transcript: string) {
  const reviewedTranscript = validateMealTranscript(transcript);
  return [
    {
      role: "system" as const,
      content:
        'Extract editable meal details from the transcript. Return only JSON with this exact shape: {"mealName":"food-name summary only","foods":["food and portion explicitly stated"]}. The mealName must contain food names, never meal types such as breakfast, lunch, dinner, or snack. Every foods item must repeat its food name with its stated portion; never return a quantity or unit alone. Example: {"mealName":"White rice","foods":["nine grams of white rice"]}. Preserve stated quantities and units. Use only words, quantities, units, and foods stated in the transcript. Omit uncertain details. Do not estimate nutrition, glucose effects, medication, diagnosis, treatment, or advice.',
    },
    {
      role: "user" as const,
      content: `Meal transcript:\n${reviewedTranscript}`,
    },
  ];
}

export function parseMealTranscriptExtraction(
  modelOutput: string,
  transcript: string,
): MealTranscriptExtraction {
  const reviewedTranscript = validateMealTranscript(transcript);
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(modelOutput));
  } catch (error) {
    if (error instanceof MealTranscriptExtractionError) throw error;
    throw new MealTranscriptExtractionError("The local model returned malformed meal details.");
  }
  if (!isRecord(parsed)) {
    throw new MealTranscriptExtractionError("The meal draft must be an object.");
  }
  const unexpectedFields = Object.keys(parsed).filter(
    (field) => field !== "mealName" && field !== "foods",
  );
  if (unexpectedFields.length > 0) {
    throw new MealTranscriptExtractionError(
      `The meal draft included unsupported fields: ${unexpectedFields.join(", ")}.`,
    );
  }
  if (!Array.isArray(parsed.foods)) {
    throw new MealTranscriptExtractionError("The meal draft foods must be an array.");
  }
  if (parsed.foods.length > MAX_FOODS) {
    throw new MealTranscriptExtractionError("The meal draft included too many foods.");
  }

  const foods = parsed.foods.map((food, index) => {
    const validated = optionalGroundedString(
      food,
      reviewedTranscript,
      `foods[${index}]`,
      MAX_FOOD_NAME_LENGTH,
    );
    if (!validated) {
      throw new MealTranscriptExtractionError(`foods[${index}] is required.`);
    }
    return validated;
  });

  const groundedModelMealName = optionalGroundedString(
    parsed.mealName,
    reviewedTranscript,
    "mealName",
    MAX_MEAL_NAME_LENGTH,
  );
  let reviewedFoods = foods.filter(
      (food, index) =>
        foods.findIndex((candidate) => candidate.toLocaleLowerCase() === food.toLocaleLowerCase()) ===
        index,
    );

  if (
    reviewedFoods.length === 1 &&
    groundedModelMealName &&
    isPortionOnlyDescription(reviewedFoods[0])
  ) {
    const groundedFoodName = foodName(groundedModelMealName);
    if (groundedFoodName) {
      const repairedFood = `${reviewedFoods[0]} ${groundedFoodName}`;
      if (isGroundedInTranscript(repairedFood, reviewedTranscript)) {
        reviewedFoods = [repairedFood];
      }
    }
  }

  return {
    mealName: deriveMealNameFromFoods(reviewedFoods) ?? foodName(groundedModelMealName ?? ""),
    foods: reviewedFoods,
  };
}
