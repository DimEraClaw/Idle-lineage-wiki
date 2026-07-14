#!/usr/bin/env python3
"""Validate the stable upstream Source Inventory fixture."""

from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "fixtures" / "releases" / "upstream-source-inventory-v1.json"
DEFAULT_SCHEMA = ROOT / "schemas" / "release-source-inventory.schema.json"
EXPECTED_PATHS = (
    "index.html",
    "js/00-data.js",
    "js/01-drops-config.js",
    "js/02-stats-recompute.js",
    "js/03-combat-core.js",
    "js/04-combat-attack.js",
    "js/05-kill-progression.js",
    "js/06-status-allies.js",
    "js/07-skills-cast.js",
    "js/08-items-equip.js",
    "js/10-ui-tabs.js",
    "js/11-world-map.js",
    "js/14-craft-pandora.js",
    "js/15-cards.js",
    "js/19-equipment-window.js",
)
FORBIDDEN_KEYS = {"commitSha", "commitDate", "gameVersion", "retrievedAt", "sha256", "sourceRevision"}
LOCAL_PATH = re.compile(r"(?:(?<![A-Za-z])[A-Za-z]:[\\/](?![\\/])|file://|localhost|127\.0\.0\.1)", re.IGNORECASE)
FULL_SHA_VALUE = re.compile(r"^[0-9a-f]{40}$")
TIMESTAMP_VALUE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


class InventoryValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise InventoryValidationError(message)


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def canonicalize(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result["domains"] = sorted(result["domains"])
    for record in result["files"]:
        record["domains"] = sorted(record["domains"])
    result["files"] = sorted(result["files"], key=lambda record: record["path"])
    return result


def encode_inventory(value: dict[str, Any]) -> bytes:
    return (json.dumps(canonicalize(value), ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def walk(value: Any):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key, item
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def validate_inventory(value: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: list(error.path))
    if errors:
        details = "\n".join(f"{list(error.path)}: {error.message}" for error in errors[:20])
        raise InventoryValidationError(f"schema_failed:\n{details}")

    paths = [record["path"] for record in value["files"]]
    require(len(paths) == 15, "inventory_must_contain_15_files")
    require(len(paths) == len(set(paths)), "duplicate_source_path")
    require(paths == sorted(paths), "source_paths_not_sorted")
    require(tuple(paths) == EXPECTED_PATHS, "source_scope_mismatch")
    require(value["domains"] == sorted(value["domains"]), "domains_not_sorted")
    require(all(record["domains"] == sorted(record["domains"]) for record in value["files"]), "file_domains_not_sorted")
    require(all(record["required"] for record in value["files"]), "full_scope_file_not_required")

    by_path = {record["path"]: record for record in value["files"]}
    data_owner = by_path["js/00-data.js"]
    require(data_owner["role"] == "canonical_owner" and data_owner["ownerType"] == "domain_owner", "monster_equipment_canonical_owner_missing")
    require(set(data_owner["domains"]) == {"equipment", "item", "map", "monster"}, "canonical_data_owner_domains_invalid")
    drop_owner = by_path["js/01-drops-config.js"]
    require(drop_owner["role"] == "canonical_owner" and drop_owner["ownerType"] == "domain_owner" and drop_owner["domains"] == ["drop"], "drop_canonical_owner_missing")
    classification_owner = by_path["js/10-ui-tabs.js"]
    require(classification_owner["role"] == "classification_owner" and classification_owner["ownerType"] == "classification_source" and "equipment" in classification_owner["domains"], "equipment_classification_owner_missing")
    require(by_path["js/11-world-map.js"]["role"] == "runtime_evidence", "map_navigation_must_be_evidence")
    require(by_path["js/14-craft-pandora.js"]["role"] == "parity_evidence", "craft_must_be_parity_evidence")
    require(by_path["index.html"]["role"] == "entrypoint_evidence", "entrypoint_evidence_missing")
    require({record["path"] for record in value["files"] if record["role"] == "canonical_owner"} == {"js/00-data.js", "js/01-drops-config.js"}, "unexpected_canonical_owner")

    role_owner = {
        "canonical_owner": "domain_owner",
        "classification_owner": "classification_source",
        "runtime_evidence": "evidence_source",
        "parity_evidence": "evidence_source",
        "entrypoint_evidence": "entrypoint",
    }
    require(all(record["ownerType"] == role_owner[record["role"]] for record in value["files"]), "role_owner_type_mismatch")
    require(all(set(record["domains"]) <= set(value["domains"]) for record in value["files"]), "file_domain_not_declared")

    serialized = json.dumps(value, ensure_ascii=False)
    require(not LOCAL_PATH.search(serialized), "local_path_detected")
    for key, item in walk(value):
        require(key not in FORBIDDEN_KEYS, f"manifest_field_not_allowed:{key}")
        if isinstance(item, str):
            require(not FULL_SHA_VALUE.fullmatch(item), "commit_sha_not_allowed")
            require(not TIMESTAMP_VALUE.match(item), "mutable_timestamp_not_allowed")

    counts = {role: sum(record["role"] == role for record in value["files"]) for role in role_owner}
    return {"valid": True, "files": len(paths), "uniquePaths": len(set(paths)), "roles": counts}


def validate_file(path: Path = DEFAULT_INPUT, schema_path: Path = DEFAULT_SCHEMA) -> dict[str, Any]:
    raw = path.read_bytes()
    require(not raw.startswith(b"\xef\xbb\xbf"), "utf8_bom_not_allowed")
    require(b"\r" not in raw, "line_endings_must_be_lf")
    require(raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "single_final_newline_required")
    value = json.loads(raw.decode("utf-8"))
    result = validate_inventory(value, load(schema_path))
    require(raw == encode_inventory(value), "inventory_bytes_not_canonical")
    result["byteStable"] = encode_inventory(value) == encode_inventory(copy.deepcopy(value))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    args = parser.parse_args()
    try:
        result = validate_file(args.input.resolve(), args.schema.resolve())
    except (InventoryValidationError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
