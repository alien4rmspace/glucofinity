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
        'Extract editable meal details from the transcript. Return only JSON with this exact shape: {"mealName":"optional concise name","foods":["food and portion explicitly stated"]}. Preserve stated quantities and units in each food string, such as "two eggs" or "1 cup brown rice". Use only words, quantities, units, and foods stated in the transcript. Omit uncertain details. Do not estimate nutrition, glucose effects, medication, diagnosis, treatment, or advice.',
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

  return {
    mealName: optionalGroundedString(
      parsed.mealName,
      reviewedTranscript,
      "mealName",
      MAX_MEAL_NAME_LENGTH,
    ),
    foods: foods.filter(
      (food, index) =>
        foods.findIndex((candidate) => candidate.toLocaleLowerCase() === food.toLocaleLowerCase()) ===
        index,
    ),
  };
}
