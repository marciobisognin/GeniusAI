"""Transparent small-game solvers used by the Foresight scientific kernel.

The module deliberately labels its computational boundary: exact methods target
small finite games; iterative methods return diagnostics instead of pretending
that convergence is guaranteed for arbitrary geopolitical games.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from itertools import combinations, product
from math import exp, factorial, isfinite
import random
from typing import Any

Number = int | float
PayoffCell = Sequence[Number]
PayoffTensor = Sequence[Sequence[PayoffCell]]


def _validate_tensor(payoffs: PayoffTensor, players: int = 2) -> tuple[int, int]:
    if not payoffs or not payoffs[0]:
        raise ValueError("payoff tensor vazio")
    rows, cols = len(payoffs), len(payoffs[0])
    for row in payoffs:
        if len(row) != cols:
            raise ValueError("matriz de payoff irregular")
        for cell in row:
            if len(cell) != players or not all(isfinite(float(x)) for x in cell):
                raise ValueError("cada célula precisa de payoffs finitos para todos os jogadores")
    return rows, cols


def expected_payoffs(payoffs: PayoffTensor, row_strategy: Sequence[float], col_strategy: Sequence[float]) -> tuple[float, float]:
    rows, cols = _validate_tensor(payoffs)
    if len(row_strategy) != rows or len(col_strategy) != cols:
        raise ValueError("dimensão da estratégia incompatível")
    if abs(sum(row_strategy) - 1) > 1e-9 or abs(sum(col_strategy) - 1) > 1e-9:
        raise ValueError("estratégias precisam somar 1")
    if any(not isfinite(float(p)) or p < 0 or p > 1 for p in (*row_strategy, *col_strategy)):
        raise ValueError("estratégias precisam pertencer ao simplex")
    u0 = u1 = 0.0
    for i, j in product(range(rows), range(cols)):
        probability = row_strategy[i] * col_strategy[j]
        u0 += probability * float(payoffs[i][j][0])
        u1 += probability * float(payoffs[i][j][1])
    return u0, u1


def pure_nash_equilibria(payoffs: PayoffTensor, tolerance: float = 1e-12) -> list[tuple[int, int]]:
    """Enumerate pure Nash equilibria of a finite two-player game."""
    rows, cols = _validate_tensor(payoffs)
    equilibria: list[tuple[int, int]] = []
    for i, j in product(range(rows), range(cols)):
        row_payoff = float(payoffs[i][j][0])
        col_payoff = float(payoffs[i][j][1])
        row_best = max(float(payoffs[r][j][0]) for r in range(rows))
        col_best = max(float(payoffs[i][c][1]) for c in range(cols))
        if row_payoff >= row_best - tolerance and col_payoff >= col_best - tolerance:
            equilibria.append((i, j))
    return equilibria


def epsilon_nash(payoffs: PayoffTensor, row_strategy: Sequence[float], col_strategy: Sequence[float]) -> float:
    """Maximum unilateral gain (exploitability residual) of a mixed profile."""
    rows, cols = _validate_tensor(payoffs)
    current = expected_payoffs(payoffs, row_strategy, col_strategy)
    row_best = max(sum(col_strategy[j] * float(payoffs[i][j][0]) for j in range(cols)) for i in range(rows))
    col_best = max(sum(row_strategy[i] * float(payoffs[i][j][1]) for i in range(rows)) for j in range(cols))
    return max(0.0, row_best - current[0], col_best - current[1])


def mixed_nash_2x2(payoffs: PayoffTensor, tolerance: float = 1e-12) -> dict[str, Any]:
    """Solve an interior mixed Nash equilibrium for a non-degenerate 2x2 game."""
    rows, cols = _validate_tensor(payoffs)
    if (rows, cols) != (2, 2):
        raise ValueError("mixed_nash_2x2 exige jogo 2x2")
    a = [[float(payoffs[i][j][0]) for j in range(2)] for i in range(2)]
    b = [[float(payoffs[i][j][1]) for j in range(2)] for i in range(2)]
    den_q = a[0][0] - a[0][1] - a[1][0] + a[1][1]
    den_p = b[0][0] - b[0][1] - b[1][0] + b[1][1]
    if abs(den_q) <= tolerance or abs(den_p) <= tolerance:
        raise ValueError("jogo degenerado ou sem equilíbrio interior único")
    q = (a[1][1] - a[0][1]) / den_q
    p = (b[1][1] - b[1][0]) / den_p
    if not (-tolerance <= p <= 1 + tolerance and -tolerance <= q <= 1 + tolerance):
        raise ValueError("não existe equilíbrio misto interior")
    p, q = min(1.0, max(0.0, p)), min(1.0, max(0.0, q))
    row = [p, 1 - p]
    col = [q, 1 - q]
    return {"row_strategy": row, "col_strategy": col, "payoffs": expected_payoffs(payoffs, row, col), "epsilon": epsilon_nash(payoffs, row, col), "method": "analytic_2x2"}


def strictly_dominated_actions(payoffs: PayoffTensor) -> dict[str, list[int]]:
    rows, cols = _validate_tensor(payoffs)
    dominated_rows: list[int] = []
    dominated_cols: list[int] = []
    for a in range(rows):
        if any(all(float(payoffs[b][j][0]) > float(payoffs[a][j][0]) for j in range(cols)) for b in range(rows) if b != a):
            dominated_rows.append(a)
    for a in range(cols):
        if any(all(float(payoffs[i][b][1]) > float(payoffs[i][a][1]) for i in range(rows)) for b in range(cols) if b != a):
            dominated_cols.append(a)
    return {"row": dominated_rows, "column": dominated_cols}


def pareto_efficient_outcomes(payoffs: PayoffTensor) -> list[tuple[int, int]]:
    rows, cols = _validate_tensor(payoffs)
    outcomes = list(product(range(rows), range(cols)))
    efficient: list[tuple[int, int]] = []
    for candidate in outcomes:
        cu = payoffs[candidate[0]][candidate[1]]
        dominated = False
        for other in outcomes:
            if other == candidate:
                continue
            ou = payoffs[other[0]][other[1]]
            if all(float(ou[k]) >= float(cu[k]) for k in range(2)) and any(float(ou[k]) > float(cu[k]) for k in range(2)):
                dominated = True
                break
        if not dominated:
            efficient.append(candidate)
    return efficient


def pure_security_levels(payoffs: PayoffTensor) -> dict[str, Any]:
    rows, cols = _validate_tensor(payoffs)
    row_values = [min(float(payoffs[i][j][0]) for j in range(cols)) for i in range(rows)]
    col_values = [min(float(payoffs[i][j][1]) for i in range(rows)) for j in range(cols)]
    row_action = max(range(rows), key=row_values.__getitem__)
    col_action = max(range(cols), key=col_values.__getitem__)
    return {"row": {"action": row_action, "value": row_values[row_action]}, "column": {"action": col_action, "value": col_values[col_action]}, "method": "pure_maximin"}


def correlated_equilibrium_residual(payoffs: PayoffTensor, distribution: Sequence[Sequence[float]]) -> float:
    """Return maximum violated CE incentive constraint (0 means valid)."""
    rows, cols = _validate_tensor(payoffs)
    if len(distribution) != rows or any(len(r) != cols for r in distribution):
        raise ValueError("distribuição CE com dimensão incompatível")
    flat = [float(distribution[i][j]) for i, j in product(range(rows), range(cols))]
    if any(p < -1e-12 for p in flat) or abs(sum(flat) - 1) > 1e-9:
        raise ValueError("distribuição precisa ser não negativa e somar 1")
    max_violation = 0.0
    for recommended in range(rows):
        for deviation in range(rows):
            if recommended == deviation:
                continue
            lhs = sum(distribution[recommended][j] * (float(payoffs[recommended][j][0]) - float(payoffs[deviation][j][0])) for j in range(cols))
            max_violation = max(max_violation, -lhs)
    for recommended in range(cols):
        for deviation in range(cols):
            if recommended == deviation:
                continue
            lhs = sum(distribution[i][recommended] * (float(payoffs[i][recommended][1]) - float(payoffs[i][deviation][1])) for i in range(rows))
            max_violation = max(max_violation, -lhs)
    return max(0.0, max_violation)


def nash_bargaining_solution(feasible: Sequence[Sequence[float]], disagreement: Sequence[float], weights: Sequence[float] | None = None) -> dict[str, Any]:
    if not feasible:
        raise ValueError("conjunto viável vazio")
    players = len(disagreement)
    weights = list(weights or [1.0] * players)
    if len(weights) != players or any(w <= 0 for w in weights):
        raise ValueError("pesos inválidos")
    best_point: tuple[float, ...] | None = None
    best_log = float("-inf")
    for point_raw in feasible:
        point = tuple(float(x) for x in point_raw)
        if len(point) != players:
            raise ValueError("dimensão inconsistente no conjunto viável")
        gains = [point[i] - float(disagreement[i]) for i in range(players)]
        if any(g < 0 for g in gains):
            continue
        # Zero gain is valid but gives zero Nash product.
        score = sum(weights[i] * (-1e300 if gains[i] == 0 else __import__('math').log(gains[i])) for i in range(players))
        if score > best_log:
            best_log, best_point = score, point
    if best_point is None:
        raise ValueError("nenhum ponto individualmente racional")
    product_value = 1.0
    for i in range(players):
        product_value *= (best_point[i] - float(disagreement[i])) ** weights[i]
    return {"allocation": best_point, "nash_product": product_value, "method": "finite_feasible_enumeration"}


def shapley_value(players: Sequence[str], characteristic: Mapping[frozenset[str], float], samples: int | None = None, seed: int = 0) -> dict[str, float]:
    """Compute exact Shapley value, or permutation-sampling estimate."""
    p = tuple(players)
    if len(set(p)) != len(p) or not p:
        raise ValueError("players precisam ser únicos e não vazios")
    def value(coalition: set[str] | frozenset[str]) -> float:
        return float(characteristic.get(frozenset(coalition), 0.0))
    totals = {i: 0.0 for i in p}
    if samples is None:
        if len(p) > 16:
            raise ValueError("Shapley exato limitado a 16 jogadores; informe samples")
        n = len(p)
        for i in p:
            others = [x for x in p if x != i]
            for size in range(n):
                coefficient = factorial(size) * factorial(n - size - 1) / factorial(n)
                for subset in combinations(others, size):
                    s = set(subset)
                    totals[i] += coefficient * (value(s | {i}) - value(s))
        return totals
    if samples < 1:
        raise ValueError("samples deve ser positivo")
    # A seeded non-cryptographic PRNG is required for reproducible simulation.
    rng = random.Random(seed)  # nosec B311
    for _ in range(samples):
        order = list(p)
        rng.shuffle(order)
        coalition: set[str] = set()
        for i in order:
            before = value(coalition)
            coalition.add(i)
            totals[i] += value(coalition) - before
    return {i: totals[i] / samples for i in p}


def stackelberg_pure(payoffs: PayoffTensor, leader: int = 0, tie_break: str = "strong") -> dict[str, Any]:
    """Solve finite pure commitment with strong/weak follower tie-breaking."""
    rows, cols = _validate_tensor(payoffs)
    if leader not in (0, 1) or tie_break not in ("strong", "weak"):
        raise ValueError("parâmetros Stackelberg inválidos")
    candidates: list[dict[str, Any]] = []
    leader_actions = range(rows if leader == 0 else cols)
    for la in leader_actions:
        if leader == 0:
            follower_values = [float(payoffs[la][j][1]) for j in range(cols)]
            best = max(follower_values)
            responses = [j for j, v in enumerate(follower_values) if abs(v - best) <= 1e-12]
            chosen = (max if tie_break == "strong" else min)(responses, key=lambda j: float(payoffs[la][j][0]))
            outcome = (la, chosen)
        else:
            follower_values = [float(payoffs[i][la][0]) for i in range(rows)]
            best = max(follower_values)
            responses = [i for i, v in enumerate(follower_values) if abs(v - best) <= 1e-12]
            chosen = (max if tie_break == "strong" else min)(responses, key=lambda i: float(payoffs[i][la][1]))
            outcome = (chosen, la)
        candidates.append({"leader_action": la, "follower_action": chosen, "outcome": outcome, "leader_payoff": float(payoffs[outcome[0]][outcome[1]][leader]), "follower_payoff": float(payoffs[outcome[0]][outcome[1]][1-leader])})
    return max(candidates, key=lambda x: x["leader_payoff"]) | {"method": f"pure_stackelberg_{tie_break}"}


def qre_logit_2x2(payoffs: PayoffTensor, lambda_row: float = 1.0, lambda_col: float = 1.0, iterations: int = 1000, tolerance: float = 1e-10, damping: float = 0.5) -> dict[str, Any]:
    rows, cols = _validate_tensor(payoffs)
    numeric = (lambda_row, lambda_col, tolerance, damping)
    if (rows, cols) != (2, 2) or not all(isfinite(float(x)) for x in numeric):
        raise ValueError("parâmetros QRE inválidos")
    if min(lambda_row, lambda_col) < 0 or not 0 < damping <= 1 or not 0 < tolerance < 1:
        raise ValueError("parâmetros QRE inválidos")
    if not 1 <= iterations <= 1_000_000:
        raise ValueError("iterations deve estar entre 1 e 1000000")

    def softmax(values: Sequence[float], lam: float) -> list[float]:
        scaled = [lam * v for v in values]
        maximum = max(scaled)
        exps = [exp(v - maximum) for v in scaled]
        total = sum(exps)
        return [value / total for value in exps]

    def response(row_strategy: Sequence[float], col_strategy: Sequence[float]) -> tuple[list[float], list[float]]:
        row_u = [sum(col_strategy[j] * float(payoffs[i][j][0]) for j in range(2)) for i in range(2)]
        col_u = [sum(row_strategy[i] * float(payoffs[i][j][1]) for i in range(2)) for j in range(2)]
        return softmax(row_u, lambda_row), softmax(col_u, lambda_col)

    row = [0.5, 0.5]
    col = [0.5, 0.5]
    converged = False
    fixed_residual = float("inf")
    step = 0
    for step in range(1, iterations + 1):
        best_row, best_col = response(row, col)
        fixed_residual = max(
            max(abs(best_row[i] - row[i]) for i in range(2)),
            max(abs(best_col[i] - col[i]) for i in range(2)),
        )
        if fixed_residual <= tolerance:
            converged = True
            break
        row = [(1 - damping) * row[i] + damping * best_row[i] for i in range(2)]
        col = [(1 - damping) * col[i] + damping * best_col[i] for i in range(2)]
    best_row, best_col = response(row, col)
    fixed_residual = max(
        max(abs(best_row[i] - row[i]) for i in range(2)),
        max(abs(best_col[i] - col[i]) for i in range(2)),
    )
    converged = fixed_residual <= tolerance
    return {"row_strategy": row, "col_strategy": col, "iterations": step, "converged": converged, "residual": fixed_residual, "method": "logit_qre_fixed_point"}


def regret_matching(payoffs: PayoffTensor, iterations: int = 5000, seed: int = 0) -> dict[str, Any]:
    rows, cols = _validate_tensor(payoffs)
    if not 1 <= iterations <= 1_000_000:
        raise ValueError("iterations deve estar entre 1 e 1000000")
    # A seeded non-cryptographic PRNG is required for reproducible simulation.
    rng = random.Random(seed)  # nosec B311
    regrets = [[0.0] * rows, [0.0] * cols]
    strategy_sum = [[0.0] * rows, [0.0] * cols]
    def strategy(values: Sequence[float]) -> list[float]:
        positive = [max(0.0, x) for x in values]
        total = sum(positive)
        return [x / total for x in positive] if total > 0 else [1.0 / len(values)] * len(values)
    def draw(probabilities: Sequence[float]) -> int:
        x, cumulative = rng.random(), 0.0
        for idx, p in enumerate(probabilities):
            cumulative += p
            if x <= cumulative:
                return idx
        return len(probabilities)-1
    external_regret = [0.0, 0.0]
    for _ in range(iterations):
        s0, s1 = strategy(regrets[0]), strategy(regrets[1])
        for i, p in enumerate(s0): strategy_sum[0][i] += p
        for j, p in enumerate(s1): strategy_sum[1][j] += p
        a0, a1 = draw(s0), draw(s1)
        actual0, actual1 = map(float, payoffs[a0][a1])
        for i in range(rows): regrets[0][i] += float(payoffs[i][a1][0]) - actual0
        for j in range(cols): regrets[1][j] += float(payoffs[a0][j][1]) - actual1
        external_regret[0] = max(external_regret[0], max(regrets[0]))
        external_regret[1] = max(external_regret[1], max(regrets[1]))
    avg0 = [x / iterations for x in strategy_sum[0]]
    avg1 = [x / iterations for x in strategy_sum[1]]
    return {"row_strategy": avg0, "col_strategy": avg1, "average_external_regret": [max(0.0, max(regrets[0]))/iterations, max(0.0, max(regrets[1]))/iterations], "epsilon": epsilon_nash(payoffs, avg0, avg1), "method": "external_regret_matching"}


def cooperation_discount_threshold(reward: float, temptation: float, punishment: float) -> float:
    """Discount threshold for grim-trigger cooperation in a repeated PD."""
    if not temptation > reward > punishment:
        raise ValueError("requer temptation > reward > punishment")
    return (temptation - reward) / (temptation - punishment)


def replicator_step(frequencies: Sequence[float], payoff_matrix: Sequence[Sequence[float]], dt: float = 0.01, mutation: float = 0.0) -> list[float]:
    n = len(frequencies)
    if n == 0 or len(payoff_matrix) != n or any(len(row) != n for row in payoff_matrix):
        raise ValueError("dimensões replicadoras inválidas")
    if abs(sum(frequencies)-1) > 1e-9 or any(x < 0 for x in frequencies) or dt <= 0 or not 0 <= mutation < 1:
        raise ValueError("frequências/parâmetros inválidos")
    fitness = [sum(float(payoff_matrix[i][j]) * frequencies[j] for j in range(n)) for i in range(n)]
    mean = sum(frequencies[i] * fitness[i] for i in range(n))
    updated = [max(0.0, frequencies[i] + dt * frequencies[i] * (fitness[i] - mean)) for i in range(n)]
    if mutation:
        updated = [(1-mutation)*x + mutation/n for x in updated]
    total = sum(updated)
    return [x/total for x in updated]


def markov_game_rollout(initial_state: str, policies: Mapping[str, Callable[[str, random.Random], str]], transition: Callable[[str, Mapping[str, str], random.Random], tuple[str, Mapping[str, float]]], horizon: int, seed: int = 0, discount: float = 0.95) -> dict[str, Any]:
    if not 1 <= horizon <= 1_000_000 or not 0 < discount <= 1 or not policies:
        raise ValueError("parâmetros de rollout inválidos ou budget excedido")
    # A seeded non-cryptographic PRNG is required for reproducible simulation.
    rng = random.Random(seed)  # nosec B311
    state = initial_state
    returns = {actor: 0.0 for actor in policies}
    trace: list[dict[str, Any]] = []
    for t in range(horizon):
        actions = {actor: policy(state, rng) for actor, policy in policies.items()}
        next_state, rewards = transition(state, actions, rng)
        for actor in policies:
            returns[actor] += (discount ** t) * float(rewards.get(actor, 0.0))
        trace.append({"t": t, "state": state, "actions": actions, "next_state": next_state, "rewards": dict(rewards)})
        state = next_state
    return {"final_state": state, "discounted_returns": returns, "trace": trace, "method": "seeded_markov_rollout"}
