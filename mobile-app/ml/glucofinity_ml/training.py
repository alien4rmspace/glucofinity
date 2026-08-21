"""Train one XGBoost regressor per meal-response target."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .dataset import (
    chronological_split,
    eligible_examples,
    feature_matrix,
    load_dataset,
    target_vector,
)
from .evaluation import regression_metrics


def _evaluate(model: Any, examples: list[dict[str, Any]], target: str):
    selected, observed = target_vector(examples, target)
    if not selected:
        return None
    predicted = model.predict(feature_matrix(selected))
    return regression_metrics(observed.tolist(), predicted.tolist())


def train(dataset_path: Path, config_path: Path, output_dir: Path) -> dict[str, Any]:
    try:
        import numpy as np
        from xgboost import XGBRegressor
    except ImportError as error:
        raise RuntimeError(
            "Install the ml package dependencies before training: pip install -e ml"
        ) from error

    dataset = load_dataset(dataset_path)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    examples = eligible_examples(dataset)
    split_config = config["split"]
    splits = chronological_split(
        examples,
        split_config["training"],
        split_config["validation"],
        split_config["testing"],
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    trained_at = datetime.now(timezone.utc).isoformat()
    registry: dict[str, Any] = {
        "modelId": config["modelId"],
        "modelType": config["modelType"],
        "version": config["version"],
        "featureVersion": config["featureVersion"],
        "trainedAt": trained_at,
        "trainingSampleCount": len(splits["training"]),
        "dataOrigin": dataset["dataOrigin"],
        "targets": {},
    }

    for target in config["targets"]:
        training_examples, training_labels = target_vector(splits["training"], target)
        if len(training_examples) < config["minimumTrainingSamplesPerTarget"]:
            registry["targets"][target] = {
                "status": "not-trained",
                "reason": "insufficient-training-samples",
                "trainingSampleCount": len(training_examples),
            }
            continue
        parameters = {
            **config["xgboost"],
            "random_state": config["randomSeed"],
            "missing": np.nan,
        }
        model = XGBRegressor(**parameters)
        model.fit(feature_matrix(training_examples), training_labels)
        artifact_name = f"{config['modelId']}-{target}-{config['version']}.ubj"
        model.save_model(output_dir / artifact_name)
        registry["targets"][target] = {
            "status": "trained",
            "artifact": artifact_name,
            "trainingSampleCount": len(training_examples),
            "validationMetrics": _evaluate(model, splits["validation"], target),
            "testMetrics": _evaluate(model, splits["testing"], target),
        }

    registry_path = output_dir / "model-registry.json"
    registry_path.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    return registry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parents[1] / "config" / "meal_response_xgboost.json",
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    registry = train(args.dataset, args.config, args.output)
    print(json.dumps(registry, indent=2))


if __name__ == "__main__":
    main()
