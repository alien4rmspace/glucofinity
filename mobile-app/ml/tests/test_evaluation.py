import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from glucofinity_ml.evaluation import regression_metrics


class EvaluationTests(unittest.TestCase):
    def test_calculates_regression_metrics(self):
        metrics = regression_metrics([10.0, 20.0, 30.0], [12.0, 18.0, 33.0])
        self.assertEqual(metrics["mae"], 2.333333)
        self.assertEqual(metrics["rmse"], 2.380476)
        self.assertEqual(metrics["rSquared"], 0.915)

    def test_does_not_invent_r_squared_for_constant_labels(self):
        metrics = regression_metrics([10.0, 10.0], [9.0, 11.0])
        self.assertIsNone(metrics["rSquared"])


if __name__ == "__main__":
    unittest.main()
