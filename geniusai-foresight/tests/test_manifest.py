import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("validate_squad",ROOT/"scripts/validate_squad.py")
assert SPEC and SPEC.loader
MODULE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class ManifestTests(unittest.TestCase):
    def test_validator_go(self):
        result=MODULE.validate(ROOT)
        self.assertEqual(result["go_no_go"],"go",result["errors"])
        self.assertEqual(result["counts"]["agents"],8)
        self.assertEqual(result["counts"]["tasks"],8)

    def test_all_declarative_files_are_json_compatible_yaml(self):
        for folder in ("agents","tasks","workflows"):
            for path in (ROOT/folder).glob("*.yaml"):
                data=json.loads(path.read_text(encoding="utf-8"))
                self.assertIsInstance(data,dict)

if __name__=="__main__": unittest.main()
