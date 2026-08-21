import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from glucofinity_ml.dataset import chronological_split, eligible_examples


class DatasetTests(unittest.TestCase):
    def test_filters_ineligible_or_limited_examples(self):
        payload = {
            "examples": [
                {"mealId": "good", "eligibleForTraining": True, "dataQuality": "good"},
                {"mealId": "limited", "eligibleForTraining": True, "dataQuality": "limited"},
                {"mealId": "excluded", "eligibleForTraining": False, "dataQuality": "good"},
            ]
        }
        self.assertEqual([item["mealId"] for item in eligible_examples(payload)], ["good"])

    def test_splits_in_strict_chronological_order(self):
        examples = [
            {"occurredAt": f"2026-01-{day:02d}T12:00:00Z", "value": day}
            for day in range(10, 0, -1)
        ]
        split = chronological_split(examples)
        self.assertEqual([item["value"] for item in split["training"]], list(range(1, 8)))
        self.assertEqual([item["value"] for item in split["validation"]], [8])
        self.assertEqual([item["value"] for item in split["testing"]], [9, 10])

    def test_rejects_an_invalid_example_timestamp(self):
        with self.assertRaisesRegex(ValueError, "valid occurredAt"):
            chronological_split(
                [
                    {"occurredAt": "2026-01-01T12:00:00Z"},
                    {"occurredAt": "not-a-date"},
                    {"occurredAt": "2026-01-03T12:00:00Z"},
                ]
            )


if __name__ == "__main__":
    unittest.main()
