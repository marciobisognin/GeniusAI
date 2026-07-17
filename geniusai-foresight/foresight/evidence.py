"""Revision-aware bitemporal evidence ledger with strict as-of controls."""
from __future__ import annotations

from hashlib import sha256
import json
from typing import Iterable

from .models import EvidenceRecord, parse_time


class FutureLeakageError(ValueError):
    """Raised when supplied evidence was unavailable at the simulation cutoff."""


class EvidenceLedger:
    def __init__(self, records: Iterable[EvidenceRecord] = ()) -> None:
        self._records: dict[tuple[str, str], EvidenceRecord] = {}
        for record in records:
            self.add(record)

    def add(self, record: EvidenceRecord) -> None:
        record.validate()
        key = (record.evidence_id, record.revision_id)
        if key in self._records:
            raise ValueError(f"evidência/revisão duplicada: {record.evidence_id}@{record.revision_id}")
        self._records[key] = record

    def snapshot(self, cutoff: str, strict: bool = True) -> list[EvidenceRecord]:
        cutoff_time = parse_time(cutoff)
        leaked: list[str] = []
        candidates: dict[str, list[EvidenceRecord]] = {}
        for record in self._records.values():
            release = parse_time(record.release_time)
            captured = parse_time(record.captured_time or record.release_time)
            if release > cutoff_time or captured > cutoff_time:
                leaked.append(f"{record.evidence_id}@{record.revision_id}")
                continue
            valid_from = parse_time(record.valid_from or record.event_time)
            valid_to = parse_time(record.valid_to) if record.valid_to else None
            if valid_from <= cutoff_time and (valid_to is None or cutoff_time < valid_to):
                candidates.setdefault(record.evidence_id, []).append(record)
        if strict and leaked:
            raise FutureLeakageError(f"evidências posteriores ao cutoff: {', '.join(sorted(leaked))}")
        selected: list[EvidenceRecord] = []
        for evidence_id, revisions in candidates.items():
            selected.append(max(revisions, key=lambda r: (parse_time(r.release_time), parse_time(r.captured_time or r.release_time), r.revision_id)))
        return sorted(selected, key=lambda item: (item.release_time, item.evidence_id, item.revision_id))

    def snapshot_hash(self, cutoff: str, strict: bool = False) -> str:
        payload = [record.__dict__ for record in self.snapshot(cutoff, strict=strict)]
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        return sha256(encoded).hexdigest()

    def parameter_effects(self, cutoff: str) -> dict[str, dict[str, float]]:
        """Aggregate declared, provenance-linked variable effects from the active vintage.

        Effects are data contracts, not inferred from prose. Each active record may carry
        metadata.variable_effects = {variable: {annual_drift_delta, shock_multiplier}}.
        Reliability and directness weight the effect to prevent unsupported prose from
        mutating the quantitative state.
        """
        effects: dict[str, dict[str, float]] = {}
        for record in self.snapshot(cutoff, strict=False):
            declared = record.metadata.get("variable_effects", {})
            if not isinstance(declared, dict):
                continue
            weight = record.reliability * record.directness
            for variable, values in declared.items():
                if not isinstance(values, dict):
                    continue
                target = effects.setdefault(variable, {"annual_drift_delta": 0.0, "shock_multiplier": 1.0})
                drift = float(values.get("annual_drift_delta", 0.0))
                multiplier = float(values.get("shock_multiplier", 1.0))
                target["annual_drift_delta"] += weight * drift
                target["shock_multiplier"] *= 1.0 + weight * (multiplier - 1.0)
        return effects

    def quality_summary(self, cutoff: str) -> dict[str, float | int]:
        records = self.snapshot(cutoff, strict=False)
        if not records:
            return {"records": 0, "mean_reliability": 0.0, "mean_directness": 0.0, "independent_groups": 0}
        return {
            "records": len(records),
            "mean_reliability": sum(r.reliability for r in records) / len(records),
            "mean_directness": sum(r.directness for r in records) / len(records),
            "independent_groups": len({r.independent_group for r in records}),
        }

    def to_json(self, cutoff: str) -> list[dict[str, object]]:
        return [record.__dict__.copy() for record in self.snapshot(cutoff, strict=False)]
