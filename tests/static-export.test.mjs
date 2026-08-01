import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exportedPage = new URL("../out/index.html", import.meta.url);

async function readExport() {
  return readFile(exportedPage, "utf8");
}

test("exports the complete GlucoFinity prototype", async () => {
  const html = await readExport();

  assert.match(
    html,
    /<title>GlucoFinity \| Understand Your Glucose Patterns<\/title>/i,
  );
  assert.match(html, /Discover the possibilities within your glucose data\./);
  assert.match(html, /Fictional demonstration data/);
  assert.match(html, /id="features"/);
  assert.match(html, /id="how-it-works"/);
  assert.match(html, /id="insights"/);
  assert.match(html, /id="safety"/);
  assert.match(html, /educational and informational prototype/i);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
});

test("exports the required medical-safety language", async () => {
  const html = await readExport();

  assert.match(
    html,
    /not a substitute for a licensed healthcare professional/i,
  );
  assert.match(
    html,
    /Medication or insulin decisions should not be changed/i,
  );
  assert.match(
    html,
    /Nutrition values and glucose predictions are estimates/i,
  );
  assert.match(
    html,
    /rigorous validation, privacy protections, security controls, and regulatory review/i,
  );
  assert.match(
    html,
    /does not imply university endorsement, clinical evidence/i,
  );
});
