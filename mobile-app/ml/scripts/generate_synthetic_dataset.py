"""Generate deterministic synthetic fixtures for pipeline testing only."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path


def generate(count: int = 90) -> dict:
    start = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    examples = []
    for index in range(count):
        occurred_at = start + timedelta(days=index)
        carbs = 25 + (index % 8) * 7
        protein = 12 + (index % 5) * 4
        fat = 8 + (index % 4) * 3
        baseline = 92 + (index % 7)
        exercise = 0 if index % 3 else 25
        rise = 12 + carbs * 0.72 + fat * 0.12 - exercise * 0.18 + math.sin(index) * 2
        examples.append(
            {
                "exampleId": f"synthetic-{index}:meal-prediction-features-v1",
                "mealId": f"synthetic-{index}",
                "occurredAt": occurred_at.isoformat().replace("+00:00", "Z"),
                "featureVersion": "meal-prediction-features-v1",
                "features": {
                    "carbohydratesGrams": carbs,
                    "proteinGrams": protein,
                    "fatGrams": fat,
                    "fiberGrams": 4 + index % 5,
                    "baselineGlucoseMgDl": baseline,
                    "recentGlucoseMeanMgDl": baseline - 1,
                    "recentGlucoseVariabilityMgDl": 3 + index % 4,
                    "hourOfDay": 12 + index % 7,
                    # Match JavaScript Date.getUTCDay(): Sunday = 0, Saturday = 6.
                    "dayOfWeek": (occurred_at.weekday() + 1) % 7,
                    "recentExerciseMinutes": exercise,
                },
                "labels": {
                    "glucoseRiseMgDl": round(rise, 2),
                    "peakGlucoseMgDl": round(baseline + rise, 2),
                    "timeToPeakMinutes": 45 + (index % 4) * 5,
                    "glucoseAt120MinutesMgDl": round(baseline + rise * 0.28, 2),
                    "incrementalAuc": round(rise * 82, 2),
                },
                "dataQuality": "good",
                "eligibleForTraining": True,
                "exclusionReasons": [],
                "glucoseSources": ["mock"],
            }
        )
    return {
        "schemaVersion": "meal-training-dataset-v1",
        "generatedAt": datetime(2026, 4, 1, tzinfo=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "dataOrigin": "synthetic-fixture",
        "examples": examples,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--count", type=int, default=90)
    args = parser.parse_args()
    args.output.write_text(json.dumps(generate(args.count), indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
