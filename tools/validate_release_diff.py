#!/usr/bin/env python3
"""Validate a machine-readable semantic release diff."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from generate_release_diff import DOMAIN_ORDER, all_changes, build_summary, canonical_bytes


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = ROOT / "schemas" / "semantic-release-diff.schema.json"
LOCAL_PATH = re.compile(r"(?:[A-Za-z]:[\\/]|file://|localhost|127\.0\.0\.1)", re.IGNORECASE)


class DiffValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise DiffValidationError(message)


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_diff(value: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: list(error.path))
    if errors:
        details = "\n".join(f"{list(error.path)}: {error.message}" for error in errors[:20])
        raise DiffValidationError(f"schema_failed:\n{details}")
    domains = value["domains"]
    require([item["domain"] for item in domains] == [name for name in DOMAIN_ORDER if name in {x["domain"] for x in domains}], "domains_not_deterministically_ordered")
    require(len({item["domain"] for item in domains}) == len(domains), "duplicate_domain")
    changes = all_changes(domains)
    change_ids = [item["changeId"] for item in changes]
    require(len(change_ids) == len(set(change_ids)), "duplicate_change_id")
    allowed_status = {"auto_verified", "review_required", "blocked"}
    for domain in domains:
        for key in ("added", "removed", "modified", "unresolvedAdded", "unresolvedResolved", "conflicts", "technicalOnly"):
            values = domain[key]
            require(values == sorted(values, key=lambda item: item["changeId"]), f"nondeterministic_order:{domain['domain']}:{key}")
        for record in all_changes([domain]):
            require(bool(record["entityId"]), f"entity_id_missing:{record['changeId']}")
            require(record["reviewStatus"] in allowed_status, f"invalid_generated_review_status:{record['changeId']}")
            require(record["blocking"] == (record["reviewStatus"] == "blocked"), f"blocking_review_mismatch:{record['changeId']}")
            if record["changeType"] == "conflict":
                require(record["blocking"] and record["reviewStatus"] == "blocked", f"conflict_not_blocked:{record['changeId']}")
            if record["changeType"] in {"modified", "relation_changed", "technical_only", "display_only", "data_corrected"}:
                require(bool(record["fieldChanges"]), f"modified_without_field_changes:{record['changeId']}")
            if record["changeType"] == "added":
                require(all("approvedValue" not in item for item in record["fieldChanges"]), f"added_has_old_value:{record['changeId']}")
            if record["changeType"] == "removed":
                require(all("candidateValue" not in item for item in record["fieldChanges"]), f"removed_has_new_value:{record['changeId']}")
            if record["changeType"] == "technical_only":
                require(all(item["category"] in {"technical", "verification"} for item in record["fieldChanges"]), f"technical_only_has_semantic_change:{record['changeId']}")
    require(value["summary"] == build_summary(domains, value["diagnostics"]), "summary_mismatch")
    blocking_ids = sorted(item["changeId"] for item in changes if item["blocking"])
    require(value["review"]["blockingChangeIds"] == blocking_ids, "blocking_summary_mismatch")
    blocking_diagnostic_codes = sorted({item["code"] for item in value["diagnostics"] if item["blocking"]})
    require(value["review"]["blockingDiagnosticCodes"] == blocking_diagnostic_codes, "blocking_diagnostic_summary_mismatch")
    expected_status = "blocked" if blocking_ids or blocking_diagnostic_codes else ("review_required" if any(item["reviewStatus"] == "review_required" for item in changes) else "auto_verified")
    require(value["review"]["status"] == expected_status, "review_status_mismatch")
    require(value["review"]["humanReviewRequired"] == (bool(blocking_diagnostic_codes) or any(item["reviewStatus"] in {"review_required", "blocked"} for item in changes)), "human_review_flag_mismatch")
    require(not LOCAL_PATH.search(json.dumps(value, ensure_ascii=False)), "local_path_detected")
    return {"valid": True, "domains": len(domains), "changes": len(changes), "blocking": len(blocking_ids)}


def validate_file(path: Path, schema_path: Path = DEFAULT_SCHEMA) -> dict[str, Any]:
    raw = path.read_bytes()
    require(not raw.startswith(b"\xef\xbb\xbf"), "utf8_bom_not_allowed")
    require(b"\r" not in raw, "line_endings_must_be_lf")
    require(raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "single_final_newline_required")
    value = json.loads(raw.decode("utf-8"))
    require(raw == canonical_bytes(value), "noncanonical_json_bytes")
    return validate_diff(value, load(schema_path))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    args = parser.parse_args()
    try:
        result = validate_file(args.input.resolve(), args.schema.resolve())
    except (DiffValidationError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
