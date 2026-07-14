#!/usr/bin/env python3
"""Generate a deterministic semantic diff between approved and candidate datasets."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePath
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DIFF_VERSION = "1.0.0"
FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
MISSING = object()
DOMAIN_ORDER = ("monster", "map", "drop", "equipment")


class DiffGenerationError(RuntimeError):
    pass


@dataclass(frozen=True)
class DomainSpec:
    entity_type: str
    identity: str
    paths: tuple[str, ...]
    unresolved_paths: tuple[str, ...] = ()


DOMAIN_SPECS = {
    "monster": DomainSpec("monster", "monsterId", ("monster/monsters.json", "monsters.json"), ("monster/unresolved.json", "monster-unresolved.json")),
    "map": DomainSpec("map", "mapId", ("monster/maps.json", "maps.json")),
    "drop": DomainSpec("dropTable", "dropTableId", ("monster/drop_tables.json", "drop_tables.json")),
    "equipment": DomainSpec("equipment", "equipmentId", ("equipment/equipments.json", "equipments.json"), ("equipment/unresolved.json", "equipment-unresolved.json")),
}

TECHNICAL_ROOTS = {"verification", "version", "provenance", "source", "sourceLocation", "evidence", "deterministicLocator"}
DISPLAY_ROOTS = {"displayName", "description", "editorialLabel", "sortOrder"}
RELATION_ROOTS = {
    "mapRef", "mapRefs", "dropTableRef", "relations", "monsterRefs", "bossRefs",
    "skillRefs", "setRefs", "mechanicRefs", "cardRef", "owner", "itemRef", "entries",
}
SET_ARRAY_FIELDS = {
    "aliases", "mapRef", "mapRefs", "relations", "monsterRefs", "bossRefs", "skillRefs",
    "setRefs", "mechanicRefs", "conditions", "runtimeModifiers", "baseClasses",
}
CLASSIFICATION_FIELDS = {"itemType", "equipmentGroup", "equipmentType", "slot", "classRequirements", "rarity"}


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def safe_cli_path(raw: str, label: str) -> Path:
    if "\x00" in raw or any(part == ".." for part in PurePath(raw.replace("\\", "/")).parts):
        raise DiffGenerationError(f"unsafe_path:{label}")
    return Path(raw).expanduser().resolve()


def validate_sha(value: str, label: str) -> None:
    if not FULL_SHA.fullmatch(value):
        raise DiffGenerationError(f"invalid_full_sha:{label}")


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DiffGenerationError(f"invalid_json:{path.name}:{error}") from error


def locate(root: Path, candidates: tuple[str, ...], required: bool = True) -> Path | None:
    for candidate in candidates:
        path = (root / candidate).resolve()
        if path.is_file():
            return path
    if required:
        raise DiffGenerationError(f"dataset_missing:{candidates[0]}")
    return None


def input_label(root: Path, path: Path, candidates: tuple[str, ...]) -> str:
    for candidate in candidates:
        expected = root / candidate
        if expected.is_file() and expected.resolve() == path:
            return candidate
    raise DiffGenerationError(f"dataset_path_not_in_inventory:{path.name}")


def records_from(path: Path) -> list[dict[str, Any]]:
    value = load_json(path)
    records = value.get("records") if isinstance(value, dict) else value
    if not isinstance(records, list) or not all(isinstance(item, dict) for item in records):
        raise DiffGenerationError(f"invalid_dataset_root:{path.name}")
    return records


def index_records(records: list[dict[str, Any]], identity: str, domain: str, diagnostics: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for position, record in enumerate(records):
        entity_id = record.get(identity)
        if not isinstance(entity_id, str) or not entity_id:
            diagnostics.append({
                "code": "formal_identity_missing", "domain": domain, "blocking": True,
                "message": f"Record {position} has no valid {identity}; displayName was not used as identity.",
            })
            continue
        if entity_id in result:
            raise DiffGenerationError(f"duplicate_entity_id:{domain}:{entity_id}")
        result[entity_id] = record
    return result


def diagnostic_id(record: dict[str, Any]) -> str:
    value = record.get("id")
    if isinstance(value, str) and value:
        return value
    ref = record.get("entityRef") or {}
    parts = [record.get("code"), ref.get("entityType"), ref.get("entityId"), record.get("fieldPath")]
    if not all(value is None or isinstance(value, str) for value in parts):
        raise DiffGenerationError("invalid_unresolved_identity")
    key = "|".join(value or "" for value in parts)
    if not key.strip("|"):
        raise DiffGenerationError("unresolved_identity_missing")
    return key


def index_diagnostics(records: list[dict[str, Any]], domain: str) -> dict[str, dict[str, Any]]:
    result = {}
    for record in records:
        key = diagnostic_id(record)
        if key in result:
            raise DiffGenerationError(f"duplicate_unresolved_id:{domain}:{key}")
        result[key] = record
    return result


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def array_identity(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("dropEntryId", "relationId", "id"):
            if isinstance(value.get(key), str):
                return f"{key}:{value[key]}"
        if isinstance(value.get("entityType"), str) and isinstance(value.get("entityId"), str):
            return f"ref:{value['entityType']}:{value['entityId']}"
    return stable_json(value)


def category_for(path: tuple[str, ...]) -> str:
    root = path[0] if path else ""
    if root in TECHNICAL_ROOTS:
        return "verification"
    if root in DISPLAY_ROOTS:
        return "display"
    if root in RELATION_ROOTS:
        return "relation"
    return "canonical"


def display_path(path: tuple[str, ...]) -> str:
    return "/" + "/".join(path)


def exposed(value: Any) -> Any:
    return {"state": "missing"} if value is MISSING else value


def compare_values(approved: Any, candidate: Any, path: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    if approved is not MISSING and candidate is not MISSING and type(approved) is type(candidate) and approved == candidate:
        return []
    if isinstance(approved, dict) and isinstance(candidate, dict):
        changes: list[dict[str, Any]] = []
        for key in sorted(set(approved) | set(candidate)):
            changes.extend(compare_values(approved.get(key, MISSING), candidate.get(key, MISSING), path + (key,)))
        return changes
    if isinstance(approved, list) and isinstance(candidate, list):
        field = path[-1] if path else ""
        if field == "entries" or field in SET_ARRAY_FIELDS:
            approved_map: dict[str, Any] = {}
            candidate_map: dict[str, Any] = {}
            for label, values, target in (("approved", approved, approved_map), ("candidate", candidate, candidate_map)):
                for item in values:
                    key = array_identity(item)
                    if key in target:
                        raise DiffGenerationError(f"duplicate_set_member:{display_path(path)}:{label}:{key}")
                    target[key] = item
            changes = []
            for key in sorted(set(approved_map) | set(candidate_map)):
                changes.extend(compare_values(approved_map.get(key, MISSING), candidate_map.get(key, MISSING), path + (key,)))
            return changes
        if approved == candidate:
            return []
    return [{
        "path": display_path(path),
        "category": category_for(path),
        "approvedValue": exposed(approved),
        "candidateValue": exposed(candidate),
    }]


def evidence_for(record: dict[str, Any] | None) -> list[str]:
    if not record:
        return []
    verification = record.get("verification")
    values: list[str] = []
    if isinstance(verification, dict):
        for key in ("source",):
            if isinstance(verification.get(key), str):
                values.append(verification[key])
        if isinstance(verification.get("evidence"), list):
            values.extend(x for x in verification["evidence"] if isinstance(x, str))
    return sorted(set(values))


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]+", "_", value).strip("_").lower()
    return cleaned or "unresolved"


def change_record(domain: str, entity_type: str, entity_id: str, change_type: str, field_changes: list[dict[str, Any]], *, blocking: bool, review_status: str, approved: dict[str, Any] | None = None, candidate: dict[str, Any] | None = None, notes: list[str] | None = None) -> dict[str, Any]:
    return {
        "changeId": f"change_{domain}_{slug(entity_id)}_{change_type}",
        "domain": domain,
        "entityType": entity_type,
        "entityId": entity_id,
        "changeType": change_type,
        "fieldChanges": sorted(field_changes, key=lambda item: item["path"]),
        "reviewStatus": review_status,
        "blocking": blocking,
        "evidence": sorted(set(evidence_for(approved) + evidence_for(candidate))),
        "notes": notes or [],
    }


def classify_modified(domain: str, changes: list[dict[str, Any]]) -> tuple[str, bool, str]:
    categories = {item["category"] for item in changes}
    roots = {item["path"].split("/")[1] for item in changes if item["path"].startswith("/")}
    if categories <= {"verification"}:
        return "technical_only", False, "auto_verified"
    if categories <= {"display"}:
        return "display_only", False, "review_required"
    if categories <= {"relation", "verification"}:
        return "relation_changed", False, "review_required"
    if domain == "equipment" and roots & CLASSIFICATION_FIELDS:
        return "modified", False, "review_required"
    return "modified", False, "review_required"


def is_conflict(record: dict[str, Any]) -> bool:
    code = str(record.get("code", "")).lower()
    status = str(record.get("status", "")).lower()
    candidates = record.get("candidates")
    return "conflict" in code or status == "conflict" or (isinstance(candidates, list) and len(candidates) > 1 and bool(record.get("blocking")))


def unresolved_blocking(record: dict[str, Any]) -> bool:
    if bool(record.get("blocking")):
        return True
    code = str(record.get("code", "")).lower()
    field = str(record.get("fieldPath", "")).lower()
    return any(token in code or token in field for token in ("identity", "relation", "owner"))


def compare_domain(domain: str, approved_root: Path, candidate_root: Path, generated_diagnostics: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str], list[str]]:
    spec = DOMAIN_SPECS[domain]
    approved_path = locate(approved_root, spec.paths)
    candidate_path = locate(candidate_root, spec.paths)
    assert approved_path and candidate_path
    approved = index_records(records_from(approved_path), spec.identity, domain, generated_diagnostics)
    candidate = index_records(records_from(candidate_path), spec.identity, domain, generated_diagnostics)
    buckets: dict[str, list[dict[str, Any]]] = {key: [] for key in ("added", "removed", "modified", "unresolvedAdded", "unresolvedResolved", "conflicts", "technicalOnly")}
    unchanged = 0

    for entity_id in sorted(set(approved) | set(candidate)):
        before, after = approved.get(entity_id), candidate.get(entity_id)
        if before is None:
            buckets["added"].append(change_record(domain, spec.entity_type, entity_id, "added", [], blocking=False, review_status="auto_verified", candidate=after))
        elif after is None:
            blocking = domain == "equipment"
            buckets["removed"].append(change_record(domain, spec.entity_type, entity_id, "removed", [], blocking=blocking, review_status="blocked" if blocking else "review_required", approved=before, notes=["Removal requires coverage and source-scope review before publication."]))
        else:
            changes = compare_values(before, after)
            if not changes:
                unchanged += 1
                continue
            change_type, blocking, review_status = classify_modified(domain, changes)
            target = "technicalOnly" if change_type == "technical_only" else "modified"
            buckets[target].append(change_record(domain, spec.entity_type, entity_id, change_type, changes, blocking=blocking, review_status=review_status, approved=before, candidate=after))

    approved_input_paths = [input_label(approved_root, approved_path, spec.paths)]
    candidate_input_paths = [input_label(candidate_root, candidate_path, spec.paths)]
    if spec.unresolved_paths:
        approved_unresolved_path = locate(approved_root, spec.unresolved_paths, required=False)
        candidate_unresolved_path = locate(candidate_root, spec.unresolved_paths, required=False)
        if approved_unresolved_path:
            approved_input_paths.append(input_label(approved_root, approved_unresolved_path, spec.unresolved_paths))
        if candidate_unresolved_path:
            candidate_input_paths.append(input_label(candidate_root, candidate_unresolved_path, spec.unresolved_paths))
        approved_unresolved = index_diagnostics(records_from(approved_unresolved_path), domain) if approved_unresolved_path else {}
        candidate_unresolved = index_diagnostics(records_from(candidate_unresolved_path), domain) if candidate_unresolved_path else {}
        for key in sorted(set(approved_unresolved) | set(candidate_unresolved)):
            before, after = approved_unresolved.get(key), candidate_unresolved.get(key)
            if before is None and after is not None:
                if is_conflict(after):
                    buckets["conflicts"].append(change_record(domain, spec.entity_type, key, "conflict", [], blocking=True, review_status="blocked", candidate=after, notes=["Multiple formal targets exist; no target was selected automatically."]))
                else:
                    blocking = unresolved_blocking(after)
                    buckets["unresolvedAdded"].append(change_record(domain, spec.entity_type, key, "unresolved_added", [], blocking=blocking, review_status="blocked" if blocking else "review_required", candidate=after))
            elif before is not None and after is None:
                buckets["unresolvedResolved"].append(change_record(domain, spec.entity_type, key, "unresolved_resolved", [], blocking=False, review_status="review_required", approved=before, notes=["The original unresolved identity or field path is retained by change identity."]))
            elif before != after:
                changes = compare_values(before, after)
                buckets["modified"].append(change_record(domain, spec.entity_type, key, "modified", changes, blocking=unresolved_blocking(after or {}), review_status="blocked" if unresolved_blocking(after or {}) else "review_required", approved=before, candidate=after))

    for values in buckets.values():
        values.sort(key=lambda item: item["changeId"])
    result = {
        "domain": domain,
        "entityType": spec.entity_type,
        "approvedCount": len(approved),
        "candidateCount": len(candidate),
        **buckets,
        "unchangedCount": unchanged,
    }
    return result, approved_input_paths, candidate_input_paths


def all_changes(domains: list[dict[str, Any]]) -> list[dict[str, Any]]:
    keys = ("added", "removed", "modified", "unresolvedAdded", "unresolvedResolved", "conflicts", "technicalOnly")
    return [record for domain in domains for key in keys for record in domain[key]]


def build_summary(domains: list[dict[str, Any]], diagnostics: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    diagnostics = diagnostics or []
    changes = all_changes(domains)
    summary = {
        "totalAdded": sum(x["changeType"] == "added" for x in changes),
        "totalRemoved": sum(x["changeType"] == "removed" for x in changes),
        "totalModified": sum(x["changeType"] in {"modified", "display_only", "data_corrected"} for x in changes),
        "totalRelationChanged": sum(x["changeType"] == "relation_changed" for x in changes),
        "totalUnresolvedAdded": sum(x["changeType"] == "unresolved_added" for x in changes),
        "totalUnresolvedResolved": sum(x["changeType"] == "unresolved_resolved" for x in changes),
        "totalConflicts": sum(x["changeType"] == "conflict" for x in changes),
        "totalBlocking": sum(bool(x["blocking"]) for x in changes) + sum(bool(x["blocking"]) for x in diagnostics),
        "totalReviewRequired": sum(x["reviewStatus"] in {"review_required", "blocked"} for x in changes),
        "perDomain": [],
    }
    for domain in domains:
        domain_changes = all_changes([domain])
        summary["perDomain"].append({
            "domain": domain["domain"],
            "added": sum(x["changeType"] == "added" for x in domain_changes),
            "removed": sum(x["changeType"] == "removed" for x in domain_changes),
            "modified": sum(x["changeType"] in {"modified", "display_only", "data_corrected"} for x in domain_changes),
            "relationChanged": sum(x["changeType"] == "relation_changed" for x in domain_changes),
            "unresolvedAdded": sum(x["changeType"] == "unresolved_added" for x in domain_changes),
            "unresolvedResolved": sum(x["changeType"] == "unresolved_resolved" for x in domain_changes),
            "conflicts": sum(x["changeType"] == "conflict" for x in domain_changes),
            "blocking": sum(bool(x["blocking"]) for x in domain_changes) + sum(bool(x["blocking"]) and x["domain"] == domain["domain"] for x in diagnostics),
            "technicalOnly": sum(x["changeType"] == "technical_only" for x in domain_changes),
        })
    return summary


def generate_diff(approved_root: Path, candidate_root: Path, approved_version: str, candidate_version: str, approved_sha: str, candidate_sha: str, domains: list[str]) -> dict[str, Any]:
    validate_sha(approved_sha, "approved")
    validate_sha(candidate_sha, "candidate")
    if not approved_root.is_dir() or not candidate_root.is_dir():
        raise DiffGenerationError("dataset_root_missing")
    if len(domains) != len(set(domains)) or any(domain not in DOMAIN_SPECS for domain in domains):
        raise DiffGenerationError("invalid_domain_vocabulary")
    ordered = [domain for domain in DOMAIN_ORDER if domain in domains]
    diagnostics: list[dict[str, Any]] = []
    domain_results, approved_files, candidate_files = [], [], []
    for domain in ordered:
        result, old_files, new_files = compare_domain(domain, approved_root, candidate_root, diagnostics)
        domain_results.append(result)
        approved_files.extend(old_files)
        candidate_files.extend(new_files)
    changes = all_changes(domain_results)
    blocking_ids = sorted(record["changeId"] for record in changes if record["blocking"])
    blocking_diagnostic_codes = sorted({item["code"] for item in diagnostics if item["blocking"]})
    review_required = any(record["reviewStatus"] in {"review_required", "blocked"} for record in changes)
    return {
        "diffVersion": DIFF_VERSION,
        "approvedVersion": approved_version,
        "candidateVersion": candidate_version,
        "approvedSourceRevision": approved_sha,
        "candidateSourceRevision": candidate_sha,
        "generatedFrom": {
            "approvedFiles": sorted(set(approved_files)),
            "candidateFiles": sorted(set(candidate_files)),
        },
        "domains": domain_results,
        "summary": build_summary(domain_results, diagnostics),
        "review": {
            "status": "blocked" if blocking_ids or blocking_diagnostic_codes else ("review_required" if review_required else "auto_verified"),
            "humanReviewRequired": review_required or bool(blocking_diagnostic_codes),
            "blockingChangeIds": blocking_ids,
            "blockingDiagnosticCodes": blocking_diagnostic_codes,
        },
        "diagnostics": sorted(diagnostics, key=lambda item: (item["domain"], item["code"], item["message"])),
    }


def ensure_output_safe(output: Path, inputs: list[Path]) -> None:
    if any(output == path.resolve() for path in inputs):
        raise DiffGenerationError("output_matches_input")
    if output.exists() and output.is_dir():
        raise DiffGenerationError("output_is_directory")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approved-root", required=True)
    parser.add_argument("--candidate-root", required=True)
    parser.add_argument("--approved-version", required=True)
    parser.add_argument("--candidate-version", required=True)
    parser.add_argument("--approved-source-sha", required=True)
    parser.add_argument("--candidate-source-sha", required=True)
    parser.add_argument("--domains", default=",".join(DOMAIN_ORDER))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        approved_root = safe_cli_path(args.approved_root, "approved_root")
        candidate_root = safe_cli_path(args.candidate_root, "candidate_root")
        output = safe_cli_path(args.output, "output")
        domains = [item.strip() for item in args.domains.split(",") if item.strip()]
        value = generate_diff(approved_root, candidate_root, args.approved_version, args.candidate_version, args.approved_source_sha, args.candidate_source_sha, domains)
        inputs: list[Path | None] = []
        for root in (approved_root, candidate_root):
            for domain in domains:
                spec = DOMAIN_SPECS[domain]
                inputs.append(locate(root, spec.paths))
                if spec.unresolved_paths:
                    inputs.append(locate(root, spec.unresolved_paths, required=False))
        ensure_output_safe(output, [path for path in inputs if path])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(canonical_bytes(value))
    except (DiffGenerationError, OSError, ValueError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps({"output": output.name, "domains": domains, "summary": value["summary"]}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
