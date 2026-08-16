"""Paridade entre o embedding em TypeScript e o porte em Python.

A fixture `embedding-parity.json` é gerada pelo lado TypeScript
(`npm run parity -w packages/learning`). Se as duas implementações divergirem,
um índice escrito por um motor fica ilegível para o outro — e este teste falha
antes que isso vire um bug silencioso de recuperação.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from hermes_plugin.embeddings import DIMENSIONS, embed_text, hash_token, tokenize  # noqa: E402

FIXTURE = Path(__file__).parent / "embedding-parity.json"


class EmbeddingParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_dimensions_match(self):
        self.assertEqual(self.fixture["dimensions"], DIMENSIONS)

    def test_every_case_produces_the_same_vector(self):
        for case in self.fixture["cases"]:
            with self.subTest(text=case["text"][:40]):
                produced = embed_text(case["text"])
                self.assertEqual(len(produced), len(case["vector"]))
                for index, (ours, theirs) in enumerate(zip(produced, case["vector"])):
                    self.assertAlmostEqual(ours, theirs, places=12, msg=f"posição {index}")

    def test_fixture_covers_the_hard_cases(self):
        texts = [case["text"] for case in self.fixture["cases"]]
        self.assertIn("", texts)
        self.assertTrue(any(char in text for text in texts for char in "áéíóúãõç"))

    def test_tokenizer_drops_accents_and_case(self):
        self.assertEqual(tokenize("Ação"), tokenize("acao"))
        self.assertEqual(tokenize("CONTRATO"), ["contrato"])

    def test_hash_is_stable_and_bounded(self):
        for token in ("contrato", "a", "", "zzzzzzzzzzzzzzzzzzzz"):
            with self.subTest(token=token):
                self.assertEqual(hash_token(token), hash_token(token))
                self.assertTrue(0 <= hash_token(token) < DIMENSIONS)

    def test_empty_text_is_the_zero_vector(self):
        self.assertEqual(embed_text(""), [0.0] * DIMENSIONS)


if __name__ == "__main__":
    unittest.main()
