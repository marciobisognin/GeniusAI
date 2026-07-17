"""Proper scoring rules and calibration diagnostics."""
from __future__ import annotations

from math import log
from typing import Sequence


def brier_score(probabilities: Sequence[float], outcomes: Sequence[int]) -> float:
    if len(probabilities) != len(outcomes) or not probabilities:
        raise ValueError("probabilities/outcomes precisam ter mesmo tamanho não vazio")
    if any(not 0 <= p <= 1 for p in probabilities) or any(y not in (0, 1) for y in outcomes):
        raise ValueError("probabilidades em [0,1] e outcomes binários")
    return sum((p-y)**2 for p, y in zip(probabilities, outcomes, strict=True))/len(outcomes)


def log_score(probabilities: Sequence[float], outcomes: Sequence[int], epsilon: float = 1e-15) -> float:
    if len(probabilities) != len(outcomes) or not probabilities:
        raise ValueError("probabilities/outcomes precisam ter mesmo tamanho não vazio")
    if not 0 < epsilon < 0.5:
        raise ValueError("epsilon inválido")
    total = 0.0
    for p, y in zip(probabilities, outcomes, strict=True):
        if not 0 <= p <= 1 or y not in (0, 1):
            raise ValueError("probabilidades em [0,1] e outcomes binários")
        p = min(1-epsilon, max(epsilon, p))
        total -= y*log(p)+(1-y)*log(1-p)
    return total/len(outcomes)


def brier_skill_score(probabilities: Sequence[float], outcomes: Sequence[int], reference: Sequence[float]) -> float:
    model = brier_score(probabilities, outcomes)
    baseline = brier_score(reference, outcomes)
    if baseline == 0:
        raise ValueError("baseline perfeito não permite BSS")
    return 1-model/baseline


def reliability_bins(probabilities: Sequence[float], outcomes: Sequence[int], bins: int = 10) -> list[dict[str, float | int]]:
    if bins < 2:
        raise ValueError("bins deve ser >=2")
    if len(probabilities) != len(outcomes):
        raise ValueError("tamanhos incompatíveis")
    groups: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for p, y in zip(probabilities, outcomes, strict=True):
        if not 0 <= p <= 1 or y not in (0, 1):
            raise ValueError("dados inválidos")
        index = min(bins-1, int(p*bins))
        groups[index].append((p, y))
    result=[]
    for index, group in enumerate(groups):
        if not group:
            continue
        result.append({"bin": index, "count": len(group), "mean_probability": sum(x[0] for x in group)/len(group), "observed_frequency": sum(x[1] for x in group)/len(group)})
    return result
