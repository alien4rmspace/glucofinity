# GlucoFinity Contributor Guide

## Product purpose

GlucoFinity is an educational university healthcare technology prototype. It explores how glucose readings and daily context could be organized into understandable, reviewable patterns. It does not diagnose, treat, prevent, or recommend changes for any condition.

## Design principles

- Prefer a calm, credible healthcare interface over generic AI branding.
- Keep the product name, demo data, charts, and safety context easy to scan.
- Use deep navy text, light neutral surfaces, and restrained blue, cyan, purple, green, and amber accents.
- Keep cards at an 8px radius, shadows subtle, motion minimal, and layouts responsive.
- Maintain semantic landmarks, keyboard access, visible focus states, reduced-motion support, and strong contrast.
- Make important content available without entrance animations or hidden interaction states.

## Medical-language constraints

- Describe all current data, predictions, nutrition values, and insights as fictional, estimated, planned, observed, or prototype content as appropriate.
- Use correlation language such as "was associated with," "may be related to," and "a repeated pattern was observed."
- Do not claim causation from sample observations.
- Do not describe GlucoFinity as diagnosing, treating, preventing, prescribing, or replacing professional care.
- Never recommend medication, insulin, dosage, or treatment changes.
- Keep the safety and limitations section visible and readable.

## Evidence and integration rules

- Never invent clinical evidence, studies, validation results, regulatory status, partnerships, endorsements, awards, or team members.
- Never present Apple Health, CGM, nutrition database, model, authentication, or storage integrations as complete until working code and documentation prove they are complete.
- Distinguish planned architecture from implemented behavior.
- Do not use real personal health data in examples, screenshots, tests, or fixtures.

## Coding conventions

- Use TypeScript with strict typing and deterministic data.
- Keep shared mock data in `data/` and shared models in `types/`.
- Keep charts inside client components and provide stable dimensions, target-range context, accessible labels, and tooltips.
- Prefer reusable section and UI components over an oversized page file.
- Use Lucide icons rather than custom inline SVG icons.
- Avoid unnecessary dependencies, random render-time values, external AI calls, and paid services.
- Preserve the Next.js static export and GitHub Pages deployment workflow.

## Required quality checks

Before completing a change:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

Also review desktop and mobile layouts, navigation targets, focus behavior, chart rendering, horizontal overflow, deterministic data, and all user-facing medical claims.
