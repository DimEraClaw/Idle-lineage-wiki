#!/usr/bin/env python3
"""Tests for Release Source Manifest generation and validation."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from generate_source_manifest import (
    ManifestGenerationError,
    build_manifest,
    encode_manifest,
    ensure_output_outside_source_root,
    extract_game_version,
    read_file_list,
    resolve_source_file,
)
from validate_source_manifest import load_json, validate_manifest


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = load_json(ROOT / "schemas" / "release-source-manifest.schema.json")
FULL_SHA = "9252a99c152bca1256a900c94335cadff52558e9"
RETRIEVED_AT = "2026-07-13T00:00:00+08:00"


class SourceManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.source = self.base / "source"
        (self.source / "js").mkdir(parents=True)
        (self.source / "js" / "00-data.js").write_text(
            "const GAME_VERSION = 'v3.2.79';\nconst X = '中文';\n", encoding="utf-8", newline="\n"
        )
        (self.source / "index.html").write_text("<!doctype html>\n", encoding="utf-8", newline="\n")
        self.paths = ["index.html", "js/00-data.js"]

    def tearDown(self) -> None:
        self.temp.cleanup()

    def manifest(self, **overrides):
        values = dict(
            source_root=self.source,
            repository_url="https://github.com/shines871/idle-lineage-class",
            branch="main",
            commit_sha=FULL_SHA,
            retrieval_method="git_archive",
            file_paths=self.paths,
            retrieved_at=RETRIEVED_AT,
            commit_date=None,
        )
        values.update(overrides)
        return build_manifest(**values)

    def codes(self, manifest, **kwargs):
        return {item["code"] for item in validate_manifest(manifest, source_root=self.source, schema=SCHEMA, **kwargs)}

    def test_01_valid_manifest(self):
        self.assertEqual(self.codes(self.manifest()), set())

    def test_02_full_sha_required(self):
        with self.assertRaisesRegex(ManifestGenerationError, "invalid_full_sha"):
            self.manifest(commit_sha="9252a99")

    def test_03_uppercase_sha_rejected(self):
        with self.assertRaisesRegex(ManifestGenerationError, "invalid_full_sha"):
            self.manifest(commit_sha=FULL_SHA.upper())

    def test_04_missing_file(self):
        (self.source / "index.html").unlink()
        with self.assertRaises(ManifestGenerationError):
            self.manifest()

    def test_05_hash_mismatch(self):
        value = self.manifest()
        value["files"][0]["sha256"] = "0" * 64
        self.assertIn("source_hash_mismatch", self.codes(value))

    def test_06_size_mismatch(self):
        value = self.manifest()
        value["files"][0]["size"] += 1
        self.assertIn("source_size_mismatch", self.codes(value))

    def test_07_duplicate_path(self):
        value = self.manifest()
        value["files"].append(copy.deepcopy(value["files"][0]))
        self.assertIn("duplicate_source_path", self.codes(value))

    def test_08_unsorted_files(self):
        value = self.manifest()
        value["files"].reverse()
        self.assertIn("unsorted_source_files", self.codes(value))

    def test_09_absolute_path_rejected(self):
        with self.assertRaisesRegex(ManifestGenerationError, "unsafe_source_path"):
            self.manifest(file_paths=["C:/secret.txt", "js/00-data.js"])

    def test_10_parent_traversal_rejected(self):
        with self.assertRaisesRegex(ManifestGenerationError, "unsafe_source_path"):
            self.manifest(file_paths=["../secret.txt", "js/00-data.js"])

    def test_11_symlink_rejected(self):
        with mock.patch.object(Path, "is_symlink", return_value=True):
            with self.assertRaisesRegex(ManifestGenerationError, "symlink"):
                resolve_source_file(self.source, "index.html")

    def test_12_game_version_missing(self):
        payload = b"const OTHER_VERSION = 'v3.2.79';\n"
        with self.assertRaisesRegex(ManifestGenerationError, "game_version_missing"):
            extract_game_version(payload)

    def test_13_duplicate_game_version_rejected(self):
        payload = b"const GAME_VERSION = 'v1.0.0';\nconst GAME_VERSION = 'v2.0.0';\n"
        with self.assertRaisesRegex(ManifestGenerationError, "found 2"):
            extract_game_version(payload)

    def test_14_nonliteral_game_version_rejected(self):
        payload = b"const GAME_VERSION = getVersion();\n"
        with self.assertRaisesRegex(ManifestGenerationError, "game_version_missing"):
            extract_game_version(payload)

    def test_15_game_version_mismatch(self):
        value = self.manifest()
        value["gameVersion"] = "v0.0.0"
        self.assertIn("game_version_mismatch", self.codes(value))

    def test_16_github_pages_requires_full_sha(self):
        value = self.manifest()
        value["retrievalMethod"] = "github_pages"
        value["commitSha"] = "main"
        codes = self.codes(value)
        self.assertIn("invalid_full_sha", codes)
        self.assertIn("mutable_source_without_revision", codes)

    def test_17_unmanifested_generator_input(self):
        self.assertIn("unmanifested_generator_input", self.codes(self.manifest(), required_inputs=["js/extra.js"]))

    def test_18_deterministic_bytes(self):
        first = encode_manifest(self.manifest(branch="主要"))
        second = encode_manifest(self.manifest(file_paths=reversed(self.paths), branch="主要"))
        self.assertEqual(first, second)
        self.assertTrue(first.endswith(b"\n"))
        self.assertIn("主要".encode("utf-8"), first)
        first.decode("utf-8")

    def test_19_output_inside_source_root_rejected(self):
        with self.assertRaisesRegex(ManifestGenerationError, "outside source root"):
            ensure_output_outside_source_root(self.source / "manifest.json", self.source)

    def test_20_cli_writes_only_requested_output(self):
        file_list = self.base / "files.txt"
        file_list.write_text("js/00-data.js\nindex.html\n", encoding="utf-8", newline="\n")
        output_dir = self.base / "output"
        output = output_dir / "manifest.json"
        command = [
            sys.executable, str(ROOT / "tools" / "generate_source_manifest.py"),
            "--source-root", str(self.source),
            "--repository-url", "https://github.com/shines871/idle-lineage-class",
            "--branch", "main",
            "--commit-sha", FULL_SHA,
            "--retrieval-method", "git_archive",
            "--file-list", str(file_list),
            "--retrieved-at", RETRIEVED_AT,
            "--output", str(output),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual([path.name for path in output_dir.iterdir()], ["manifest.json"])
        self.assertEqual(output.read_bytes(), encode_manifest(self.manifest()))

    def test_21_file_list_sorted_and_unique(self):
        file_list = self.base / "files.txt"
        file_list.write_text("js/00-data.js\nindex.html\n", encoding="utf-8", newline="\n")
        self.assertEqual(read_file_list(file_list), self.paths)

    def test_22_source_root_escape_is_blocked(self):
        outside = self.base / "outside.txt"
        outside.write_text("secret", encoding="utf-8")
        with self.assertRaisesRegex(ManifestGenerationError, "unsafe_source_path"):
            resolve_source_file(self.source, "../outside.txt")


if __name__ == "__main__":
    unittest.main(verbosity=2)
