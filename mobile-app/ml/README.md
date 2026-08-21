# GlucoFinity ML

This directory is an offline, reproducible training environment for a future
personalized meal-response model. It is deliberately separate from the Expo UI.

The first supported model family is one XGBoost regressor per response target.
Missing feature values remain missing (`NaN`) and are never silently converted to
zero. Eligible examples are sorted by meal time and split chronologically into
training, validation, and test partitions to reduce future-to-past leakage.

No real user dataset or trained model is committed. The synthetic generator exists
only to exercise the pipeline and cannot establish real-world or clinical model
performance.

## Environment

```bash
python -m venv .venv
.venv/Scripts/activate
python -m pip install -e ml
```

## Synthetic pipeline smoke test

```bash
python ml/scripts/generate_synthetic_dataset.py --output synthetic-dataset.json
python -m glucofinity_ml.training \
  --dataset synthetic-dataset.json \
  --config ml/config/meal_response_xgboost.json \
  --output model-output
```

Artifacts include a versioned model file per target and `model-registry.json`
with feature version, training sample count, data origin, and separate validation
and test metrics. Synthetic metrics must always be labeled synthetic.

## Tests without ML dependencies

```bash
set PYTHONPATH=ml
python -m unittest discover -s ml/tests -p "test_*.py"
```

The React Native app currently exposes a validated `MealResponsePredictor`
contract. Choosing a secure on-device or service inference runtime and importing an
evaluated model are intentionally deferred until authorized, representative data
exists.
