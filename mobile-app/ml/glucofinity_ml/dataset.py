"""Dataset validation and leakage-resistant chronological splitting."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


FEATURE_NAMES = [
    "carbohydratesGrams",
    "proteinGrams",
    "fatGrams",
    "fiberGrams",
    "calories",
    "estimatedMealGrams",
    "baselineGlucoseMgDl",
    "recentGlucoseSlopeMgDlPerMinute",
    "recentGlucoseMeanMgDl",
    "recentGlucoseVariabilityMgDl",
    "minutesSincePreviousMeal",
    "hourOfDay",
    "dayOfWeek",
    "recentExerciseMinutes",
    "sleepDurationHours",
    "historicalSimilarMealResponseMgDl",
]


def load_dataset(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != "meal-training-dataset-v1":
        raise ValueError("Unsupported meal training dataset schema version.")
    if payload.get("dataOrigin") not in {"authorized-user-export", "synthetic-fixture"}:
        raise ValueError("Dataset must declare an authorized or synthetic origin.")
    if not isinstance(payload.get("examples"), list):
        raise ValueError("Dataset examples must be a list.")
    return payload


def eligible_examples(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        example
        for example in payload.get("examples", [])
        if example.get("eligibleForTraining") is True
        and example.get("dataQuality") == "good"
    ]


def chronological_split(
    examples: list[dict[str, Any]],
    training_ratio: float = 0.7,
    validation_ratio: float = 0.15,
    testing_ratio: float = 0.15,
) -> dict[str, list[dict[str, Any]]]:
    if len(examples) < 3:
        raise ValueError("At least three eligible examples are required.")
    if min(training_ratio, validation_ratio, testing_ratio) <= 0:
        raise ValueError("Split ratios must be positive.")
    if abs(training_ratio + validation_ratio + testing_ratio - 1.0) > 1e-9:
        raise ValueError("Split ratios must sum to 1.")
    def occurred_at(example: dict[str, Any]) -> datetime:
        value = example.get("occurredAt")
        if not isinstance(value, str):
            raise ValueError("Every example must have an occurredAt timestamp.")
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("Every example must have a valid occurredAt timestamp.") from error

    ordered = sorted(examples, key=occurred_at)
    training_end = min(len(ordered) - 2, max(1, int(len(ordered) * training_ratio)))
    validation_size = max(1, int(len(ordered) * validation_ratio))
    validation_end = min(len(ordered) - 1, training_end + validation_size)
    return {
        "training": ordered[:training_end],
        "validation": ordered[training_end:validation_end],
        "testing": ordered[validation_end:],
    }


def feature_matrix(examples: list[dict[str, Any]]):
    """Return NumPy features while preserving missing values as NaN, never zero."""
    import numpy as np

    return np.asarray(
        [
            [example.get("features", {}).get(name, np.nan) for name in FEATURE_NAMES]
            for example in examples
        ],
        dtype=float,
    )


def target_vector(examples: list[dict[str, Any]], target: str):
    import numpy as np

    selected = [example for example in examples if target in example.get("labels", {})]
    return selected, np.asarray(
        [example["labels"][target] for example in selected], dtype=float
    )
