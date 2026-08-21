"""Offline ML infrastructure for GlucoFinity.

This package trains research/prototype models from explicitly exported datasets.
It is not imported by the React Native application.
"""

from .dataset import FEATURE_NAMES, chronological_split, eligible_examples
from .evaluation import regression_metrics

__all__ = [
    "FEATURE_NAMES",
    "chronological_split",
    "eligible_examples",
    "regression_metrics",
]
