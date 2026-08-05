import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exportedPage = new URL("../out/index.html", import.meta.url);
const exportedDemoPage = new URL("../out/demo/index.html", import.meta.url);

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
  assert.match(html, /https:\/\/alien4rmspace\.github\.io\/glucofinity/);
  assert.match(html, /\/glucofinity\/_next\/static\//);
  assert.match(html, /\/glucofinity\/favicon\.svg/);
  assert.match(html, /glucofinity-lockup-transparent\.[a-z0-9_]+\.png/);
  assert.match(html, /glucofinity-mark-transparent\.[a-z0-9_]+\.png/);
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

test("exports the dedicated interactive demo route", async () => {
  const [homeHtml, demoHtml] = await Promise.all([
    readExport(),
    readFile(exportedDemoPage, "utf8"),
  ]);

  assert.match(homeHtml, /href="\/glucofinity\/demo\/"/);
  assert.match(demoHtml, /<title>Interactive Demo \| GlucoFinity<\/title>/i);
  assert.match(demoHtml, /Interactive educational prototype/);
  assert.match(demoHtml, /Your fictional day at a glance/);
  assert.match(demoHtml, /All readings, meals, calculations, and observations are fictional/i);
  assert.match(demoHtml, /Not for diagnosis, treatment, medication, or insulin decisions/i);
  assert.doesNotMatch(demoHtml, /connected to a real sensor/i);
});
