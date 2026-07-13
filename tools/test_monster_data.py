#!/usr/bin/env python3
"""Regression tests for the Monster C2-A data pipeline."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from generate_monster_data import ROOT, generate
from validate_monster_data import DEFAULT_SCHEMAS, FILES, ValidationError, validate


class MonsterDataPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.base_tmp = tempfile.TemporaryDirectory()
        cls.base = Path(cls.base_tmp.name)
        cls.counts = generate(ROOT, cls.base)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.base_tmp.cleanup()

    def fixture(self) -> tuple[tempfile.TemporaryDirectory, Path]:
        temp = tempfile.TemporaryDirectory()
        path = Path(temp.name)
        for name in FILES:
            shutil.copy2(self.base / name, path / name)
        return temp, path

    @staticmethod
    def rewrite(path: Path, value: object) -> None:
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")

    def test_generator_counts(self) -> None:
        self.assertEqual(self.counts, {"monsters": 460, "maps": 214, "dropTables": 433, "dropEntries": 3655, "unresolved": 2875})

    def test_validator(self) -> None:
        result = validate(self.base, DEFAULT_SCHEMAS, ROOT, False)
        self.assertEqual(result["schema"], "passed")

    def test_deterministic_generation(self) -> None:
        with tempfile.TemporaryDirectory() as other:
            generate(ROOT, Path(other))
            for name in FILES:
                self.assertEqual((self.base / name).read_bytes(), (Path(other) / name).read_bytes())

    def test_duplicate_id_rejected(self) -> None:
        temp, path = self.fixture()
        try:
            doc = json.loads((path / "monsters.json").read_text(encoding="utf-8"))
            doc["records"].append(dict(doc["records"][0]))
            self.rewrite(path / "monsters.json", doc)
            with self.assertRaisesRegex(ValidationError, "Duplicate monster ID"):
                validate(path, DEFAULT_SCHEMAS, ROOT, False)
        finally:
            temp.cleanup()

    def test_invalid_ref_rejected(self) -> None:
        temp, path = self.fixture()
        try:
            doc = json.loads((path / "monsters.json").read_text(encoding="utf-8"))
            doc["records"][0]["mapRef"] = [{"entityType": "map", "entityId": "missing_map"}]
            self.rewrite(path / "monsters.json", doc)
            with self.assertRaisesRegex(ValidationError, "Invalid MapRef"):
                validate(path, DEFAULT_SCHEMAS, ROOT, False)
        finally:
            temp.cleanup()

    def test_schema_rejected(self) -> None:
        temp, path = self.fixture()
        try:
            doc = json.loads((path / "monsters.json").read_text(encoding="utf-8"))
            del doc["records"][0]["hp"]
            self.rewrite(path / "monsters.json", doc)
            with self.assertRaisesRegex(ValidationError, "Schema validation failed"):
                validate(path, DEFAULT_SCHEMAS, ROOT, False)
        finally:
            temp.cleanup()

    def test_byte_stability_and_checked_in_parity(self) -> None:
        result = validate(ROOT / "data" / "monster", DEFAULT_SCHEMAS, ROOT, True)
        self.assertEqual(set(result["byteHashes"]), set(FILES))


if __name__ == "__main__":
    unittest.main(verbosity=2)
