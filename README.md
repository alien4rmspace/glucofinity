# GlucoFinity

GlucoFinity is a polished landing page and interactive product prototype for an interdisciplinary university healthcare technology project. It explores how glucose readings could be viewed alongside meals, sleep, activity, medication, and other daily context to help users review personal patterns.

The current project is educational and informational. It is not a medical device, a source of medical advice, or a clinically validated product.

## Technology stack

- Next.js App Router with TypeScript
- React 19
- Tailwind CSS 4
- Lucide React icons
- Recharts data visualizations
- Static export for GitHub Pages
- Deterministic local mock data

No database, authentication, paid API, or external AI service is used.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Validate and build

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

The production build is exported to `out/`. To preview that exact static output:

```bash
npm run preview
```

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` builds and publishes the static export whenever changes are pushed to `main`.

In the GitHub repository settings, choose **Settings > Pages > Build and deployment > GitHub Actions** as the publishing source. The site will then be available at `https://alien4rmspace.github.io/glucofinity/` after the workflow completes.

## Project structure

```text
app/                    App Router page, layout, metadata, and global styles
components/             Navigation, footer, shared UI, and page sections
components/charts/      Client-safe Recharts visualizations
components/dashboard/   Interactive dashboard preview
data/                   Deterministic fictional glucose and product data
types/                  Shared TypeScript data models
public/                 Static assets, including the social preview image
tests/                  Static-export smoke tests
.github/workflows/      GitHub Pages build and deployment workflow
```

## Mock data

All glucose readings, meal details, sleep duration, exercise events, medication events, confidence values, and generated insights are fictional. The values are fixed in `data/mock-data.ts`, so charts render consistently on every visit and do not imply a connection to a real sensor or person.

The target range shown in charts is demonstration UI context, not a personalized recommendation.

## Prototype features

The page demonstrates these concepts without claiming they are completed production capabilities:

- A 24-hour glucose dashboard with target-range context
- Meal-photo recognition estimates and editable carbohydrate values
- A post-meal glucose response view
- A meal-centered response window with baseline, peak, rise, timing, 1-hour and 2-hour values, incremental area, return-near-baseline timing, and explicit data-quality states
- Stable mock-source provenance and visible gaps when surrounding readings are incomplete
- AI-assisted pattern summaries with cautious correlation language
- Planned CGM and Apple Health integrations
- Planned time-series, XGBoost-style, vision-language, and local language-model responsibilities
- Privacy-focused product principles

The site does not currently connect to CGM hardware, Apple Health, nutrition databases, medication systems, or AI models. It does not predict real glucose responses or store personal health information.

## Future development

1. Conduct user research with patients and licensed healthcare professionals.
2. Define consent, data minimization, access, retention, and deletion requirements.
3. Prototype secure, permission-based CGM and Apple Health import flows.
4. Add authenticated user accounts and encrypted storage only after a privacy and threat-model review.
5. Evaluate meal-estimation and pattern-analysis models against representative datasets.
6. Perform accessibility, usability, clinical-safety, privacy, and security validation.
7. Determine regulatory obligations before positioning any version for healthcare decision support.

## Safety

GlucoFinity is not a substitute for a licensed healthcare professional. AI-generated summaries may be incomplete or inaccurate, and nutrition values and glucose predictions are estimates. Users should not change medication or insulin decisions solely from information shown by this prototype.

## License

This repository is licensed under the GNU General Public License v3.0. See `LICENSE` for the full terms.
