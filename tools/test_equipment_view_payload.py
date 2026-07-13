#!/usr/bin/env python3
"""Regression tests for the Equipment E3-D2 deterministic view payload."""

from __future__ import annotations

import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from generate_equipment_data import canonical_bytes, load
from generate_equipment_view_payload import DEFAULT_CANONICAL, DEFAULT_OUTPUT, INDEX_FILE, build_index_record, detail_filename, generate
from validate_equipment_view_payload import DETAIL_FILES, FILES, ROOT, ValidationError, validate


class EquipmentViewPayloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.canonical_document = load(DEFAULT_CANONICAL)
        cls.canonical = cls.canonical_document["records"]
        cls.canonical_by_id = {row["equipmentId"]: row for row in cls.canonical}
        cls.index = load(DEFAULT_OUTPUT / INDEX_FILE)["records"]
        cls.index_by_id = {row["equipmentId"]: row for row in cls.index}

    def workspace(self) -> tuple[tempfile.TemporaryDirectory, Path]:
        temp = tempfile.TemporaryDirectory()
        path = Path(temp.name)
        for name in FILES:
            shutil.copy2(DEFAULT_OUTPUT / name, path / name)
        return temp, path

    @staticmethod
    def write(path: Path, value: object) -> None:
        path.write_bytes(canonical_bytes(value))

    def test_01_validator_passes(self) -> None:
        self.assertEqual(validate(check_deterministic=False)["validator"], "passed")

    def test_02_index_has_786_records(self) -> None:
        self.assertEqual(len(self.index), 786)

    def test_03_index_identity_parity(self) -> None:
        self.assertEqual(set(self.index_by_id), set(self.canonical_by_id))

    def test_04_classification_parity(self) -> None:
        for equipment_id, summary in self.index_by_id.items():
            full = self.canonical_by_id[equipment_id]
            self.assertEqual((summary["equipmentGroup"], summary["equipmentType"], summary["slot"]), (full["equipmentGroup"], full["equipmentType"], full["slot"]))

    def test_05_search_fixture_parity(self) -> None:
        result = validate(check_deterministic=False)
        self.assertEqual(len(result["searchFixtures"]), 10)
        self.assertTrue(all(count > 0 for count in result["searchFixtures"].values()))

    def test_06_index_excludes_full_verification_and_relations(self) -> None:
        self.assertTrue(all(not ({"verification", "relations", "version"} & set(row)) for row in self.index))

    def test_07_detail_coverage_is_786(self) -> None:
        self.assertEqual(sum(len(load(DEFAULT_OUTPUT / name)["records"]) for name in DETAIL_FILES), 786)

    def test_08_each_equipment_has_one_locator(self) -> None:
        self.assertEqual(len({row["equipmentId"]: row["detailLocator"] for row in self.index}), 786)

    def test_09_locator_uses_stable_hash_bucket(self) -> None:
        self.assertTrue(all(Path(row["detailLocator"]).name == detail_filename(row["equipmentId"]) for row in self.index))

    def test_10_summary_matches_deterministic_projection(self) -> None:
        self.assertTrue(all(self.index_by_id[row["equipmentId"]] == build_index_record(row) for row in self.canonical))

    def test_11_detail_semantic_parity(self) -> None:
        details = {row["equipmentId"]: row for name in DETAIL_FILES for row in load(DEFAULT_OUTPUT / name)["records"]}
        self.assertEqual(details, self.canonical_by_id)

    def test_12_no_out_of_scope_entities(self) -> None:
        self.assertEqual({row["itemType"] for row in self.index}, {"wpn", "arm", "acc"})
        self.assertFalse(any(row["equipmentId"].startswith("rem_") for row in self.index))

    def test_13_index_is_under_one_megabyte(self) -> None:
        self.assertLess((DEFAULT_OUTPUT / INDEX_FILE).stat().st_size, 1_000_000)

    def test_14_utf8_lf_single_newline(self) -> None:
        for name in FILES:
            raw = (DEFAULT_OUTPUT / name).read_bytes()
            raw.decode("utf-8")
            self.assertNotIn(b"\r\n", raw)
            self.assertTrue(raw.endswith(b"\n"))
            self.assertFalse(raw.endswith(b"\n\n"))

    def test_15_two_generations_are_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            generate(DEFAULT_CANONICAL, Path(first))
            generate(DEFAULT_CANONICAL, Path(second))
            for name in FILES:
                self.assertEqual((Path(first) / name).read_bytes(), (Path(second) / name).read_bytes())

    def test_16_input_reorder_is_byte_stable(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            canonical = copy.deepcopy(self.canonical_document)
            canonical["records"].reverse()
            source = Path(temp) / "equipments.json"
            self.write(source, canonical)
            output = Path(temp) / "out"
            generate(source, output)
            for name in FILES:
                self.assertEqual((output / name).read_bytes(), (DEFAULT_OUTPUT / name).read_bytes())

    def test_17_checked_in_parity(self) -> None:
        self.assertTrue(validate()["byteStable"])

    def test_18_duplicate_index_id_fails(self) -> None:
        temp, path = self.workspace()
        try:
            document = load(path / INDEX_FILE)
            document["records"][1]["equipmentId"] = document["records"][0]["equipmentId"]
            self.write(path / INDEX_FILE, document)
            with self.assertRaisesRegex(ValidationError, "duplicate_equipment_id"):
                validate(path, check_deterministic=False)
        finally:
            temp.cleanup()

    def test_19_path_traversal_locator_fails(self) -> None:
        temp, path = self.workspace()
        try:
            document = load(path / INDEX_FILE)
            document["records"][0]["detailLocator"] = "../equipment-details-0.json"
            self.write(path / INDEX_FILE, document)
            with self.assertRaisesRegex(ValidationError, "view_index_schema_failed|invalid_detail_locator"):
                validate(path, check_deterministic=False)
        finally:
            temp.cleanup()

    def test_20_orphan_detail_fails(self) -> None:
        temp, path = self.workspace()
        try:
            name = DETAIL_FILES[0]
            document = load(path / name)
            original = document["records"][0]
            candidate = 0
            while True:
                fake_id = f"fake_equipment_{candidate}"
                if detail_filename(fake_id) == name:
                    break
                candidate += 1
            fake = copy.deepcopy(original)
            fake["equipmentId"] = fake_id
            fake["entityRef"]["entityId"] = fake_id
            document["records"].append(fake)
            document["records"].sort(key=lambda row: row["equipmentId"])
            self.write(path / name, document)
            with self.assertRaisesRegex(ValidationError, "orphan_detail"):
                validate(path, check_deterministic=False)
        finally:
            temp.cleanup()

    def test_21_missing_detail_fails(self) -> None:
        temp, path = self.workspace()
        try:
            name = DETAIL_FILES[0]
            document = load(path / name)
            document["records"].pop()
            self.write(path / name, document)
            with self.assertRaisesRegex(ValidationError, "missing_detail"):
                validate(path, check_deterministic=False)
        finally:
            temp.cleanup()

    def test_22_local_path_leak_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            canonical = copy.deepcopy(self.canonical_document)
            canonical["records"][0]["description"]["canonicalText"] = "C:/Users/local/source"
            canonical_path = root / "equipments.json"
            self.write(canonical_path, canonical)
            output = root / "out"
            generate(canonical_path, output)
            with self.assertRaisesRegex(ValidationError, "local_path_leak"):
                validate(output, canonical_path, source_root=ROOT, check_deterministic=False)

    def test_23_generator_does_not_modify_canonical_dataset(self) -> None:
        before = hashlib.sha256(DEFAULT_CANONICAL.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as temp:
            generate(DEFAULT_CANONICAL, Path(temp))
        self.assertEqual(hashlib.sha256(DEFAULT_CANONICAL.read_bytes()).hexdigest(), before)

    def test_24_five_price_conflicts_keep_review_status(self) -> None:
        self.assertEqual(sum(row["status"] == "review_required" for row in self.index), 5)

    def test_25_four_safe_values_remain_unresolved(self) -> None:
        self.assertEqual(sum(row["safeEnhance"]["enhanceable"] is None and row["safeEnhance"]["safeLevel"] is None for row in self.index), 4)

    def test_26_four_class_requirements_remain_unresolved(self) -> None:
        self.assertEqual(sum(row["classRequirements"]["baseClasses"] is None for row in self.index), 4)

    def test_27_277_descriptions_remain_missing(self) -> None:
        self.assertEqual(sum(row["description"]["canonicalText"] is None for row in self.index), 277)

    def test_28_monster_relation_parity(self) -> None:
        self.assertEqual(sum(rel["relationType"] == "monster_drop" for row in self.canonical for rel in row["relations"]), 1533)

    def test_29_craft_relation_parity(self) -> None:
        self.assertEqual(sum(rel["relationType"] == "craft_result" for row in self.canonical for rel in row["relations"]), 220)
        self.assertEqual(sum(rel["relationType"] == "craft_requirement" for row in self.canonical for rel in row["relations"]), 103)

    def test_30_legacy_equipment_literal_is_not_modified(self) -> None:
        before = hashlib.sha256((ROOT / "wiki.html").read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as temp:
            generate(DEFAULT_CANONICAL, Path(temp))
        self.assertEqual(hashlib.sha256((ROOT / "wiki.html").read_bytes()).hexdigest(), before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
