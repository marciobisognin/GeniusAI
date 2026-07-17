import unittest

from foresight.calibration import brier_score, brier_skill_score, log_score, reliability_bins


class CalibrationTests(unittest.TestCase):
    def test_brier_score_known_value(self):
        self.assertAlmostEqual(brier_score([0.9,0.2],[1,0]),0.025)

    def test_log_score_rewards_better_probabilities(self):
        good=log_score([0.9,0.1],[1,0])
        poor=log_score([0.6,0.4],[1,0])
        self.assertLess(good,poor)

    def test_brier_skill_against_climatology(self):
        model=[0.8,0.2,0.7,0.1]
        outcomes=[1,0,1,0]
        reference=[0.5]*4
        self.assertGreater(brier_skill_score(model,outcomes,reference),0)

    def test_reliability_bins(self):
        bins=reliability_bins([0.1,0.2,0.8,0.9],[0,0,1,1],bins=5)
        self.assertEqual(sum(item["count"] for item in bins),4)
        self.assertEqual(bins[0]["observed_frequency"],0.0)
        self.assertEqual(bins[-1]["observed_frequency"],1.0)

    def test_invalid_probabilities_rejected(self):
        with self.assertRaises(ValueError):
            brier_score([1.2],[1])
        with self.assertRaises(ValueError):
            reliability_bins([0.5],[1],bins=1)


if __name__=="__main__": unittest.main()
