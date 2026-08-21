"""Small dependency-free regression metrics used by training and tests."""

from __future__ import annotations

import math
from collections.abc import Sequence


def regression_metrics(
    observed: Sequence[float], predicted: Sequence[float]
) -> dict[str, float | None]:
    if len(observed) != len(predicted) or not observed:
        raise ValueError("Observed and predicted values must have the same nonzero length.")
    errors = [prediction - actual for actual, prediction in zip(observed, predicted)]
    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = math.sqrt(sum(error**2 for error in errors) / len(errors))
    mean_observed = sum(observed) / len(observed)
    total_variance = sum((value - mean_observed) ** 2 for value in observed)
    residual_variance = sum(error**2 for error in errors)
    r_squared = None if total_variance == 0 else 1 - residual_variance / total_variance
    return {
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "rSquared": None if r_squared is None else round(r_squared, 6),
    }
