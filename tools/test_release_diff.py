#!/usr/bin/env python3
"""Regression tests for Wiki Automation Pipeline semantic diff foundation."""

from __future__ import annotations

import copy
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from generate_release_diff import (
    DOMAIN_SPECS,
    DiffGenerationError,
    build_summary,
    canonical_bytes,
    compare_values,
    ensure_output_safe,
    generate_diff,
    safe_cli_path,
)
from render_release_notes import render
from validate_release_diff import DEFAULT_SCHEMA, DiffValidationError, load, validate_diff, validate_file


ROOT = Path(__file__).resolve().parents[1]
APPROVED = ROOT / "fixtures" / "releases" / "semantic-diff-approved.example"
CANDIDATE = ROOT / "fixtures" / "releases" / "semantic-diff-candidate.example"
EXAMPLE = ROOT / "fixtures" / "releases" / "semantic-release-diff.example.json"
SHA_A = "1" * 40
SHA_B = "2" * 40
SCHEMA = load(DEFAULT_SCHEMA)


class ReleaseDiffTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.value = generate_diff(APPROVED, CANDIDATE, "wiki-v1.0.0", "v3.4.17-candidate", SHA_A, SHA_B, list(DOMAIN_SPECS))

    def domain(self, name):
        return next(item for item in self.value["domains"] if item["domain"] == name)

    def change(self, domain, entity_id):
        current = self.domain(domain)
        for key in ("added", "removed", "modified", "unresolvedAdded", "unresolvedResolved", "conflicts", "technicalOnly"):
            for record in current[key]:
                if record["entityId"] == entity_id:
                    return record
        self.fail(f"missing change {domain}:{entity_id}")

    def clone_roots(self):
        temp = tempfile.TemporaryDirectory()
        base = Path(temp.name)
        shutil.copytree(APPROVED, base / "approved")
        shutil.copytree(CANDIDATE, base / "candidate")
        return temp, base / "approved", base / "candidate"

    def test_01_valid_monster_added(self):
        self.assertEqual(self.change("monster", "sanct_hellslave")["changeType"], "added")

    def test_02_monster_removed(self):
        self.assertEqual(self.change("monster", "monster_removed")["changeType"], "removed")

    def test_03_monster_hp_modified(self):
        record = self.change("monster", "monster_hp")
        self.assertIn("/hp", [item["path"] for item in record["fieldChanges"]])

    def test_04_boss_modified(self):
        self.assertIn("/boss", [item["path"] for item in self.change("monster", "monster_boss")["fieldChanges"]])

    def test_05_map_relation_changed(self):
        self.assertEqual(self.change("monster", "monster_map")["changeType"], "relation_changed")

    def test_06_drop_relation_changed(self):
        self.assertEqual(self.change("monster", "monster_drop")["changeType"], "relation_changed")

    def test_07_equipment_added(self):
        self.assertEqual(self.change("equipment", "eq_new")["changeType"], "added")

    def test_08_equipment_removed_is_blocked(self):
        record = self.change("equipment", "eq_removed")
        self.assertTrue(record["blocking"])
        self.assertEqual(record["reviewStatus"], "blocked")

    def test_09_equipment_classification_review(self):
        record = self.change("equipment", "eq_class")
        self.assertEqual(record["reviewStatus"], "review_required")
        self.assertIn("/equipmentType", [item["path"] for item in record["fieldChanges"]])

    def test_10_base_stats_explicit_zero(self):
        changes = self.change("equipment", "eq_zero")["fieldChanges"]
        self.assertTrue(any(item["path"].endswith("/value") and item["candidateValue"] == 0 for item in changes))

    def test_11_safe_unresolved_to_resolved(self):
        self.assertEqual(self.change("equipment", "equipment_diagnostic_eq_safe_safe")["changeType"], "unresolved_resolved")

    def test_12_requirement_unresolved_added(self):
        record = self.change("equipment", "equipment_diagnostic_eq_new_req")
        self.assertEqual(record["changeType"], "unresolved_added")
        self.assertTrue(record["blocking"])

    def test_13_price_conflict_blocked(self):
        record = self.change("equipment", "equipment_diagnostic_eq_zero_price")
        self.assertEqual(record["changeType"], "conflict")
        self.assertTrue(record["blocking"])

    def test_14_relation_added(self):
        changes = self.change("equipment", "eq_relation")["fieldChanges"]
        self.assertTrue(any(item["path"].startswith("/relations/") for item in changes))

    def test_15_relation_removed(self):
        changes = compare_values({"relations":[{"entityType":"map","entityId":"a"}]}, {"relations":[]})
        self.assertEqual(changes[0]["category"], "relation")

    def test_16_array_reorder_is_not_semantic(self):
        before = {"relations":[{"entityType":"map","entityId":"a"},{"entityType":"map","entityId":"b"}]}
        after = {"relations":list(reversed(before["relations"]))}
        self.assertEqual(compare_values(before, after), [])

    def test_17_object_key_reorder_no_diff(self):
        self.assertEqual(compare_values({"hp":1,"level":2}, {"level":2,"hp":1}), [])

    def test_18_json_formatting_no_diff(self):
        first = json.loads('{"monsterId":"m","hp":1}')
        second = json.loads('{\n  "hp": 1, "monsterId": "m"\n}')
        self.assertEqual(compare_values(first, second), [])

    def test_19_provenance_only(self):
        self.assertEqual(self.change("monster", "monster_provenance")["changeType"], "technical_only")

    def test_20_display_only(self):
        self.assertEqual(self.change("monster", "monster_display")["changeType"], "display_only")

    def test_21_unresolved_added(self):
        self.assertEqual(self.domain("equipment")["unresolvedAdded"][0]["changeType"], "unresolved_added")

    def test_22_unresolved_resolved(self):
        self.assertEqual(self.domain("equipment")["unresolvedResolved"][0]["changeType"], "unresolved_resolved")

    def test_23_conflict_blocked(self):
        self.assertTrue(all(item["reviewStatus"] == "blocked" for item in self.domain("monster")["conflicts"]))

    def test_24_hellslave_conflict_does_not_select_target(self):
        record = self.change("monster", "legacy_monster_name_hellslave")
        self.assertEqual(record["changeType"], "conflict")
        self.assertNotIn("de_train_hellslave", record["entityId"])
        self.assertNotIn("sanct_hellslave", record["entityId"])

    def test_25_duplicate_entity_id_fails(self):
        temp, approved, candidate = self.clone_roots()
        try:
            path = candidate / "monsters.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["records"].append(copy.deepcopy(value["records"][0]))
            path.write_bytes(canonical_bytes(value))
            with self.assertRaisesRegex(DiffGenerationError, "duplicate_entity_id"):
                generate_diff(approved, candidate, "a", "b", SHA_A, SHA_B, ["monster"])
        finally:
            temp.cleanup()

    def test_26_duplicate_change_id_fails(self):
        value = copy.deepcopy(self.value)
        value["domains"][0]["added"].append(copy.deepcopy(value["domains"][0]["added"][0]))
        value["summary"] = build_summary(value["domains"], value["diagnostics"])
        with self.assertRaisesRegex(DiffValidationError, "duplicate_change_id"):
            validate_diff(value, SCHEMA)

    def test_27_invalid_sha_fails(self):
        with self.assertRaisesRegex(DiffGenerationError, "invalid_full_sha"):
            generate_diff(APPROVED, CANDIDATE, "a", "b", "abc", SHA_B, ["monster"])

    def test_28_invalid_path_fails(self):
        with self.assertRaisesRegex(DiffGenerationError, "unsafe_path"):
            safe_cli_path("../secret", "approved")

    def test_29_summary_mismatch_fails(self):
        value = copy.deepcopy(self.value)
        value["summary"]["totalAdded"] += 1
        with self.assertRaisesRegex(DiffValidationError, "summary_mismatch"):
            validate_diff(value, SCHEMA)

    def test_30_deterministic_output(self):
        again = generate_diff(APPROVED, CANDIDATE, "wiki-v1.0.0", "v3.4.17-candidate", SHA_A, SHA_B, list(reversed(DOMAIN_SPECS)))
        self.assertEqual(canonical_bytes(self.value), canonical_bytes(again))

    def test_31_input_reorder_byte_stable(self):
        temp, approved, candidate = self.clone_roots()
        try:
            for root in (approved, candidate):
                path = root / "monsters.json"
                value = json.loads(path.read_text(encoding="utf-8"))
                value["records"].reverse()
                path.write_bytes(canonical_bytes(value))
            reordered = generate_diff(approved, candidate, "wiki-v1.0.0", "v3.4.17-candidate", SHA_A, SHA_B, list(DOMAIN_SPECS))
            self.assertEqual(canonical_bytes(self.value), canonical_bytes(reordered))
        finally:
            temp.cleanup()

    def test_32_markdown_byte_stable(self):
        self.assertEqual(render(self.value), render(copy.deepcopy(self.value)))

    def test_33_release_notes_do_not_publish_blocked_change(self):
        text = render(self.value).decode("utf-8")
        monster_section = text.split("## Monster",1)[1].split("## Map",1)[0]
        self.assertNotIn("legacy_monster_name_hellslave", monster_section)
        self.assertIn("legacy_monster_name_hellslave", text.split("## 尚待人工確認",1)[1])

    def test_34_technical_only_not_in_player_section(self):
        text = render(self.value).decode("utf-8")
        monster_section = text.split("## Monster",1)[1].split("## Map",1)[0]
        self.assertNotIn("monster_provenance", monster_section)
        self.assertIn("monster_provenance", text.split("## Technical-only changes",1)[1])

    def test_35_inputs_not_modified(self):
        paths = list(APPROVED.glob("*.json")) + list(CANDIDATE.glob("*.json"))
        before = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
        generate_diff(APPROVED, CANDIDATE, "a", "b", SHA_A, SHA_B, list(DOMAIN_SPECS))
        after = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
        self.assertEqual(before, after)

    def test_36_no_local_paths(self):
        serialized = canonical_bytes(self.value).decode("utf-8")
        self.assertNotIn(str(ROOT), serialized)
        self.assertNotIn("file://", serialized)

    def test_37_drop_entry_reorder_is_ignored(self):
        record = self.change("drop", "drop_a")
        paths = [item["path"] for item in record["fieldChanges"]]
        self.assertFalse(any(path == "/entries" for path in paths))
        self.assertTrue(any("entry_2" in path and "probability" in path for path in paths))

    def test_38_probability_unit_is_not_guessed(self):
        changes = compare_values({"probability":{"value":1,"unit":"percent"}}, {"probability":{"value":0.01,"unit":"ratio"}})
        self.assertEqual({item["path"] for item in changes}, {"/probability/unit", "/probability/value"})

    def test_39_output_may_not_replace_input(self):
        with self.assertRaisesRegex(DiffGenerationError, "output_matches_input"):
            ensure_output_safe((APPROVED / "monsters.json").resolve(), [(APPROVED / "monsters.json").resolve()])

    def test_40_example_schema_and_bytes(self):
        result = validate_file(EXAMPLE)
        self.assertTrue(result["valid"])

    def test_41_rejected_status_not_generated(self):
        value = copy.deepcopy(self.value)
        value["domains"][0]["added"][0]["reviewStatus"] = "rejected"
        with self.assertRaisesRegex(DiffValidationError, "invalid_generated_review_status"):
            validate_diff(value, SCHEMA)

    def test_42_crlf_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "diff.json"
            path.write_bytes(canonical_bytes(self.value).replace(b"\n", b"\r\n"))
            with self.assertRaisesRegex(DiffValidationError, "line_endings"):
                validate_file(path)

    def test_43_noncanonical_json_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "diff.json"
            path.write_text(json.dumps(self.value, ensure_ascii=False), encoding="utf-8", newline="\n")
            with self.assertRaisesRegex(DiffValidationError, "single_final_newline|noncanonical"):
                validate_file(path)

    def test_44_cli_offline_and_requested_output_only(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "diff.json"
            command = [sys.executable, str(ROOT / "tools" / "generate_release_diff.py"), "--approved-root", str(APPROVED), "--candidate-root", str(CANDIDATE), "--approved-version", "a", "--candidate-version", "b", "--approved-source-sha", SHA_A, "--candidate-source-sha", SHA_B, "--domains", "monster,map,drop,equipment", "--output", str(output)]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual([path.name for path in Path(directory).iterdir()], ["diff.json"])

    def test_45_missing_formal_identity_is_blocking_diagnostic(self):
        temp, approved, candidate = self.clone_roots()
        try:
            path = candidate / "monsters.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["records"].append({"displayName":"不得作為 ID","hp":1})
            path.write_bytes(canonical_bytes(value))
            diff = generate_diff(approved, candidate, "a", "b", SHA_A, SHA_B, ["monster"])
            self.assertEqual(diff["diagnostics"][0]["code"], "formal_identity_missing")
            self.assertEqual(diff["review"]["status"], "blocked")
            self.assertEqual(diff["summary"]["totalBlocking"], 2)
        finally:
            temp.cleanup()


if __name__ == "__main__":
    unittest.main(verbosity=2)
