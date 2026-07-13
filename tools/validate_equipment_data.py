#!/usr/bin/env python3
"""Validate Equipment E3-B schema, scope, relations, diagnostics and bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from generate_equipment_data import (
    BASE_STATS, CLASSES, DEFAULT_OUTPUT, ROOT, TOP_LEVEL_FIELDS, canonical_bytes,
    extract_program_sources, generate, load, relation_sort_key,
)

DEFAULT_SCHEMAS = ROOT / "schemas"
FILES = ("equipments.json", "diagnostics.json", "unresolved.json")
GROUPS = {"weapon", "armor", "accessory"}
WEAPON_TYPES = {"one_hand_sword", "two_hand_sword", "dagger", "blunt", "two_hand_blunt", "spear", "two_hand_spear", "bow", "crossbow", "staff", "claw", "dual_blade", "chain_sword", "kiringku", "other_weapon"}
ARMOR_TYPES = {"armor", "helmet", "cloak", "gloves", "boots", "tshirt", "greaves", "shield"}
ACCESSORY_TYPES = {"necklace", "earring", "belt", "ring"}
TYPES = WEAPON_TYPES | ARMOR_TYPES | ACCESSORY_TYPES
SLOTS = {"weapon", "arrow", "armor", "helmet", "cloak", "gloves", "boots", "tshirt", "greaves", "shield", "necklace", "earring", "belt", "ring", "pet_weapon", "pet_armor"}
TYPE_GROUP = {**{x: "weapon" for x in WEAPON_TYPES}, **{x: "armor" for x in ARMOR_TYPES}, **{x: "accessory" for x in ACCESSORY_TYPES}}
WINDOWS_ABSOLUTE = re.compile(r"(?:^|[^A-Za-z0-9_])[A-Za-z]:[\\/]")


class ValidationError(RuntimeError):
    pass


def require(condition: bool, diagnostic: str, detail: str) -> None:
    if not condition:
        raise ValidationError(f"{diagnostic}: {detail}")


def schema_validate(record: dict[str, Any], schema: dict[str, Any]) -> None:
    errors = sorted(Draft202012Validator(schema).iter_errors(record), key=lambda error: list(error.path))
    if not errors:
        return
    error = errors[0]
    path = ".".join(str(value) for value in error.path)
    if "baseStats" in path or "baseStats" in error.message:
        code = "invalid_base_stat"
    elif "equipmentGroup" in path:
        code = "invalid_equipment_group"
    elif "equipmentType" in path:
        code = "invalid_equipment_type"
    elif path == "slot":
        code = "invalid_equipment_slot"
    elif "baseClasses" in path:
        code = "invalid_equipment_class"
    else:
        code = "equipment_schema_failed"
    raise ValidationError(f"{code}: {path}: {error.message}")


def unique(records: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for record in records:
        value = record[key]
        require(value not in result, "duplicate_equipment_id", value)
        result[value] = record
    return result


def expected_relations(source_root: Path, allow_ids: set[str]) -> tuple[dict[str, list[dict[str, Any]]], set[str], dict[str, tuple[str, str]]]:
    expected: dict[str, list[dict[str, Any]]] = defaultdict(list)
    recipe_ids: set[str] = set()
    drop_entries: dict[str, tuple[str, str]] = {}
    for table in load(source_root / "data" / "monster" / "drop_tables.json")["records"]:
        owner = table["owner"]
        for entry in table["entries"]:
            entry_id = entry["dropEntryId"]
            drop_entries[entry_id] = (owner["entityType"], owner["entityId"])
            equipment_id = entry["itemRef"]["entityId"]
            if equipment_id in allow_ids:
                expected[equipment_id].append({
                    "relationType": "monster_drop", "relationRef": entry["entityRef"],
                    "target": owner, "status": "resolved",
                })
    for recipe in load(source_root / "data" / "craft" / "recipes.json"):
        recipe_ids.add(recipe["id"])
        recipe_ref = {"entityType": "recipe", "entityId": recipe["id"]}
        result_id = recipe["result"]["itemId"]
        if result_id in allow_ids:
            expected[result_id].append({"relationType": "craft_result", "relationRef": None, "target": recipe_ref, "status": "resolved"})
        for requirement in recipe["requirements"]:
            equipment_id = requirement["itemId"]
            if equipment_id in allow_ids:
                expected[equipment_id].append({"relationType": "craft_requirement", "relationRef": None, "target": recipe_ref, "status": "resolved"})
    for relations in expected.values():
        relations.sort(key=relation_sort_key)
    return expected, recipe_ids, drop_entries


def validate(
    data_dir: Path = DEFAULT_OUTPUT,
    schema_dir: Path = DEFAULT_SCHEMAS,
    source_root: Path = ROOT,
    check_deterministic: bool = True,
) -> dict[str, Any]:
    equipment_doc, diagnostics_doc, unresolved_doc = (load(data_dir / name) for name in FILES)
    records, diagnostics, unresolved = equipment_doc["records"], diagnostics_doc["records"], unresolved_doc["records"]
    schema = load(schema_dir / "equipment.schema.json")
    allow = load(source_root / "fixtures" / "equipment" / "equipment-allowlist.json")["records"]
    mappings = load(source_root / "fixtures" / "equipment" / "equipment-classification-mapping.json")["resolvedMappings"]
    price_fixture = load(source_root / "fixtures" / "equipment" / "equipment-price-conflicts.json")["records"]
    program = extract_program_sources(source_root)
    raw_items = program["items"]
    allow_ids = {row["equipmentId"] for row in allow}
    mapping_by_id = {row["equipmentId"]: row for row in mappings}

    require(len(records) == 786, "invalid_equipment_count", str(len(records)))
    by_id = unique(records, "equipmentId")
    require(set(by_id) == allow_ids, "equipment_allowlist_mismatch", "formal Dataset differs from E3-A allowlist")
    expected, recipe_ids, drop_entries = expected_relations(source_root, allow_ids)
    wiki_categories = {row["id"]: row.get("category") for row in program["wiki"]}
    require(all(wiki_categories.get(equipment_id) == "equipment" for equipment_id in by_id), "equipment_allowlist_mismatch", "SkillBook, Doll or remains record found")
    require(records == sorted(records, key=lambda row: row["equipmentId"]), "unstable_equipment_output", "equipment record order")
    require(diagnostics == sorted(diagnostics, key=lambda row: (row["equipmentId"], row["code"], row["id"])), "unstable_equipment_output", "diagnostic order")

    provenance_fields = set(TOP_LEVEL_FIELDS) - {"verification"}
    for record in records:
        equipment_id = record["equipmentId"]
        raw = raw_items[equipment_id]
        schema_validate(record, schema)
        require(set(record) == set(TOP_LEVEL_FIELDS), "equipment_schema_failed", f"20-field ceiling: {equipment_id}")
        require(record["displayName"] == raw["n"] and record["itemType"] == raw["type"], "equipment_allowlist_mismatch", f"canonical identity projection: {equipment_id}")
        require(record["entityRef"] == {"entityType": "equipment", "entityId": equipment_id}, "invalid_equipment_entity_ref", equipment_id)
        require(record["equipmentGroup"] in GROUPS, "invalid_equipment_group", equipment_id)
        require(record["equipmentType"] in TYPES and TYPE_GROUP[record["equipmentType"]] == record["equipmentGroup"], "invalid_equipment_type", equipment_id)
        require(record["slot"] in SLOTS, "invalid_equipment_slot", equipment_id)
        expected_group = {"wpn": "weapon", "arm": "armor", "acc": "accessory"}.get(record["itemType"])
        require(expected_group == record["equipmentGroup"], "invalid_equipment_group", equipment_id)
        mapping = mapping_by_id[equipment_id]
        require((record["equipmentGroup"], record["equipmentType"], record["slot"]) == (mapping["equipmentGroup"], mapping["equipmentType"], mapping["slot"]), "equipment_allowlist_mismatch", f"classification: {equipment_id}")

        classes = record["classRequirements"]["baseClasses"]
        require(classes is None or all(value in CLASSES for value in classes), "invalid_equipment_class", equipment_id)
        if "req" not in raw:
            require(classes is None and record["classRequirements"]["status"] == "unresolved", "invalid_class_requirement_semantics", equipment_id)
        elif raw["req"] == "all":
            require(classes == list(CLASSES), "invalid_class_requirement_semantics", equipment_id)
        else:
            require(classes == sorted(set(raw["req"].split(","))), "invalid_class_requirement_semantics", equipment_id)

        require(set(record["baseStats"]) == set(BASE_STATS), "invalid_base_stat", equipment_id)
        for stat, value in record["baseStats"].items():
            if stat in raw:
                state = "explicit_zero" if raw[stat] == 0 else "explicit"
                require(value["value"] == raw[stat] and value["valueState"] == state, "invalid_base_stat", f"{equipment_id}.{stat}")
            elif stat in {"dmgS", "dmgL"} and raw["type"] != "wpn":
                require(value["value"] is None and value["valueState"] == "not_applicable", "invalid_base_stat", f"{equipment_id}.{stat}")
            else:
                require(value["value"] is None and value["valueState"] == "unresolved", "invalid_base_stat", f"{equipment_id}.{stat}")

        safe = record["safeEnhance"]
        if raw.get("noEnhance") is True:
            require(safe["enhanceable"] is False and safe["safeLevel"] is None and safe["maxLevel"] is None, "invalid_safe_semantics", equipment_id)
        elif "safe" in raw:
            require(safe["enhanceable"] is True and safe["safeLevel"] == raw["safe"] and safe["maxLevel"] == raw.get("maxEn"), "invalid_safe_semantics", equipment_id)
        else:
            require(safe["enhanceable"] is None and safe["safeLevel"] is None, "invalid_safe_semantics", equipment_id)

        require(record["price"]["amount"] == raw.get("p"), "equipment_price_conflict_missing", equipment_id)
        canonical_text = record["description"]["canonicalText"]
        require(canonical_text == (raw.get("d") or None), "equipment_schema_failed", f"description source: {equipment_id}")
        require(canonical_text is None or ("onclick" not in canonical_text.lower() and "<" not in canonical_text and ">" not in canonical_text), "equipment_schema_failed", f"description HTML: {equipment_id}")
        require(provenance_fields.issubset(record["verification"]["fields"]), "missing_field_provenance", equipment_id)
        require(record["relations"] == sorted(record["relations"], key=relation_sort_key), "unstable_equipment_output", f"relations: {equipment_id}")
        require(record["relations"] == expected.get(equipment_id, []), "invalid_relation_ref", f"owner parity: {equipment_id}")
        for relation in record["relations"]:
            target, relation_ref = relation["target"], relation["relationRef"]
            if relation["relationType"] == "monster_drop":
                require(target["entityType"] == "monster" and relation_ref and relation_ref["entityType"] == "dropEntry", "invalid_relation_ref", equipment_id)
                require(drop_entries.get(relation_ref["entityId"]) == (target["entityType"], target["entityId"]), "invalid_relation_ref", equipment_id)
            elif relation["relationType"] in {"craft_result", "craft_requirement"}:
                require(relation_ref is None and target["entityType"] == "recipe" and target["entityId"] in recipe_ids, "invalid_relation_ref", equipment_id)
            else:
                require(False, "invalid_relation_ref", relation["relationType"])

    require(not all(record["status"] == "complete" for record in records), "unstable_equipment_output", "all records marked complete")
    price_ids = {row["equipmentId"] for row in price_fixture}
    require(len({row["id"] for row in diagnostics}) == len(diagnostics), "duplicate_equipment_id", "duplicate diagnostic ID")
    price_diags = {row["equipmentId"] for row in diagnostics if row["code"] == "equipment_price_conflict"}
    precedence_diags = {row["equipmentId"] for row in diagnostics if row["code"] == "equipment_source_precedence_conflict"}
    require(price_diags == price_ids and precedence_diags == price_ids, "equipment_price_conflict_missing", "expected five price and precedence diagnostics")
    require(unresolved == [row for row in diagnostics if row["status"] == "unresolved"], "unresolved_fake_target", "unresolved subset mismatch")
    for row in unresolved:
        fake = any(isinstance(value, dict) and "entityType" in value for value in row["candidates"])
        require("target" not in row and not fake, "unresolved_fake_target", row["id"])
    require(diagnostics_doc["summary"] == dict(sorted(Counter(row["code"] for row in diagnostics).items())), "unstable_equipment_output", "diagnostic summary")
    require(unresolved_doc["summary"] == dict(sorted(Counter(row["code"] for row in unresolved).items())), "unstable_equipment_output", "unresolved summary")

    hashes: dict[str, str] = {}
    for name in FILES:
        path = data_dir / name
        raw = path.read_bytes()
        require(not raw.startswith(b"\xef\xbb\xbf") and b"\r\n" not in raw and raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "unstable_equipment_output", f"encoding/newline: {name}")
        require(raw == canonical_bytes(load(path)), "unstable_equipment_output", f"canonical bytes: {name}")
        text = raw.decode("utf-8")
        require(not WINDOWS_ABSOLUTE.search(text) and "file://" not in text.lower() and "localhost" not in text.lower() and "127.0.0.1" not in text, "local_path_leak", name)
        hashes[name] = hashlib.sha256(raw).hexdigest()

    if check_deterministic:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            generate(source_root, Path(first))
            generate(source_root, Path(second))
            for name in FILES:
                current = (data_dir / name).read_bytes()
                require((Path(first) / name).read_bytes() == (Path(second) / name).read_bytes() == current, "unstable_equipment_output", f"checked-in parity: {name}")

    relation_counts = Counter(relation["relationType"] for record in records for relation in record["relations"])
    return {
        "equipment": len(records), "diagnostics": len(diagnostics), "unresolved": len(unresolved),
        "relations": dict(sorted(relation_counts.items())), "schema": "passed", "validator": "passed",
        "byteStable": check_deterministic, "sha256": hashes,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMAS)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--skip-deterministic", action="store_true")
    args = parser.parse_args()
    try:
        result = validate(args.data_dir, args.schema_dir, args.source_root, not args.skip_deterministic)
    except (ValidationError, OSError, ValueError, RuntimeError, KeyError, json.JSONDecodeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
