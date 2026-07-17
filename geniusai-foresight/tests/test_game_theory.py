import unittest

from foresight.game_theory import (
    cooperation_discount_threshold,
    correlated_equilibrium_residual,
    epsilon_nash,
    expected_payoffs,
    mixed_nash_2x2,
    nash_bargaining_solution,
    pareto_efficient_outcomes,
    pure_nash_equilibria,
    pure_security_levels,
    qre_logit_2x2,
    regret_matching,
    replicator_step,
    shapley_value,
    stackelberg_pure,
    strictly_dominated_actions,
)

PD=(((3,3),(0,5)),((5,0),(1,1)))
MATCHING=(((1,-1),(-1,1)),((-1,1),(1,-1)))

class GameTheoryTests(unittest.TestCase):
    def test_prisoners_dilemma(self):
        self.assertEqual(pure_nash_equilibria(PD),[(1,1)])
        self.assertEqual(strictly_dominated_actions(PD),{"row":[0],"column":[0]})
        self.assertNotIn((1,1),pareto_efficient_outcomes(PD))

    def test_matching_pennies_mixed_equilibrium(self):
        result=mixed_nash_2x2(MATCHING)
        self.assertAlmostEqual(result["row_strategy"][0],0.5)
        self.assertAlmostEqual(result["col_strategy"][0],0.5)
        self.assertLess(result["epsilon"],1e-9)
        self.assertLess(epsilon_nash(MATCHING,[0.5,0.5],[0.5,0.5]),1e-9)

    def test_correlated_equilibrium_uniform_matching(self):
        self.assertLess(correlated_equilibrium_residual(MATCHING,((0.25,0.25),(0.25,0.25))),1e-12)

    def test_shapley_simple_majority(self):
        players=["a","b","c"]
        characteristic={frozenset():0.0}
        for coalition_size in range(1,4):
            from itertools import combinations
            for coalition in combinations(players,coalition_size):
                characteristic[frozenset(coalition)]=1.0 if coalition_size>=2 else 0.0
        value=shapley_value(players,characteristic)
        for player in players: self.assertAlmostEqual(value[player],1/3)
        self.assertAlmostEqual(sum(value.values()),1.0)

    def test_exact_shapley_has_resource_guard(self):
        players=[f"p{i}" for i in range(17)]
        with self.assertRaises(ValueError):
            shapley_value(players,{frozenset():0.0})

    def test_nash_bargaining(self):
        result=nash_bargaining_solution([(8,1),(5,5),(1,8),(0,0)],(0,0))
        self.assertEqual(result["allocation"],(5.0,5.0))
        self.assertEqual(result["nash_product"],25.0)

    def test_stackelberg_and_security(self):
        game=(((4,4),(1,5)),((5,1),(2,2)))
        result=stackelberg_pure(game,leader=0,tie_break="strong")
        self.assertEqual(result["outcome"],(1,1))
        self.assertIn("row",pure_security_levels(game))

    def test_qre_and_regret(self):
        qre=qre_logit_2x2(MATCHING,1.0,1.0)
        self.assertTrue(qre["converged"])
        self.assertAlmostEqual(sum(qre["row_strategy"]),1.0)
        rm=regret_matching(MATCHING,iterations=5000,seed=11)
        self.assertLess(rm["epsilon"],0.1)

    def test_qre_uses_true_fixed_point_residual(self):
        result=qre_logit_2x2(PD,10.0,10.0,iterations=3,tolerance=1e-10,damping=1e-12)
        self.assertFalse(result["converged"])
        self.assertGreater(result["residual"],0.1)

    def test_mixed_strategy_must_belong_to_simplex(self):
        with self.assertRaises(ValueError):
            expected_payoffs(MATCHING,[1.2,-0.2],[0.5,0.5])

    def test_repeated_and_replicator(self):
        self.assertAlmostEqual(cooperation_discount_threshold(3,5,1),0.5)
        frequencies=replicator_step([0.5,0.5],[[3,0],[5,1]],dt=0.1,mutation=0.01)
        self.assertAlmostEqual(sum(frequencies),1.0)
        self.assertTrue(all(0<=x<=1 for x in frequencies))

if __name__=="__main__": unittest.main()
