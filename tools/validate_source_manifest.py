#!/usr/bin/env python3
"""Validate a Release Source Manifest and its offline source root."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker

from generate_source_manifest import (
    FULL_SHA_RE,
    MANIFEST_SCHEMA_VERSION,
    ManifestGenerationError,
    extract_game_version,
    resolve_source_file,
    validate_relative_posix_path,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = ROOT / "schemas" / "release-source-manifest.schema.json"
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


def diagnostic(code: str, message: str, *, severity: str = "error", blocking: bool = True, path: str | None = None) -> dict[str, Any]:
    return {"code": code, "severity": severity, "blocking": blocking, "path": path, "message": message}


def _schema_code(error: Any) -> str:
    path = "/".join(str(value) for value in error.absolute_path)
    if path == "commitSha":
        return "invalid_full_sha"
    if path.endswith("/path"):
        return "unsafe_source_path"
    return "schema_error"


def validate_manifest(
    manifest: dict[str, Any],
    *,
    source_root: Path,
    schema: dict[str, Any],
    manifest_path: Path | None = None,
    required_inputs: Iterable[str] = (),
) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for error in sorted(validator.iter_errors(manifest), key=lambda item: list(item.absolute_path)):
        diagnostics.append(diagnostic(_schema_code(error), error.message, path="/".join(map(str, error.absolute_path))))

    commit_sha = manifest.get("commitSha")
    if not isinstance(commit_sha, str) or not FULL_SHA_RE.fullmatch(commit_sha):
        if not any(item["code"] == "invalid_full_sha" for item in diagnostics):
            diagnostics.append(diagnostic("invalid_full_sha", "commitSha must be 40 lowercase hexadecimal characters", path="commitSha"))
    if manifest.get("retrievalMethod") == "github_pages" and (not isinstance(commit_sha, str) or not FULL_SHA_RE.fullmatch(commit_sha)):
        diagnostics.append(diagnostic("mutable_source_without_revision", "github_pages requires a full commitSha", path="retrievalMethod"))

    files = manifest.get("files")
    if not isinstance(files, list):
        return diagnostics
    paths = [record.get("path") for record in files if isinstance(record, dict)]
    string_paths = [value for value in paths if isinstance(value, str)]
    if len(string_paths) != len(set(string_paths)):
        diagnostics.append(diagnostic("duplicate_source_path", "files contains duplicate path values", path="files"))
    if string_paths != sorted(string_paths):
        diagnostics.append(diagnostic("unsorted_source_files", "files must be sorted by path", path="files"))

    required = []
    for value in required_inputs:
        try:
            required.append(validate_relative_posix_path(value))
        except ManifestGenerationError as exc:
            diagnostics.append(diagnostic("unsafe_source_path", str(exc), path=value))
    for value in sorted(set(required) - set(string_paths)):
        diagnostics.append(diagnostic("unmanifested_generator_input", f"required generator input is missing from manifest: {value}", path=value))

    manifest_resolved = manifest_path.resolve(strict=False) if manifest_path else None
    game_payload: bytes | None = None
    seen_resolved: set[Path] = set()
    for index, record in enumerate(files):
        if not isinstance(record, dict) or not isinstance(record.get("path"), str):
            continue
        relative_path = record["path"]
        try:
            source_path = resolve_source_file(source_root, relative_path)
            if manifest_resolved is not None and source_path == manifest_resolved:
                diagnostics.append(diagnostic("unsupported_source_file_type", "manifest must not list itself as a source file", path=relative_path))
                continue
            if source_path in seen_resolved:
                diagnostics.append(diagnostic("duplicate_source_path", "multiple paths resolve to the same source file", path=relative_path))
            seen_resolved.add(source_path)
            payload = source_path.read_bytes()
        except ManifestGenerationError as exc:
            message = str(exc)
            code = "unsupported_source_file_type" if "unsupported_source_file_type" in message else "source_file_missing"
            if "unsafe_source_path" in message:
                code = "unsafe_source_path"
            diagnostics.append(diagnostic(code, message, path=relative_path))
            continue
        actual_hash = hashlib.sha256(payload).hexdigest()
        actual_size = len(payload)
        expected_hash = record.get("sha256")
        expected_size = record.get("size")
        if not isinstance(expected_hash, str) or not HEX64_RE.fullmatch(expected_hash):
            diagnostics.append(diagnostic("schema_error", "sha256 must be 64 lowercase hexadecimal characters", path=f"files/{index}/sha256"))
        elif actual_hash != expected_hash:
            diagnostics.append(diagnostic("source_hash_mismatch", f"SHA-256 mismatch for {relative_path}", path=relative_path))
        if isinstance(expected_size, int) and not isinstance(expected_size, bool):
            if actual_size != expected_size:
                diagnostics.append(diagnostic("source_size_mismatch", f"byte size mismatch for {relative_path}", path=relative_path))
        if relative_path == "js/00-data.js":
            game_payload = payload

    if "js/00-data.js" not in string_paths:
        diagnostics.append(diagnostic("unmanifested_generator_input", "js/00-data.js must be in manifest scope", path="js/00-data.js"))
    elif game_payload is not None:
        try:
            parsed_version = extract_game_version(game_payload)
            if manifest.get("gameVersion") != parsed_version:
                diagnostics.append(diagnostic("game_version_mismatch", f"manifest gameVersion does not match source: {parsed_version}", path="gameVersion"))
        except ManifestGenerationError as exc:
            diagnostics.append(diagnostic("game_version_missing", str(exc), path="js/00-data.js"))

    if manifest.get("gameVersion") is None:
        diagnostics.append(diagnostic("game_version_missing", "gameVersion is unresolved", severity="warning", blocking=False, path="gameVersion"))
    if manifest.get("manifestSchemaVersion") != MANIFEST_SCHEMA_VERSION:
        diagnostics.append(diagnostic("unsupported_manifest_schema_version", f"supported manifestSchemaVersion is {MANIFEST_SCHEMA_VERSION}", path="manifestSchemaVersion"))
    return diagnostics


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        raise ValueError(f"manifest must be UTF-8: {path}") from exc
    if not isinstance(value, dict):
        raise ValueError("manifest root must be an object")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--required-input", action="append", default=[])
    parser.add_argument("--required-input-list", type=Path)
    args = parser.parse_args()
    try:
        manifest = load_json(args.manifest)
        schema = load_json(args.schema)
        required_inputs = list(args.required_input)
        if args.required_input_list:
            required_inputs.extend(
                line.strip() for line in args.required_input_list.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            )
        diagnostics = validate_manifest(
            manifest,
            source_root=args.source_root,
            schema=schema,
            manifest_path=args.manifest,
            required_inputs=required_inputs,
        )
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        diagnostics = [diagnostic("manifest_read_error", str(exc))]
    blocking = [item for item in diagnostics if item["blocking"]]
    result = {"valid": not blocking, "blockingCount": len(blocking), "diagnostics": diagnostics}
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
