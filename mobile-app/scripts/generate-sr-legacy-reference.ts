import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const NUTRIENT_IDS = {
  proteinGrams: 1003,
  fatGrams: 1004,
  carbohydratesGrams: 1005,
  calories: 1008,
  fiberGrams: 1079,
} as const;

const SOURCE_DOWNLOAD =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';
const SOURCE_SHA256 = 'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0';

type NutrientKey = keyof typeof NUTRIENT_IDS;
type UnitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type PortionUnit =
  | 'cup'
  | 'tablespoon'
  | 'teaspoon'
  | 'slice'
  | 'item'
  | 'container'
  | 'gram'
  | 'ounce';

type SourcePortion = {
  amount: number;
  grams: number;
  label: string;
  seq: number;
  unit: PortionUnit;
};

type CompactFood = readonly [
  fdcId: number,
  name: string,
  defaultAmount: number,
  defaultUnit: UnitCode,
  defaultLabel: string,
  defaultGrams: number,
  gramsPerUnit: readonly (readonly [UnitCode, number])[],
  calories: number,
  carbohydratesGrams: number,
  proteinGrams: number,
  fatGrams: number,
  fiberGrams: number | null,
];

const UNIT_CODES: Readonly<Record<PortionUnit, UnitCode>> = {
  cup: 0,
  tablespoon: 1,
  teaspoon: 2,
  slice: 3,
  item: 4,
  container: 5,
  gram: 6,
  ounce: 7,
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

async function readCsv(
  filePath: string,
  visit: (record: Readonly<Record<string, string>>) => void,
): Promise<void> {
  const lines = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  let headers: string[] | undefined;
  for await (const line of lines) {
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = fields[index] ?? '';
    });
    visit(record);
  }
}

function portionUnit(value: string): PortionUnit {
  const normalized = value.toLocaleLowerCase().trim();
  if (/^(?:cups?|c\b)/.test(normalized)) return 'cup';
  if (/^(?:tablespoons?|tbsp\b)/.test(normalized)) return 'tablespoon';
  if (/^(?:teaspoons?|tsp\b)/.test(normalized)) return 'teaspoon';
  if (/^slices?\b/.test(normalized)) return 'slice';
  if (/^(?:containers?|packages?|packets?|jars?|bottles?|cartons?|boxes?|cans?)\b/.test(normalized)) {
    return 'container';
  }
  if (/^(?:ounces?|oz\b)/.test(normalized)) return 'ounce';
  if (/^(?:grams?|g\b)/.test(normalized)) return 'gram';
  return 'item';
}

function formatAmount(value: number): string {
  if (value === 0.25) return '1/4';
  if (value === 0.5) return '1/2';
  if (value === 0.75) return '3/4';
  return Number.isInteger(value) ? String(value) : String(value);
}

function rounded(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function portionPreference(portion: SourcePortion): number {
  const normalized = portion.label.toLocaleLowerCase();
  if (/\bmedium\b/.test(normalized)) return 0;
  if (/\blarge\b/.test(normalized)) return 1;
  if (/\bsmall\b/.test(normalized)) return 2;
  return portion.seq + 3;
}

async function main(): Promise<void> {
  const sourceDirectory = process.argv[2];
  const outputPath = process.argv[3] ?? path.resolve('data/sr-legacy-reference.compact.json');
  if (!sourceDirectory) {
    throw new Error(
      'Usage: npx tsx scripts/generate-sr-legacy-reference.ts <extracted CSV directory> [output path]',
    );
  }

  const foods = new Map<number, string>();
  await readCsv(path.join(sourceDirectory, 'food.csv'), (record) => {
    foods.set(Number(record.fdc_id), record.description);
  });

  const nutrientIdToKey = new Map<number, NutrientKey>(
    Object.entries(NUTRIENT_IDS).map(([key, id]) => [id, key as NutrientKey]),
  );
  const nutrients = new Map<number, Partial<Record<NutrientKey, number>>>();
  await readCsv(path.join(sourceDirectory, 'food_nutrient.csv'), (record) => {
    const key = nutrientIdToKey.get(Number(record.nutrient_id));
    if (!key || !foods.has(Number(record.fdc_id))) return;
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount < 0) return;
    const fdcId = Number(record.fdc_id);
    nutrients.set(fdcId, { ...nutrients.get(fdcId), [key]: amount });
  });

  const portions = new Map<number, SourcePortion[]>();
  await readCsv(path.join(sourceDirectory, 'food_portion.csv'), (record) => {
    const fdcId = Number(record.fdc_id);
    const amount = Number(record.amount);
    const grams = Number(record.gram_weight);
    if (!foods.has(fdcId) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(grams) || grams <= 0) {
      return;
    }
    const sourceLabel = (record.modifier || record.portion_description || 'item').trim();
    const portion: SourcePortion = {
      amount,
      grams,
      label: `${formatAmount(amount)} ${sourceLabel}`,
      seq: Number(record.seq_num) || Number.MAX_SAFE_INTEGER,
      unit: portionUnit(sourceLabel),
    };
    portions.set(fdcId, [...(portions.get(fdcId) ?? []), portion]);
  });

  let completeNutrientCount = 0;
  const compactFoods: CompactFood[] = [...foods.entries()]
    .sort(([left], [right]) => left - right)
    .map(([fdcId, name]) => {
      const values = nutrients.get(fdcId);
      if (
        values?.calories === undefined ||
        values.carbohydratesGrams === undefined ||
        values.proteinGrams === undefined ||
        values.fatGrams === undefined
      ) {
        throw new Error(`Food ${fdcId} is missing a required macronutrient.`);
      }
      if (values.fiberGrams !== undefined) completeNutrientCount += 1;

      const foodPortions = [...(portions.get(fdcId) ?? [])].sort(
        (left, right) => left.seq - right.seq,
      );
      const defaultPortion = foodPortions[0] ?? {
        amount: 100,
        grams: 100,
        label: '100 g',
        seq: 1,
        unit: 'gram' as const,
      };
      const gramsByUnit = new Map<PortionUnit, SourcePortion>();
      for (const portion of foodPortions) {
        const current = gramsByUnit.get(portion.unit);
        if (!current || portionPreference(portion) < portionPreference(current)) {
          gramsByUnit.set(portion.unit, portion);
        }
      }
      const compactUnitWeights = [...gramsByUnit.entries()]
        .map(([unit, portion]) => [
          UNIT_CODES[unit],
          rounded(portion.grams / portion.amount),
        ] as const)
        .sort(([left], [right]) => left - right);

      return [
        fdcId,
        name,
        defaultPortion.amount,
        UNIT_CODES[defaultPortion.unit],
        defaultPortion.label,
        rounded(defaultPortion.grams),
        compactUnitWeights,
        values.calories,
        values.carbohydratesGrams,
        values.proteinGrams,
        values.fatGrams,
        values.fiberGrams ?? null,
      ] as const;
    });

  const output = {
    schemaVersion: 1,
    source: {
      id: 'usda-fdc-sr-legacy-local-v2',
      label: 'USDA FoodData Central SR Legacy, compact offline reference',
      release: 'April 2018',
      sourceUrl: 'https://fdc.nal.usda.gov/',
      downloadUrl: SOURCE_DOWNLOAD,
      sha256: SOURCE_SHA256,
    },
    foodCount: compactFoods.length,
    completeNutrientCount,
    foods: compactFoods,
  } as const;

  await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
  process.stdout.write(
    `Wrote ${compactFoods.length} foods (${completeNutrientCount} with fiber) to ${outputPath}\n`,
  );
}

void main();
