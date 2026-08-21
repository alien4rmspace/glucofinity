const DESCRIPTOR_ONLY_ALIASES = new Set([
  'babyfood',
  'beverages',
  'boiled',
  'canned',
  'candies',
  'cereals',
  'cereals ready to eat',
  'commercially prepared',
  'cooked',
  'dry',
  'fast foods',
  'frozen',
  'home prepared',
  'homemade',
  'plain',
  'prepared',
  'raw',
  'restaurant foods',
  'roasted',
  'snacks',
  'sweetened',
  'unsweetened',
]);

export const LOCAL_NUTRITION_PREFERRED_ALIASES: Readonly<Record<string, number>> = {
  'scrambled egg': 172187,
  'scrambled eggs': 172187,
  egg: 172187,
  eggs: 172187,
  'whole wheat toast': 172689,
  'wheat toast': 172689,
  toast: 174925,
  'brown rice': 169704,
  'white rice': 168878,
  salmon: 175168,
  broccoli: 169967,
  avocado: 171705,
  banana: 173944,
  apple: 171688,
  'chicken breast': 171477,
  'black beans': 173735,
  oatmeal: 171675,
  'greek yogurt': 170894,
  'peanut butter': 172470,
  milk: 171265,
  'whole milk': 171265,
  pasta: 169737,
  cheddar: 173414,
  'cheddar cheese': 173414,
  'flour tortilla': 173242,
  'corn tortilla': 173241,
  'sweet potato': 168483,
  'mixed vegetables': 170472,
  spinach: 168462,
  'ground beef': 171794,
  'lean ground beef': 171794,
  'turkey breast': 171496,
  tofu: 172448,
  potato: 170093,
  blueberry: 171711,
  blueberries: 171711,
  'blue berry': 171711,
  'blue berries': 171711,
  granola: 171646,
  lettuce: 169249,
};

export function normalizeNutritionAlias(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function singularAlias(value: string): string | undefined {
  if (value.endsWith('ies') && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s') && !value.endsWith('ss') && value.length > 3) {
    return value.slice(0, -1);
  }
  return undefined;
}

export function nutritionAliasesForDescription(description: string): readonly string[] {
  const normalizedDescription = normalizeNutritionAlias(description);
  const segments = description
    .split(',')
    .map((segment) => normalizeNutritionAlias(segment.replace(/\([^)]*\)/g, ' ')))
    .filter((segment) => segment.length >= 3 && !DESCRIPTOR_ONLY_ALIASES.has(segment));
  const aliases = new Set<string>([normalizedDescription, ...segments]);
  for (const segment of segments) {
    const singular = singularAlias(segment);
    if (singular) aliases.add(singular);
  }
  return [...aliases].sort((left, right) => right.length - left.length);
}
