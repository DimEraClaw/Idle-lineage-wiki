#!/usr/bin/env python3
"""Tests for the stable upstream Source Inventory fixture."""

from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from validate_source_inventory import (
    DEFAULT_INPUT,
    DEFAULT_SCHEMA,
    EXPECTED_PATHS,
    InventoryValidationError,
    encode_inventory,
    load,
    validate_file,
    validate_inventory,
)


SCHEMA = load(DEFAULT_SCHEMA)


class SourceInventoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = load(DEFAULT_INPUT)

    def validate(self, value):
        return validate_inventory(value, SCHEMA)

    def test_01_valid_15_file_inventory(self):
        self.assertTrue(self.validate(copy.deepcopy(self.fixture))["valid"])

    def test_02_exactly_15_unique_paths(self):
        paths = [record["path"] for record in self.fixture["files"]]
        self.assertEqual(len(paths), 15)
        self.assertEqual(tuple(paths), EXPECTED_PATHS)

    def test_03_duplicate_path_failure(self):
        value = copy.deepcopy(self.fixture)
        value["files"][-1]["path"] = value["files"][0]["path"]
        with self.assertRaisesRegex(InventoryValidationError, "duplicate_source_path|source_paths_not_sorted"):
            self.validate(value)

    def test_04_unsafe_parent_path_failure(self):
        value = copy.deepcopy(self.fixture)
        value["files"][0]["path"] = "../index.html"
        with self.assertRaisesRegex(InventoryValidationError, "schema_failed"):
            self.validate(value)

    def test_05_absolute_path_failure(self):
        value = copy.deepcopy(self.fixture)
        value["files"][0]["path"] = "C:/secret/index.html"
        with self.assertRaisesRegex(InventoryValidationError, "schema_failed"):
            self.validate(value)

    def test_06_unknown_role_failure(self):
        value = copy.deepcopy(self.fixture)
        value["files"][0]["role"] = "everything_owner"
        with self.assertRaisesRegex(InventoryValidationError, "schema_failed"):
            self.validate(value)

    def test_07_missing_monster_equipment_owner_failure(self):
        value = copy.deepcopy(self.fixture)
        next(record for record in value["files"] if record["path"] == "js/00-data.js")["role"] = "runtime_evidence"
        with self.assertRaisesRegex(InventoryValidationError, "monster_equipment_canonical_owner_missing"):
            self.validate(value)

    def test_08_drop_owner_file_missing_failure(self):
        value = copy.deepcopy(self.fixture)
        value["files"] = [record for record in value["files"] if record["path"] != "js/01-drops-config.js"]
        with self.assertRaisesRegex(InventoryValidationError, "15_files"):
            self.validate(value)

    def test_09_equipment_classification_owner_missing_failure(self):
        value = copy.deepcopy(self.fixture)
        target = next(record for record in value["files"] if record["path"] == "js/10-ui-tabs.js")
        target["role"] = "runtime_evidence"
        target["ownerType"] = "evidence_source"
        with self.assertRaisesRegex(InventoryValidationError, "equipment_classification_owner_missing"):
            self.validate(value)

    def test_10_input_reorder_is_byte_stable(self):
        value = copy.deepcopy(self.fixture)
        value["files"].reverse()
        value["domains"].reverse()
        for record in value["files"]:
            record["domains"].reverse()
        self.assertEqual(encode_inventory(self.fixture), encode_inventory(value))

    def test_11_utf8_lf_single_newline(self):
        raw = DEFAULT_INPUT.read_bytes()
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        raw.decode("utf-8")

    def test_12_no_local_path(self):
        text = DEFAULT_INPUT.read_text(encoding="utf-8")
        for token in ("C:/", "D:/", "file://", "localhost", "127.0.0.1"):
            self.assertNotIn(token, text)

    def test_13_no_mutable_timestamp(self):
        text = DEFAULT_INPUT.read_text(encoding="utf-8")
        self.assertNotRegex(text, r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")
        self.assertNotIn("retrievedAt", text)

    def test_14_no_game_version(self):
        self.assertNotIn("gameVersion", DEFAULT_INPUT.read_text(encoding="utf-8"))
        self.assertNotIn("GameVersion", DEFAULT_INPUT.read_text(encoding="utf-8"))

    def test_15_no_commit_sha(self):
        text = DEFAULT_INPUT.read_text(encoding="utf-8")
        self.assertNotIn("commitSha", text)
        self.assertNotRegex(text, r'"[0-9a-f]{40}"')

    def test_16_additional_property_failure(self):
        value = copy.deepcopy(self.fixture)
        value["retrievedAt"] = "2026-01-01T00:00:00Z"
        with self.assertRaisesRegex(InventoryValidationError, "schema_failed"):
            self.validate(value)

    def test_17_owner_roles_are_narrow(self):
        roles = {record["path"]: record["role"] for record in self.fixture["files"]}
        self.assertEqual({path for path, role in roles.items() if role == "canonical_owner"}, {"js/00-data.js", "js/01-drops-config.js"})
        self.assertEqual(roles["js/10-ui-tabs.js"], "classification_owner")
        self.assertEqual(roles["js/14-craft-pandora.js"], "parity_evidence")

    def test_18_fixture_not_modified_and_file_validator_passes(self):
        before = hashlib.sha256(DEFAULT_INPUT.read_bytes()).hexdigest()
        result = validate_file()
        after = hashlib.sha256(DEFAULT_INPUT.read_bytes()).hexdigest()
        self.assertEqual(before, after)
        self.assertTrue(result["byteStable"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
