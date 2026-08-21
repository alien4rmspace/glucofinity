export type IngredientReviewGrade = 'A' | 'B' | 'C' | 'D' | 'Not rated';

export interface IngredientReviewObservation {
  id: 'added-sweetener' | 'partially-hydrogenated-oil' | 'certified-color' | 'no-reviewed-flags';
  label: string;
  detail: string;
  points: number;
}

export interface IngredientReview {
  grade: IngredientReviewGrade;
  score?: number;
  summary: string;
  observations: IngredientReviewObservation[];
  limitation: string;
}

const ADDED_SWEETENER = /\b(?:agave(?: nectar| syrup)?|brown sugar|cane (?:juice|sugar|syrup)|corn syrup|dextrose|fructose|glucose syrup|high[- ]fructose corn syrup|honey|invert sugar|maltose|maple syrup|molasses|rice syrup|sucrose|sugar)\b/i;
const PARTIALLY_HYDROGENATED_OIL = /\bpartially hydrogenated\b/i;
const CERTIFIED_COLOR = /\b(?:fd\s*&\s*c\s+)?(?:red|yellow|blue|green)\s*(?:no\.?\s*)?(?:1|2|3|5|6|40)\b/i;

const LIMITATION =
  'This limited rating checks only added-sweetener position, partially hydrogenated oil, and named certified colors. It does not determine overall healthfulness, allergy safety, or whether a food is appropriate for glucose management.';

export function topLevelIngredients(value: string): string[] {
  const ingredients: string[] = [];
  let current = '';
  let depth = 0;
  for (const character of value) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
    if ((character === ',' || character === ';') && depth === 0) {
      if (current.trim()) ingredients.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) ingredients.push(current.trim());
  return ingredients;
}

function gradeForScore(score: number): Exclude<IngredientReviewGrade, 'Not rated'> {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function reviewIngredients(value: string | undefined): IngredientReview {
  const ingredientText = value?.trim();
  if (!ingredientText) {
    return {
      grade: 'Not rated',
      summary: 'USDA does not include an ingredient list for this product record.',
      observations: [],
      limitation: LIMITATION,
    };
  }

  const listedIngredients = topLevelIngredients(ingredientText);
  const observations: IngredientReviewObservation[] = [];
  const firstSweetenerIndex = listedIngredients.findIndex((ingredient) =>
    ADDED_SWEETENER.test(ingredient),
  );
  if (firstSweetenerIndex >= 0) {
    const isAmongFirstThree = firstSweetenerIndex < 3;
    observations.push({
      id: 'added-sweetener',
      label: 'Added sweetener listed',
      detail: isAmongFirstThree
        ? 'An added sweetener appears among the first three listed ingredients.'
        : 'An added sweetener appears later in the ingredient list.',
      points: isAmongFirstThree ? -20 : -10,
    });
  }
  if (PARTIALLY_HYDROGENATED_OIL.test(ingredientText)) {
    observations.push({
      id: 'partially-hydrogenated-oil',
      label: 'Partially hydrogenated oil listed',
      detail: 'The ingredient text names a partially hydrogenated ingredient.',
      points: -30,
    });
  }
  if (CERTIFIED_COLOR.test(ingredientText)) {
    observations.push({
      id: 'certified-color',
      label: 'Named certified color listed',
      detail: 'The ingredient text names a certified color covered by this rubric.',
      points: -10,
    });
  }
  if (observations.length === 0) {
    observations.push({
      id: 'no-reviewed-flags',
      label: 'No reviewed flags found',
      detail: 'None of the three ingredient characteristics checked by this limited rubric were found.',
      points: 0,
    });
  }

  const score = Math.max(0, observations.reduce((total, observation) => total + observation.points, 100));
  return {
    grade: gradeForScore(score),
    score,
    summary: observations.some(({ id }) => id !== 'no-reviewed-flags')
      ? 'Review the listed observations and compare them with the package label.'
      : 'No flags were found within the limited criteria this rating checks.',
    observations,
    limitation: LIMITATION,
  };
}
