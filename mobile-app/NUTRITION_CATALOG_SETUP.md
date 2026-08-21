# Offline nutrition catalog

GlucoFinity uses SQLite for local USDA FoodData Central lookup. Nutrition values are
prototype estimates that remain reviewable and editable; the catalog does not provide
medical or treatment guidance.

## Included core catalog

`assets/data/nutrition-core.db` contains 13,591 estimate-ready generic foods from the
April 2026 release: 367 Foundation, 7,793 SR Legacy, and 5,431 FNDDS records. It stores
only the fields the app uses: FoodData Central ID, searchable name aliases, household
portion weights, calories, carbohydrates, protein, fat, and fiber. Missing fiber remains
`NULL`. Another 217 generic source records are reported but omitted because they lack one
or more macronutrients required by the estimator.

Regenerate the checked-in database after changing the full source release or schema:

```bash
npm run generate:nutrition-core -- <extracted-full-csv-directory> assets/data/nutrition-core.db 2026-04
```

The generator runs `PRAGMA integrity_check` and verifies the expected food count before
finishing. Native iOS and Android builds import this database once and query it on disk.
The web demo and Node tests retain the deterministic in-memory fallback.

## Downloaded branded catalog

The branded catalog is deliberately separate so the app can open immediately without
bundling almost two million product records. It supports both branded meal-estimation
search and direct UPC/GTIN ingredient review. The verified April 2026 artifact is hosted
as a versioned, checksum-pinned public GitHub Release asset and configured in the GlucoFinity EAS
development, preview, and production environments.

1. Download and extract the current full FoodData Central CSV archive.
2. Generate the compact branded SQLite artifact:

```bash
npm run generate:nutrition-branded -- <extracted-csv-directory> <output.db> <catalog-version>
```

The generator prints the estimate-ready food count, unique scannable product count, byte
size, and MD5. Records missing calories, carbohydrates, protein, or fat are reported and
omitted from meal-estimation search because the app cannot calculate a complete estimate
from them. They can still appear in the barcode index when USDA supplies a valid GTIN/UPC.
Missing fiber is retained as `NULL` and remains unresolved.

The v2 product index stores only fields used by the scanner: canonical GTIN-14,
FoodData Central ID, product name, brand, manufacturer-submitted ingredient text, serving
label and weight, and available serving-level calories, carbohydrate, fiber, total sugar,
added sugar, protein, total fat, saturated fat, trans fat, and sodium. USDA's downloadable
catalog does not provide product images, so image URLs remain optional and the app reports
them unavailable. When a barcode has multiple USDA records, the generator keeps the row
with the latest publication date. Invalid check digits are reported and skipped. The
April 2026 v2 validation produced 1,818,766 estimate-ready foods and
430,282 unique valid barcode products from 1,999,950 source rows. Ingredient text was
available for 427,959 barcode products. Serving weight was available for 369,246 products;
363,551 had serving calories, 362,872 had carbohydrate, 348,700 had total sugar, 121,008
had added sugar, and 363,438 had sodium. Missing fields remain `NULL`. The integrity-checked
SQLite file is 602,537,984 bytes with MD5 `be68701d6da0b8b699c27aa52e2fdb7e`,
SHA-256 `316bc9b1c9ae288bf0e694b4e84a4c80c8ccbef08114f9131d02cfc915452b51`,
and catalog version `2026-04-products-v2`.

3. Host the versioned `.db` file over HTTPS. The current artifact is available from the
[`usda-catalog-2026-04-products-v2` release](https://github.com/alien4rmspace/glucofinity/releases/tag/usda-catalog-2026-04-products-v2).
Configure any local or alternate native build with all four values:

```text
EXPO_PUBLIC_FOOD_CATALOG_URL=https://github.com/alien4rmspace/glucofinity/releases/download/usda-catalog-2026-04-products-v2/nutrition-branded-products-v2.db
EXPO_PUBLIC_FOOD_CATALOG_VERSION=2026-04-products-v2
EXPO_PUBLIC_FOOD_CATALOG_BYTES=602537984
EXPO_PUBLIC_FOOD_CATALOG_MD5=be68701d6da0b8b699c27aa52e2fdb7e
```

At app launch, the core catalog opens first. The branded file then downloads into the
app's document storage through a native background transfer without requesting health
permissions. On iOS, the transfer can continue while the app is inactive or the phone is
locked; a user force-quit remains an operating-system interruption. GlucoFinity checks the MD5,
byte size, available device storage, catalog version, schema version, product-index
version, declared food and barcode counts, and SQLite integrity before making
the new file searchable. Settings shows the active Product catalog download percentage,
downloaded and total megabytes, and a separate verification state. Progress callbacks pause
while the app is inactive and refresh when it returns to the foreground; the native transfer
continues independently. A partial or invalid file is never activated.

These `EXPO_PUBLIC_` values are compiled into the JavaScript bundle. A build made before
the EAS variables were configured remains unconfigured and must be replaced by a new
development, preview, or production build. Local Metro development uses the matching,
gitignored `.env.local` file.

Food catalog files contain public USDA reference data only. Saved meals, transcripts,
Apple Health records, and Health Connect records are not written into either catalog.
Barcode camera frames are processed by the native scanner and are not saved. Ingredient
reviews run locally and are not written to the meal timeline.

## Ingredient-review rubric

The scanner applies a deterministic, general-information rubric to the USDA ingredient
text. It starts at 100 and applies the following visible deductions:

- 20 points when an added sweetener appears among the first three top-level ingredients,
  or 10 points when one appears later;
- 30 points when the text names a partially hydrogenated ingredient; and
- 10 points when the text names a certified color covered by the rule list.

Scores map to A (90-100), B (75-89), C (60-74), or D (below 60). Missing ingredient
text remains **Not rated**. Every deduction and the unchanged USDA ingredient list appear
on the result screen. This narrow rubric does not determine overall healthfulness,
allergy safety, or suitability for glucose management. The current package label remains
the authoritative source.

## Search behavior

Queries favor curated generic aliases and exact generic matches before branded results.
Brand words are included in full-text search when a branded catalog is active. Only a
small candidate set is hydrated into JavaScript for portion calculation and review.
