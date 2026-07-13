#!/usr/bin/env python3
"""Generate a deterministic, offline Release Source Manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


MANIFEST_SCHEMA_VERSION = "1.0.0"
FULL_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SEMVER_RE = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
GAME_VERSION_RE = re.compile(
    r"^\s*const\s+GAME_VERSION\s*=\s*(['\"])([^'\"\r\n]+)\1\s*;\s*(?://.*)?$",
    re.MULTILINE,
)
RETRIEVAL_METHODS = ("git_archive", "git_checkout", "github_raw", "github_pages")


class ManifestGenerationError(RuntimeError):
    pass


def parse_iso8601(value: str, field: str) -> str:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ManifestGenerationError(f"{field} must be an ISO-8601 timestamp: {value}") from exc
    if "T" not in value:
        raise ManifestGenerationError(f"{field} must include date and time: {value}")
    return value


def validate_relative_posix_path(value: str) -> str:
    if not value or "\\" in value or "\x00" in value:
        raise ManifestGenerationError(f"unsafe_source_path: {value!r}")
    pure = PurePosixPath(value)
    if pure.is_absolute() or re.match(r"^[A-Za-z]:", value):
        raise ManifestGenerationError(f"unsafe_source_path: {value!r}")
    if any(part in ("", ".", "..") for part in pure.parts) or "//" in value:
        raise ManifestGenerationError(f"unsafe_source_path: {value!r}")
    return pure.as_posix()


def read_file_list(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ManifestGenerationError(f"file list must be UTF-8: {path}") from exc
    values = [validate_relative_posix_path(line.strip()) for line in text.splitlines()
              if line.strip() and not line.lstrip().startswith("#")]
    if not values:
        raise ManifestGenerationError("file list is empty")
    if len(values) != len(set(values)):
        raise ManifestGenerationError("duplicate_source_path in file list")
    return sorted(values)


def _reject_symlink_components(root: Path, relative_path: str) -> Path:
    candidate = root
    for part in PurePosixPath(relative_path).parts:
        candidate = candidate / part
        if candidate.is_symlink():
            raise ManifestGenerationError(f"unsupported_source_file_type: symlink: {relative_path}")
    return candidate


def resolve_source_file(source_root: Path, relative_path: str) -> Path:
    safe_path = validate_relative_posix_path(relative_path)
    root = source_root.resolve(strict=True)
    candidate = _reject_symlink_components(root, safe_path)
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root)
    except (FileNotFoundError, ValueError) as exc:
        raise ManifestGenerationError(f"source_file_missing or unsafe_source_path: {safe_path}") from exc
    if not resolved.is_file():
        raise ManifestGenerationError(f"unsupported_source_file_type: {safe_path}")
    return resolved


def extract_game_version(source: bytes, source_name: str = "js/00-data.js") -> str:
    try:
        text = source.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ManifestGenerationError(f"game_version_missing: {source_name} is not UTF-8") from exc
    matches = GAME_VERSION_RE.findall(text)
    if len(matches) != 1:
        raise ManifestGenerationError(
            f"game_version_missing: expected exactly one literal GAME_VERSION in {source_name}, found {len(matches)}"
        )
    return matches[0][1]


def build_manifest(
    *,
    source_root: Path,
    repository_url: str,
    branch: str,
    commit_sha: str,
    retrieval_method: str,
    file_paths: Iterable[str],
    retrieved_at: str,
    commit_date: str | None = None,
    manifest_schema_version: str = MANIFEST_SCHEMA_VERSION,
    game_version_path: str = "js/00-data.js",
) -> dict[str, Any]:
    if not repository_url.startswith("https://"):
        raise ManifestGenerationError("sourceRepository must be an HTTPS URL")
    if not branch or any(ch.isspace() for ch in branch):
        raise ManifestGenerationError("branch is invalid")
    if not FULL_SHA_RE.fullmatch(commit_sha):
        raise ManifestGenerationError("invalid_full_sha")
    if retrieval_method not in RETRIEVAL_METHODS:
        raise ManifestGenerationError(f"unsupported retrievalMethod: {retrieval_method}")
    if not SEMVER_RE.fullmatch(manifest_schema_version):
        raise ManifestGenerationError("manifestSchemaVersion must be SemVer")
    parse_iso8601(retrieved_at, "retrievedAt")
    if commit_date is not None:
        parse_iso8601(commit_date, "commitDate")

    paths = sorted(validate_relative_posix_path(value) for value in file_paths)
    if not paths or len(paths) != len(set(paths)):
        raise ManifestGenerationError("files must be non-empty and path-unique")
    game_version_path = validate_relative_posix_path(game_version_path)
    if game_version_path not in paths:
        raise ManifestGenerationError(f"unmanifested_generator_input: {game_version_path}")

    records: list[dict[str, Any]] = []
    game_version: str | None = None
    for relative_path in paths:
        source_path = resolve_source_file(source_root, relative_path)
        payload = source_path.read_bytes()
        records.append({
            "path": relative_path,
            "sha256": hashlib.sha256(payload).hexdigest(),
            "size": len(payload),
        })
        if relative_path == game_version_path:
            game_version = extract_game_version(payload, relative_path)

    if game_version is None:
        raise ManifestGenerationError("game_version_missing")
    return {
        "sourceRepository": repository_url,
        "branch": branch,
        "commitSha": commit_sha,
        "commitDate": commit_date,
        "gameVersion": game_version,
        "retrievedAt": retrieved_at,
        "retrievalMethod": retrieval_method,
        "files": records,
        "manifestSchemaVersion": manifest_schema_version,
    }


def encode_manifest(manifest: dict[str, Any]) -> bytes:
    return (json.dumps(
        manifest,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        allow_nan=False,
    ) + "\n").encode("utf-8")


def ensure_output_outside_source_root(output_path: Path, source_root: Path) -> None:
    output = output_path.resolve(strict=False)
    root = source_root.resolve(strict=True)
    try:
        output.relative_to(root)
    except ValueError:
        return
    raise ManifestGenerationError("output manifest must be outside source root")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--repository-url", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--commit-sha", required=True)
    parser.add_argument("--retrieval-method", choices=RETRIEVAL_METHODS, required=True)
    parser.add_argument("--file-list", type=Path, required=True)
    parser.add_argument("--retrieved-at", required=True)
    parser.add_argument("--commit-date")
    parser.add_argument("--manifest-schema-version", default=MANIFEST_SCHEMA_VERSION)
    parser.add_argument("--game-version-path", default="js/00-data.js")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    try:
        ensure_output_outside_source_root(args.output, args.source_root)
        manifest = build_manifest(
            source_root=args.source_root,
            repository_url=args.repository_url,
            branch=args.branch,
            commit_sha=args.commit_sha,
            retrieval_method=args.retrieval_method,
            file_paths=read_file_list(args.file_list),
            retrieved_at=args.retrieved_at,
            commit_date=args.commit_date,
            manifest_schema_version=args.manifest_schema_version,
            game_version_path=args.game_version_path,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(encode_manifest(manifest))
    except (ManifestGenerationError, OSError) as exc:
        parser.exit(1, f"error: {exc}\n")
    print(json.dumps({"written": str(args.output), "files": len(manifest["files"]), "gameVersion": manifest["gameVersion"]}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
