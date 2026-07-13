#!/usr/bin/env python3
"""Regression tests for the deterministic Equipment E3-B pipeline."""

from __future__ import annotations

import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from generate_equipment_data import DEFAULT_OUTPUT, ROOT, canonical_bytes, generate, load
from validate_equipment_data import DEFAULT_SCHEMAS, FILES, ValidationError, validate


class EquipmentDataTests(unittest.TestCase):
    def workspace(self) -> tuple[tempfile.TemporaryDirectory, Path]:
        temp = tempfile.TemporaryDirectory()
        path = Path(temp.name)
        for name in FILES:
            shutil.copy2(DEFAULT_OUTPUT / name, path / name)
        return temp, path

    @staticmethod
    def rewrite(path: Path, value: object) -> None:
        path.write_bytes(canonical_bytes(value))

    def mutate(self, filename: str, callback, message: str) -> None:
        temp, path = self.workspace()
        try:
            value = load(path / filename)
            callback(value)
            self.rewrite(path / filename, value)
            with self.assertRaisesRegex(ValidationError, message):
                validate(path, DEFAULT_SCHEMAS, ROOT, False)
        finally:
            temp.cleanup()

    def test_01_valid_dataset(self) -> None:
        self.assertEqual(validate(check_deterministic=False)["validator"], "passed")

    def test_02_count_not_786_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"].pop(), "invalid_equipment_count")

    def test_03_duplicate_id_rejected(self) -> None:
        def change(x):
            x["records"][1]["equipmentId"] = x["records"][0]["equipmentId"]
        self.mutate("equipments.json", change, "duplicate_equipment_id")

    def test_04_allowlist_mismatch_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0].update(equipmentId="missing_equipment"), "equipment_allowlist_mismatch")

    def _out_of_scope(self, category: str) -> None:
        program = __import__("generate_equipment_data").extract_program_sources(ROOT)
        target = next(row["id"] for row in program["wiki"] if row.get("category") == category)
        self.mutate("equipments.json", lambda x: x["records"][0].update(equipmentId=target), "equipment_allowlist_mismatch")

    def test_05_skillbook_rejected(self) -> None:
        self._out_of_scope("skillbook")

    def test_06_doll_rejected(self) -> None:
        self._out_of_scope("doll")

    def test_07_remains_rejected(self) -> None:
        self._out_of_scope("set")

    def test_08_entity_ref_mismatch_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0]["entityRef"].update(entityId="other"), "invalid_equipment_entity_ref")

    def test_09_invalid_group_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0].update(equipmentGroup="consumable"), "invalid_equipment_group")

    def test_10_invalid_type_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0].update(equipmentType="unknown_weapon"), "invalid_equipment_type")

    def test_11_invalid_slot_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0].update(slot="inventory"), "invalid_equipment_slot")

    def test_12_invalid_class_rejected(self) -> None:
        def change(x):
            x["records"][0]["classRequirements"]["baseClasses"] = ["wizard"]
        self.mutate("equipments.json", change, "invalid_equipment_class")

    def test_13_twenty_third_base_stat_rejected(self) -> None:
        def change(x):
            x["records"][0]["baseStats"]["luck"] = {"value": 1, "valueState": "explicit", "unit": None, "conceptRef": None}
        self.mutate("equipments.json", change, "invalid_base_stat")

    def test_14_proc_in_base_stats_rejected(self) -> None:
        def change(x):
            x["records"][0]["baseStats"]["procRateBase"] = {"value": 10, "valueState": "explicit", "unit": None, "conceptRef": None}
        self.mutate("equipments.json", change, "invalid_base_stat")

    def test_15_missing_safe_cannot_be_zero(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["safeEnhance"]["status"] == "unresolved")
            row["safeEnhance"].update(enhanceable=True, safeLevel=0)
        self.mutate("equipments.json", change, "invalid_safe_semantics")

    def test_16_no_enhance_and_safe_zero_are_distinct(self) -> None:
        rows = {row["equipmentId"]: row for row in load(DEFAULT_OUTPUT / "equipments.json")["records"]}
        self.assertFalse(rows["acc_ear_brave"]["safeEnhance"]["enhanceable"])
        self.assertIsNone(rows["acc_ear_brave"]["safeEnhance"]["safeLevel"])
        self.assertTrue(rows["acc_116"]["safeEnhance"]["enhanceable"])
        self.assertEqual(rows["acc_116"]["safeEnhance"]["safeLevel"], 0)

    def test_17_missing_req_cannot_be_all(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["classRequirements"]["status"] == "unresolved")
            row["classRequirements"].update(baseClasses=["dark", "dragon", "elf", "illusion", "knight", "mage", "royal", "warrior"], status="resolved")
        self.mutate("equipments.json", change, "invalid_class_requirement_semantics")

    def test_18_all_five_price_conflicts_required(self) -> None:
        def change(x):
            x["records"] = [r for r in x["records"] if not (r["code"] == "equipment_price_conflict" and r["equipmentId"] == "relic_strong_femur")]
        self.mutate("diagnostics.json", change, "equipment_price_conflict_missing")

    def test_19_description_html_rejected(self) -> None:
        self.mutate("equipments.json", lambda x: x["records"][0]["description"].update(canonicalText="<span onclick='x()'>bad</span>"), "equipment_schema_failed")

    def test_20_wrong_relation_target_type_rejected(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["relations"])
            row["relations"][0]["target"]["entityType"] = "item"
        self.mutate("equipments.json", change, "invalid_relation_ref")

    def test_21_unresolved_fake_target_rejected(self) -> None:
        temp, path = self.workspace()
        try:
            diag = load(path / "diagnostics.json")
            unresolved = load(path / "unresolved.json")
            target_id = unresolved["records"][0]["id"]
            next(r for r in unresolved["records"] if r["id"] == target_id)["target"] = {"entityType": "equipment", "entityId": "fake"}
            next(r for r in diag["records"] if r["id"] == target_id)["target"] = {"entityType": "equipment", "entityId": "fake"}
            self.rewrite(path / "diagnostics.json", diag)
            self.rewrite(path / "unresolved.json", unresolved)
            with self.assertRaisesRegex(ValidationError, "unresolved_fake_target"):
                validate(path, DEFAULT_SCHEMAS, ROOT, False)
        finally:
            temp.cleanup()

    def test_22_missing_provenance_rejected(self) -> None:
        def change(x):
            del x["records"][0]["verification"]["fields"]["price"]
        self.mutate("equipments.json", change, "missing_field_provenance")

    def test_23_input_reorder_preserves_output_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as source_temp, tempfile.TemporaryDirectory() as output_temp:
            source = Path(source_temp)
            for directory in ("js", "data/monster", "data/craft", "fixtures/equipment"):
                (source / directory).mkdir(parents=True, exist_ok=True)
            for name in ("00-data.js", "10-ui-tabs.js"):
                shutil.copy2(ROOT / "js" / name, source / "js" / name)
            shutil.copy2(ROOT / "wiki.html", source / "wiki.html")
            shutil.copy2(ROOT / "data/monster/drop_tables.json", source / "data/monster/drop_tables.json")
            shutil.copy2(ROOT / "data/craft/recipes.json", source / "data/craft/recipes.json")
            for name in ("equipment-allowlist.json", "equipment-classification-mapping.json", "equipment-source-fixture.json", "equipment-price-conflicts.json"):
                value = load(ROOT / "fixtures/equipment" / name)
                array_key = next(key for key in ("records", "resolvedMappings", "sources") if key in value)
                value[array_key].reverse()
                self.rewrite(source / "fixtures/equipment" / name, value)
            generate(source, Path(output_temp))
            for name in FILES:
                self.assertEqual((Path(output_temp) / name).read_bytes(), (DEFAULT_OUTPUT / name).read_bytes())

    def test_24_two_runs_have_identical_sha256(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            generate(ROOT, Path(first))
            generate(ROOT, Path(second))
            for name in FILES:
                self.assertEqual(hashlib.sha256((Path(first) / name).read_bytes()).hexdigest(), hashlib.sha256((Path(second) / name).read_bytes()).hexdigest())

    def test_25_checked_in_parity(self) -> None:
        self.assertTrue(validate()["byteStable"])

    def test_26_utf8_lf_single_newline(self) -> None:
        for name in FILES:
            raw = (DEFAULT_OUTPUT / name).read_bytes()
            raw.decode("utf-8")
            self.assertNotIn(b"\r\n", raw)
            self.assertTrue(raw.endswith(b"\n"))
            self.assertFalse(raw.endswith(b"\n\n"))

    def test_27_local_path_rejected(self) -> None:
        def change(x):
            row = next(r for r in x["records"] if r["status"] == "review_required")
            row["sourceLocation"] = "C:/Users/local/source.json"
        self.mutate("diagnostics.json", change, "local_path_leak")

    def test_28_monster_relations_complete(self) -> None:
        result = validate(check_deterministic=False)
        self.assertEqual(result["relations"]["monster_drop"], 1533)

    def test_29_craft_relations_complete(self) -> None:
        result = validate(check_deterministic=False)
        self.assertEqual(result["relations"]["craft_result"], 220)
        self.assertEqual(result["relations"]["craft_requirement"], 103)

    def test_30_status_not_all_complete(self) -> None:
        statuses = {row["status"] for row in load(DEFAULT_OUTPUT / "equipments.json")["records"]}
        self.assertNotEqual(statuses, {"complete"})
        self.assertEqual(statuses, {"partial", "review_required", "unresolved"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
