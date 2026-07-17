import unittest

from foresight.actors import ActorClusterFactory, CountryProfiler
from foresight.evidence import EvidenceLedger, FutureLeakageError
from foresight.models import EvidenceRecord


def record(evidence_id,release):
    return EvidenceRecord(evidence_id=evidence_id,claim="claim",entity="actor",variable="x",event_time="2026-01-01T00:00:00Z",release_time=release,source_url="https://example.org/source",reliability=0.8,directness=0.7,independent_group="g1")

class EvidenceActorTests(unittest.TestCase):
    def test_as_of_rejects_future_leakage(self):
        ledger=EvidenceLedger([record("past","2026-01-02T00:00:00Z"),record("future","2027-01-01T00:00:00Z")])
        with self.assertRaises(FutureLeakageError): ledger.snapshot("2026-06-01T00:00:00Z",strict=True)
        self.assertEqual([item.evidence_id for item in ledger.snapshot("2026-06-01T00:00:00Z",strict=False)],["past"])

    def test_snapshot_hash_is_deterministic(self):
        ledger=EvidenceLedger([record("a","2026-01-02T00:00:00Z")])
        self.assertEqual(ledger.snapshot_hash("2026-06-01T00:00:00Z"),ledger.snapshot_hash("2026-06-01T00:00:00Z"))

    def test_dynamic_actor_cell(self):
        actor=CountryProfiler().build("brazil","Brasil","presidential_federal",{"trade":0.6,"stability":0.4})
        cell=ActorClusterFactory().build(actor,["economy","diplomacy","economy","unknown"])
        roles=[agent.role for agent in cell.specialists]
        self.assertEqual(cell.coordinator.role,"strategic-coordinator")
        self.assertEqual(roles.count("economy-finance"),1)
        self.assertIn("diplomacy-negotiation",roles)
        self.assertIn("contrarian-red-team",roles)
        self.assertIn("central_bank",actor.institutions)

if __name__=="__main__": unittest.main()
