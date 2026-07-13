#!/usr/bin/env python3
"""Regression tests for Equipment E3-A schemas and fixed fixtures."""

from __future__ import annotations

import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

from validate_equipment_fixtures import (
    DEFAULT_FIXTURES,
    DEFAULT_SCHEMAS,
    FIXTURE_FILES,
    ROOT,
    SCHEMA_FILES,
    ValidationError,
    canonical_bytes,
    equipment_schema_probe,
    extract_sources,
    load,
    validate,
)


class EquipmentFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = extract_sources(ROOT)
        cls.categories: dict[str, list[str]] = {}
        for row in cls.source["wiki"]:
            cls.categories.setdefault(row["category"], []).append(row["id"])

    def workspace(self) -> tuple[tempfile.TemporaryDirectory, Path, Path]:
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        fixtures, schemas = root / "fixtures", root / "schemas"
        fixtures.mkdir()
        schemas.mkdir()
        for name in FIXTURE_FILES:
            shutil.copy2(DEFAULT_FIXTURES / name, fixtures / name)
        for name in SCHEMA_FILES:
            shutil.copy2(DEFAULT_SCHEMAS / name, schemas / name)
        return temp, fixtures, schemas

    @staticmethod
    def rewrite(path: Path, value: object) -> None:
        path.write_bytes(canonical_bytes(value))

    def mutate(self, filename: str, callback, message: str) -> None:
        temp, fixtures, schemas = self.workspace()
        try:
            path = fixtures / filename
            value = load(path)
            callback(value)
            self.rewrite(path, value)
            with self.assertRaisesRegex(ValidationError, message):
                validate(fixtures, schemas, ROOT)
        finally:
            temp.cleanup()

    def test_01_valid_fixtures(self) -> None:
        self.assertEqual(validate()["validator"], "passed")

    def test_02_allowlist_is_exactly_786(self) -> None:
        self.mutate("equipment-allowlist.json", lambda x: x["records"].pop(), "invalid_equipment_allowlist_count")

    def test_03_duplicate_id_rejected(self) -> None:
        def change(x):
            x["records"].append(copy.deepcopy(x["records"][0]))
        self.mutate("equipment-allowlist.json", change, "invalid_equipment_allowlist_count|duplicate_equipment_id")

    def _replace_first_id(self, category: str) -> None:
        target = self.categories[category][0]
        def change(x):
            x["records"][0]["equipmentId"] = target
        self.mutate("equipment-allowlist.json", change, "out_of_scope_item")

    def test_04_skillbook_excluded(self) -> None:
        self._replace_first_id("skillbook")

    def test_05_doll_excluded(self) -> None:
        self._replace_first_id("doll")

    def test_06_remains_set_excluded(self) -> None:
        self._replace_first_id("set")

    def test_07_missing_db_target_rejected(self) -> None:
        def change(x):
            x["records"][0]["equipmentId"] = "missing_equipment_target"
        self.mutate("equipment-allowlist.json", change, "missing_equipment_source")

    def test_08_invalid_group_rejected(self) -> None:
        self.mutate("equipment-allowlist.json", lambda x: x["records"][0].update(expectedGroup="consumable"), "invalid_equipment_group")

    def test_09_invalid_type_rejected(self) -> None:
        self.mutate("equipment-allowlist.json", lambda x: x["records"][0].update(expectedType="axe_unknown"), "invalid_equipment_type")

    def test_10_invalid_slot_rejected(self) -> None:
        self.mutate("equipment-allowlist.json", lambda x: x["records"][0].update(expectedSlot="inventory"), "invalid_equipment_slot")

    def test_11_one_resolved_classification_per_id(self) -> None:
        def change(x):
            x["resolvedMappings"].append(copy.deepcopy(x["resolvedMappings"][0]))
        self.mutate("equipment-classification-mapping.json", change, "duplicate_equipment_id")

    def test_12_display_name_regex_forbidden(self) -> None:
        self.mutate("equipment-classification-mapping.json", lambda x: x.update(forbiddenStrategies=["display_name_as_foreign_key"]), "schema_validation_failed|classification_conflict")

    def test_13_five_price_conflicts_required(self) -> None:
        self.mutate("equipment-price-conflicts.json", lambda x: x["records"].pop(), "missing_price_conflict_fixture")

    def test_14_explicit_zero_is_not_missing(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["caseId"] == "safe_explicit_zero")
            row["expectedSafeSemantics"]["sourceState"] = "missing_unresolved"
        self.mutate("equipment-special-cases.json", change, "invalid_unresolved_state")

    def test_15_no_enhance_is_not_safe_zero(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["caseId"] == "no_enhance")
            row["expectedSafeSemantics"].update(enhanceable=True, sourceState="explicit_zero")
        self.mutate("equipment-special-cases.json", change, "invalid_unresolved_state")

    def test_16_req_all_is_not_missing_req(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["caseId"] == "requirements_all")
            row["expectedClassSemantics"].update(baseClasses=None, sourceState="missing_unresolved")
        self.mutate("equipment-special-cases.json", change, "invalid_unresolved_state")

    def test_17_dom_extraction_rejected(self) -> None:
        self.mutate("equipment-source-fixture.json", lambda x: x["sources"][0].update(usesDom=True), "schema_validation_failed|forbidden_runtime_extraction")

    def test_18_player_state_extraction_rejected(self) -> None:
        self.mutate("equipment-source-fixture.json", lambda x: x["sources"][0].update(usesPlayerState=True), "schema_validation_failed|forbidden_runtime_extraction")

    def test_19_absolute_local_path_rejected(self) -> None:
        self.mutate("equipment-source-fixture.json", lambda x: x["sources"][0].update(sourceFile="C:/Users/local/source.json"), "unsafe_equipment_source_path")

    def test_20_object_key_reorder_has_same_canonical_bytes(self) -> None:
        value = load(DEFAULT_FIXTURES / "equipment-source-fixture.json")
        reversed_value = dict(reversed(list(value.items())))
        self.assertEqual(canonical_bytes(value), canonical_bytes(reversed_value))

    def test_21_sha256_is_reproducible(self) -> None:
        result = validate()
        for name, digest in result["sha256"].items():
            path = (DEFAULT_FIXTURES if name in FIXTURE_FILES else DEFAULT_SCHEMAS) / name
            self.assertEqual(digest, hashlib.sha256(path.read_bytes()).hexdigest())

    def test_22_utf8_lf_single_newline(self) -> None:
        for directory, names in ((DEFAULT_FIXTURES, FIXTURE_FILES), (DEFAULT_SCHEMAS, SCHEMA_FILES)):
            for name in names:
                raw = (directory / name).read_bytes()
                raw.decode("utf-8")
                self.assertNotIn(b"\r\n", raw)
                self.assertTrue(raw.endswith(b"\n"))
                self.assertFalse(raw.endswith(b"\n\n"))

    def test_23_all_special_cases_present(self) -> None:
        def change(x):
            x["records"] = [r for r in x["records"] if r["caseId"] != "pet_weapon"]
        self.mutate("equipment-special-cases.json", change, "unresolved_classification")

    def test_24_unresolved_cannot_contain_fake_target(self) -> None:
        def change(x):
            x["records"][0]["target"] = 0
        self.mutate("equipment-unresolved.example.json", change, "schema_validation_failed|invalid_unresolved_state")

    def test_25_twenty_top_level_field_ceiling(self) -> None:
        schema = load(DEFAULT_SCHEMAS / "equipment.schema.json")
        self.assertEqual(len(schema["required"]), 20)
        probe = equipment_schema_probe("wpn_22")
        probe["weight"] = 1
        self.assertTrue(list(Draft202012Validator(schema).iter_errors(probe)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
