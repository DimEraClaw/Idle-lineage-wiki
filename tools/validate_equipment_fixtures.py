#!/usr/bin/env python3
"""Validate the fixed Equipment E3-A schemas and foundation fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURES = ROOT / "fixtures" / "equipment"
DEFAULT_SCHEMAS = ROOT / "schemas"
FIXTURE_FILES = (
    "equipment-allowlist.json",
    "equipment-source-fixture.json",
    "equipment-classification-mapping.json",
    "equipment-unresolved.example.json",
    "equipment-price-conflicts.json",
    "equipment-special-cases.json",
)
SCHEMA_FILES = (
    "equipment.schema.json",
    "equipment-source-fixture.schema.json",
    "equipment-classification-mapping.schema.json",
    "equipment-unresolved.schema.json",
)
GROUPS = {"weapon", "armor", "accessory"}
TYPES = {
    "one_hand_sword", "two_hand_sword", "dagger", "blunt", "two_hand_blunt",
    "spear", "two_hand_spear", "bow", "crossbow", "staff", "claw",
    "dual_blade", "chain_sword", "kiringku", "other_weapon", "armor",
    "helmet", "cloak", "gloves", "boots", "tshirt", "greaves", "shield",
    "necklace", "earring", "belt", "ring",
}
SLOTS = {
    "weapon", "arrow", "armor", "helmet", "cloak", "gloves", "boots",
    "tshirt", "greaves", "shield", "necklace", "earring", "belt", "ring",
    "pet_weapon", "pet_armor",
}
PRICE_IDS = {
    "relic_strong_femur", "relic_mandra_spirit", "relic_scorpion_sting",
    "relic_ska_soul", "relic_shadow_stinger",
}
SPECIAL_CASES = {
    "arrow", "pet_weapon", "pet_armor", "armguard", "two_hand_weapon",
    "offhand_shield", "ring", "earring", "bow", "crossbow", "claw",
    "dual_blade", "chain_sword", "kiringku", "no_enhance",
    "safe_explicit_zero", "safe_missing", "requirements_all",
    "requirements_missing", "explicit_slot", "derived_slot",
}
WINDOWS_ABSOLUTE = re.compile(r"(?:^|[^A-Za-z0-9_])[A-Za-z]:[\\/]")


class ValidationError(RuntimeError):
    pass


def require(condition: bool, diagnostic: str, detail: str) -> None:
    if not condition:
        raise ValidationError(f"{diagnostic}: {detail}")


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_validate(value: Any, schema_path: Path) -> None:
    errors = sorted(Draft202012Validator(load(schema_path)).iter_errors(value), key=lambda e: list(e.path))
    if errors:
        details = "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:10])
        raise ValidationError(f"schema_validation_failed: {schema_path.name}: {details}")


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def extract_sources(source_root: Path, project_root: Path | None = None) -> dict[str, Any]:
    script = r"""
const fs=require('fs'),vm=require('vm');
function ext(t,m,o,c){let p=t.indexOf(m);if(p<0)throw Error(m);p=t.indexOf(o,p);let d=0,q=null,e=false;for(let i=p;i<t.length;i++){let x=t[i];if(q){if(e)e=false;else if(x==='\\')e=true;else if(x===q)q=null;continue}if(x==='"'||x==="'"||x==='`'){q=x;continue}if(x===o)d++;else if(x===c&&--d===0)return t.slice(p,i+1)}throw Error('unclosed '+m)}
const root=process.argv[2], project=process.argv[3], a=fs.readFileSync(root+'/js/00-data.js','utf8'), w=fs.readFileSync(project+'/wiki.html','utf8');
const db=vm.runInNewContext('('+ext(a,'const DB','{','}')+')');
const wiki=JSON.parse(ext(w,'const EQUIP_DATA','[',']'));
const compact=x=>({type:x.type??null,slot:x.slot??null,isArrow:x.isArrow===true,noEnhance:x.noEnhance===true,safe:Object.prototype.hasOwnProperty.call(x,'safe')?x.safe:null,hasSafe:Object.prototype.hasOwnProperty.call(x,'safe'),maxEn:x.maxEn??null,req:x.req??null,hasReq:Object.prototype.hasOwnProperty.call(x,'req'),p:x.p??null,d:x.d??null});
console.log(JSON.stringify({dbItems:Object.fromEntries(Object.entries(db.items).map(([k,v])=>[k,compact(v)])),wiki:wiki.map(x=>({id:x.id,category:x.category,equipmentGroup:x.equipmentGroup??null,equipmentType:x.equipmentType??null,slot:x.slot??null,price:x.price??null}))}));
"""
    result = subprocess.run(
        ["node", "-", str(source_root.resolve()).replace("\\", "/"), str((project_root or ROOT).resolve()).replace("\\", "/")],
        input=script, text=True, encoding="utf-8", capture_output=True, check=False,
    )
    require(result.returncode == 0, "missing_equipment_source", result.stderr.strip() or "Node extraction failed")
    return json.loads(result.stdout)


def unique(records: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for record in records:
        value = record[key]
        require(value not in result, "duplicate_equipment_id", str(value))
        result[value] = record
    return result


def equipment_schema_probe(equipment_id: str) -> dict[str, Any]:
    stat = {"value": None, "valueState": "unresolved", "unit": None, "conceptRef": None}
    stats = {name: dict(stat) for name in (
        "dmgS", "dmgL", "hit", "dmgBonus", "ac", "mr", "er", "dr", "mhp", "mmp",
        "extraMp", "mdmg", "str", "dex", "con", "int", "wis", "cha", "resFire",
        "resWater", "resWind", "resEarth", "resNone",
    )}
    return {
        "equipmentId": equipment_id, "displayName": "schema probe", "itemType": "wpn",
        "equipmentGroup": "weapon", "equipmentType": "other_weapon", "slot": "weapon",
        "classRequirements": {"baseClasses": None, "ruleRefs": [], "status": "unresolved"},
        "rarity": None, "baseStats": stats,
        "safeEnhance": {"enhanceable": None, "safeLevel": None, "maxLevel": None, "ruleRefs": [], "status": "unresolved"},
        "price": {"amount": None, "currencyRef": None, "priceType": "base_item_price"},
        "description": {"canonicalText": None, "editorialNote": None},
        "skillRefs": [], "setRefs": [], "mechanicRefs": [], "relations": [],
        "verification": {"statuses": ["Unknown"], "fields": {}},
        "version": {"sourceRevision": None, "gameVersion": None, "schemaVersion": "1.0.0", "validFrom": None, "validTo": None},
        "status": "unresolved", "entityRef": {"entityType": "equipment", "entityId": equipment_id},
    }


def validate(
    fixture_dir: Path = DEFAULT_FIXTURES,
    schema_dir: Path = DEFAULT_SCHEMAS,
    source_root: Path = ROOT,
    program_source_root: Path | None = None,
) -> dict[str, Any]:
    docs = {name: load(fixture_dir / name) for name in FIXTURE_FILES}
    for name in FIXTURE_FILES + SCHEMA_FILES:
        path = (fixture_dir if name in FIXTURE_FILES else schema_dir) / name
        raw = path.read_bytes()
        require(not raw.startswith(b"\xef\xbb\xbf"), "unstable_fixture_order", f"UTF-8 BOM: {name}")
        require(b"\r\n" not in raw and raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "unstable_fixture_order", f"LF/single newline: {name}")
        if name in FIXTURE_FILES:
            require(raw == canonical_bytes(load(path)), "unstable_fixture_order", name)

    schema_validate(docs["equipment-source-fixture.json"], schema_dir / "equipment-source-fixture.schema.json")
    schema_validate(docs["equipment-classification-mapping.json"], schema_dir / "equipment-classification-mapping.schema.json")
    schema_validate(docs["equipment-unresolved.example.json"], schema_dir / "equipment-unresolved.schema.json")
    allow = docs["equipment-allowlist.json"]["records"]
    require(docs["equipment-allowlist.json"].get("expectedCount") == 825 and len(allow) == 825, "invalid_equipment_allowlist_count", str(len(allow)))
    allow_by_id = unique(allow, "equipmentId")
    source = extract_sources(program_source_root or source_root, source_root)
    db_items, wiki = source["dbItems"], source["wiki"]
    wiki_equipment = {x["id"]: x for x in wiki if x["category"] == "equipment"}
    excluded = {x["id"] for x in wiki if x["category"] in {"skillbook", "doll", "set"}}
    require(set(allow_by_id).isdisjoint(excluded), "out_of_scope_item", "SkillBook/Doll/remains included")
    require(set(wiki_equipment).issubset(allow_by_id), "missing_equipment_source", "legacy EQUIP_DATA must remain covered")
    require(set(allow_by_id).issubset(db_items), "missing_equipment_source", "allowlist ID missing from DB.items")
    for row in allow:
        require(row["equipmentGroup"] if "equipmentGroup" in row else True, "invalid_equipment_group", row["equipmentId"])
        require(row["expectedGroup"] in GROUPS, "invalid_equipment_group", row["equipmentId"])
        require(row["expectedType"] in TYPES or (row["equipmentId"] == "wpn_giltas_wand" and row["expectedType"] is None), "invalid_equipment_type", row["equipmentId"])
        require(row["expectedSlot"] in SLOTS, "invalid_equipment_slot", row["equipmentId"])
        require(row["sourceItemType"] == db_items[row["equipmentId"]]["type"], "missing_equipment_source", row["equipmentId"])

    unresolved_mappings = docs["equipment-classification-mapping.json"].get("unresolvedMappings", [])
    mappings = docs["equipment-classification-mapping.json"]["resolvedMappings"]
    mapping_by_id = unique(mappings, "equipmentId")
    unresolved_by_id = unique(unresolved_mappings, "equipmentId")
    require(set(mapping_by_id) | set(unresolved_by_id) == set(allow_by_id) and set(mapping_by_id).isdisjoint(unresolved_by_id), "unresolved_classification", "mapping coverage differs from allowlist")
    require(set(unresolved_by_id) == {"wpn_giltas_wand"}, "unresolved_classification", "only the audited Giltas wand subtype may remain unresolved")
    require("display_name_regex" in docs["equipment-classification-mapping.json"]["forbiddenStrategies"], "classification_conflict", "name regex not forbidden")
    for equipment_id, mapped in mapping_by_id.items():
        expected = allow_by_id[equipment_id]
        require(mapped["equipmentGroup"] in GROUPS, "invalid_equipment_group", equipment_id)
        require(mapped["equipmentType"] in TYPES, "invalid_equipment_type", equipment_id)
        require(mapped["slot"] in SLOTS, "invalid_equipment_slot", equipment_id)
        require((mapped["equipmentGroup"], mapped["equipmentType"], mapped["slot"]) == (expected["expectedGroup"], expected["expectedType"], expected["expectedSlot"]), "classification_conflict", equipment_id)
    for equipment_id, mapped in unresolved_by_id.items():
        expected = allow_by_id[equipment_id]
        require((mapped["equipmentGroup"], mapped["equipmentType"], mapped["slot"], mapped["status"]) == (expected["expectedGroup"], expected["expectedType"], expected["expectedSlot"], "unresolved"), "classification_conflict", equipment_id)

    prices = docs["equipment-price-conflicts.json"]["records"]
    require(len(prices) == 5 and {x["equipmentId"] for x in prices} == PRICE_IDS, "missing_price_conflict_fixture", "expected five audited IDs")
    for row in prices:
        require(row["fieldPath"] == "price.amount" and row["authoritativeCandidate"] == "DB.items.p" and row["status"] == "review_required" and row["diagnosticCode"] == "equipment_price_conflict", "missing_price_conflict_fixture", row["equipmentId"])
        require(row["dbItemsValue"] == db_items[row["equipmentId"]]["p"] and row["wikiValue"] == wiki_equipment[row["equipmentId"]]["price"], "missing_price_conflict_fixture", row["equipmentId"])

    specials = docs["equipment-special-cases.json"]["records"]
    require({x["caseId"] for x in specials} == SPECIAL_CASES, "unresolved_classification", "special-case coverage")
    for row in specials:
        equipment_id, raw = row["equipmentId"], db_items[row["equipmentId"]]
        require(row["expectedClassification"] == {"equipmentGroup": mapping_by_id[equipment_id]["equipmentGroup"], "equipmentType": mapping_by_id[equipment_id]["equipmentType"], "slot": mapping_by_id[equipment_id]["slot"]}, "classification_conflict", row["caseId"])
        safe = row["expectedSafeSemantics"]
        if row["caseId"] == "no_enhance":
            require(raw["noEnhance"] and safe["enhanceable"] is False and safe["sourceState"] == "not_applicable", "invalid_unresolved_state", row["caseId"])
        if row["caseId"] == "safe_explicit_zero":
            require(raw["hasSafe"] and raw["safe"] == 0 and safe["sourceState"] == "explicit_zero", "invalid_unresolved_state", row["caseId"])
        if row["caseId"] == "safe_missing":
            require(not raw["hasSafe"] and safe["safeLevel"] is None and safe["sourceState"] == "missing_unresolved", "invalid_unresolved_state", row["caseId"])
        req = row["expectedClassSemantics"]
        if row["caseId"] == "requirements_all":
            require(raw["req"] == "all" and isinstance(req["baseClasses"], list) and len(req["baseClasses"]) == 8 and req["sourceState"] == "explicit_all", "invalid_unresolved_state", row["caseId"])
        if row["caseId"] == "requirements_missing":
            require(not raw["hasReq"] and req["baseClasses"] is None and req["sourceState"] == "missing_unresolved", "invalid_unresolved_state", row["caseId"])

    source_fixture = docs["equipment-source-fixture.json"]
    for row in source_fixture["sources"]:
        path_text = json.dumps(row, ensure_ascii=False)
        require(not WINDOWS_ABSOLUTE.search(path_text) and "file://" not in path_text.lower() and "localhost" not in path_text.lower() and "127.0.0.1" not in path_text, "unsafe_equipment_source_path", row["sourceId"])
        require(not row["usesDom"] and not row["usesPlayerState"] and not row["usesLocalStorage"], "forbidden_runtime_extraction", row["sourceId"])
    all_text = json.dumps(docs, ensure_ascii=False)
    require(not WINDOWS_ABSOLUTE.search(all_text) and "file://" not in all_text.lower() and "localhost" not in all_text.lower(), "unsafe_equipment_source_path", "fixture content")

    unresolved = docs["equipment-unresolved.example.json"]["records"]
    for row in unresolved:
        require("target" not in row and row["valueState"] in {"missing", "not_applicable", "explicit_zero", "derived_zero", "unresolved", "conflict", "unverified_claim"}, "invalid_unresolved_state", row["id"])
    schema_validate(equipment_schema_probe(allow[0]["equipmentId"]), schema_dir / "equipment.schema.json")
    require(len(load(schema_dir / "equipment.schema.json")["required"]) == 20, "schema_validation_failed", "top-level field ceiling is not 20")

    hashes = {name: hashlib.sha256(((fixture_dir if name in FIXTURE_FILES else schema_dir) / name).read_bytes()).hexdigest() for name in FIXTURE_FILES + SCHEMA_FILES}
    return {
        "allowlist": len(allow), "classificationMappings": len(mappings),
        "unresolvedClassifications": len(unresolved_by_id),
        "specialCases": len(specials), "priceConflicts": len(prices),
        "unresolvedExamples": len(unresolved), "schemas": 4,
        "schema": "passed", "validator": "passed", "byteStable": True,
        "sha256": hashes,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-dir", type=Path, default=DEFAULT_FIXTURES)
    parser.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMAS)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--program-source-root", type=Path)
    args = parser.parse_args()
    try:
        result = validate(args.fixture_dir, args.schema_dir, args.source_root, args.program_source_root)
    except (ValidationError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
