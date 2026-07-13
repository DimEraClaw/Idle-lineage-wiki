#!/usr/bin/env python3
"""Generate the deterministic Equipment E3-B datasets from approved sources."""

from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "equipment"
SCHEMA_VERSION = "1.0.0"
CLASSES = ("dark", "dragon", "elf", "illusion", "knight", "mage", "royal", "warrior")
BASE_STATS = (
    "ac", "cha", "con", "dex", "dmgBonus", "dmgL", "dmgS", "dr", "er", "extraMp",
    "hit", "int", "mdmg", "mhp", "mmp", "mr", "resEarth", "resFire", "resWater",
    "resWind", "str", "wis",
)
TOP_LEVEL_FIELDS = (
    "equipmentId", "displayName", "itemType", "equipmentGroup", "equipmentType", "slot",
    "classRequirements", "rarity", "baseStats", "safeEnhance", "price", "description",
    "skillRefs", "setRefs", "mechanicRefs", "relations", "verification", "version", "status",
    "entityRef",
)
MECHANIC_SIGNAL_FIELDS = {
    "armguard", "atkSpdPct", "auraDmg", "autoCastDmgMult", "autoCastMpMult", "block",
    "blueSpecter", "classicOk", "comboRate", "counterBarrierX2", "crushDr", "dmgReflect",
    "dotCrit", "eff", "ele", "eleWpnMult", "equipHaste", "expBonus", "extraDmg",
    "extraHit", "extraMpPerEn", "fireNullify", "freeChill", "fullHpMpHalf", "fullHpMult",
    "fullHpMultTriple", "giantBonus", "goldBonus", "grantSkills", "hardSkinMult", "hasteStrike",
    "heavyMult", "heavyRatePct", "highestAttrPlus", "hitstunReduce", "hotHealMult", "hpR",
    "hurtExplode", "ignHardSkin", "immBurn", "immFreeze", "immParalyze", "immPoison",
    "immSlow", "immStone", "instakillFull", "lure", "lvDmgDiv", "lvHitDiv", "magicDrNonEle",
    "magicHit", "mcrit", "mcritDmg", "mdmgEnFrom4", "mdmgEnFrom7Max3", "meleeDmg",
    "meleeHaste", "meleeHit", "meleeHitPerEn", "mpOnHit", "mpOnHitAmt", "mpOnHitBase",
    "mpR", "mpROverSafe", "mpRPerEn", "moveSpeedPct", "noBleed", "onDmgHeal", "onDmgHealCd",
    "onHitCastSkill", "onHitEleDmg", "onHitEleVuln", "partnerHit", "petAc", "petDmg",
    "petDmgAll", "petHit", "petHitAll", "petInt", "petMr", "petSkillDmgMult", "petWis",
    "physDrGated", "pierceChance", "poisonHealMult", "poisonMult", "poisonedBonusDmg",
    "polyAtkSpdPct", "potionBonus", "procBonusDmg", "procBurstPoison", "procDmgReduce",
    "procFireSkillRate", "procHealFlat", "procInstakill", "procPoison", "procPoisonRate",
    "procRateBase", "procRatePerEn", "procSkill", "procStatusSkill", "qiguProc", "raceBonus",
    "raceFlat", "rapidfire", "rangedDmg", "rangedHit", "rcrit", "redSpecter", "relicDropX2",
    "selfBreakProc", "shahaArrow", "shahaBow", "showMobEle", "skillDmgMult", "sleepResist",
    "slowedBonusDmg", "softMult", "spellProc", "strawCurse", "stealth", "stoneInstakill",
    "stunHitBonus", "stunResist", "summonDmg", "summonHit", "thorns", "trackBoost", "unBonus",
    "vanderStunHit", "weakExpose", "weakHitBonus", "wearerEle", "windHelm",
}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value))


def extract_program_sources(source_root: Path) -> dict[str, Any]:
    """Evaluate only balanced data literals in a fresh VM; no game file is executed."""
    script = r"""
const fs=require('fs'),vm=require('vm');
function ext(t,m,o,c){let p=t.indexOf(m);if(p<0)throw Error(m);p=t.indexOf(o,p);let d=0,q=null,e=false;for(let i=p;i<t.length;i++){let x=t[i];if(q){if(e)e=false;else if(x==='\\')e=true;else if(x===q)q=null;continue}if(x==='"'||x==="'"||x==='`'){q=x;continue}if(x===o)d++;else if(x===c&&--d===0)return t.slice(p,i+1)}throw Error('unclosed '+m)}
const root=process.argv[2], data=fs.readFileSync(root+'/js/00-data.js','utf8'), ui=fs.readFileSync(root+'/js/10-ui-tabs.js','utf8'), wikiText=fs.readFileSync(root+'/wiki.html','utf8');
const db=vm.runInNewContext('('+ext(data,'const DB','{','}')+')');
const tags=vm.runInNewContext('('+ext(ui,'const WEAPON_TAGS','{','}')+')');
const wiki=JSON.parse(ext(wikiText,'const EQUIP_DATA','[',']'));
const match=data.match(/const\s+GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
console.log(JSON.stringify({items:db.items,sets:db.sets,weaponTags:tags,wiki,gameVersion:match?match[1]:null}));
"""
    result = subprocess.run(
        ["node", "-", str(source_root.resolve()).replace("\\", "/")], input=script,
        text=True, encoding="utf-8", capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "restricted source extraction failed")
    return json.loads(result.stdout)


def ref(entity_type: str, entity_id: str) -> dict[str, str]:
    return {"entityType": entity_type, "entityId": entity_id}


def diagnostic(
    equipment_id: str,
    field_path: str,
    code: str,
    reason: str,
    source_location: str | None,
    *,
    candidates: list[str | int | float | bool] | None = None,
    blocking: bool = False,
    status: str = "unresolved",
    value_state: str = "unresolved",
    notes: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"equipment_diagnostic_{equipment_id}_{code}",
        "equipmentId": equipment_id,
        "fieldPath": field_path,
        "code": code,
        "reason": reason,
        "sourceLocation": source_location,
        "candidates": candidates or [],
        "blocking": blocking,
        "status": status,
        "valueState": value_state,
        "evidenceRefs": [],
        "notes": notes or [],
    }


def provenance(
    source_file: str | None,
    symbol_path: str | None,
    source_revision: str | None,
    game_version: str | None,
    extraction_method: str,
    classification: str,
    *,
    conflict: bool = False,
    unresolved_reason: str | None = None,
) -> dict[str, Any]:
    return {
        "sourceFile": source_file,
        "symbolPath": symbol_path,
        "sourceRevision": source_revision,
        "gameVersion": game_version,
        "extractionMethod": extraction_method,
        "classification": classification,
        "evidenceRefs": [],
        "conflict": conflict,
        "unresolvedReason": unresolved_reason,
    }


def relation_sort_key(value: dict[str, Any]) -> tuple[str, str, str, str, str]:
    target = value["target"] or {"entityType": "", "entityId": ""}
    relation_ref = value["relationRef"] or {"entityType": "", "entityId": ""}
    return (
        value["relationType"], target["entityType"], target["entityId"],
        relation_ref["entityType"], relation_ref["entityId"],
    )


def build(source_root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any]]:
    fixtures = source_root / "fixtures" / "equipment"
    allow = load(fixtures / "equipment-allowlist.json")["records"]
    mappings = load(fixtures / "equipment-classification-mapping.json")["resolvedMappings"]
    source_fixture = load(fixtures / "equipment-source-fixture.json")
    price_fixture = load(fixtures / "equipment-price-conflicts.json")["records"]
    program = extract_program_sources(source_root)
    drops = load(source_root / "data" / "monster" / "drop_tables.json")["records"]
    recipes = load(source_root / "data" / "craft" / "recipes.json")

    allow_ids = {row["equipmentId"] for row in allow}
    mapping_by_id = {row["equipmentId"]: row for row in mappings}
    wiki_by_id = {row["id"]: row for row in program["wiki"] if row.get("category") == "equipment"}
    price_by_id = {row["equipmentId"]: row for row in price_fixture}
    source_by_id = {row["sourceId"]: row for row in source_fixture["sources"]}
    db_source = source_by_id["db_items"]
    game_version = program["gameVersion"] or db_source["gameVersion"]
    source_revision = db_source["sourceRevision"]

    drop_relations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for table in drops:
        owner = table["owner"]
        for entry in table["entries"]:
            equipment_id = entry["itemRef"]["entityId"]
            if equipment_id in allow_ids:
                drop_relations[equipment_id].append({
                    "relationType": "monster_drop",
                    "relationRef": entry["entityRef"],
                    "target": owner,
                    "status": "resolved",
                })

    craft_relations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for recipe in recipes:
        recipe_ref = ref("recipe", recipe["id"])
        result_id = recipe["result"]["itemId"]
        if result_id in allow_ids:
            craft_relations[result_id].append({
                "relationType": "craft_result", "relationRef": None,
                "target": recipe_ref, "status": "resolved",
            })
        for requirement in recipe["requirements"]:
            equipment_id = requirement["itemId"]
            if equipment_id in allow_ids:
                craft_relations[equipment_id].append({
                    "relationType": "craft_requirement", "relationRef": None,
                    "target": recipe_ref, "status": "resolved",
                })

    legacy_sets: dict[str, list[str]] = defaultdict(list)
    for set_id, set_record in program["sets"].items():
        for equipment_id in set_record.get("items", []):
            if equipment_id in allow_ids:
                legacy_sets[equipment_id].append(set_id)

    records: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for allow_row in sorted(allow, key=lambda row: row["equipmentId"]):
        equipment_id = allow_row["equipmentId"]
        raw = program["items"][equipment_id]
        wiki = wiki_by_id[equipment_id]
        mapping = mapping_by_id[equipment_id]
        item_diagnostics: list[dict[str, Any]] = []

        req = raw.get("req")
        if req is None:
            class_requirements = {"baseClasses": None, "ruleRefs": [], "status": "unresolved"}
            item_diagnostics.append(diagnostic(
                equipment_id, "classRequirements", "equipment_class_requirement_unresolved",
                "DB.items omits req; omission is not equivalent to all classes.",
                f"js/00-data.js#DB.items.{equipment_id}", blocking=True, value_state="missing",
            ))
        elif req == "all":
            class_requirements = {"baseClasses": list(CLASSES), "ruleRefs": [], "status": "resolved"}
        else:
            parsed = sorted({value for value in str(req).split(",") if value in CLASSES})
            unknown = sorted({value for value in str(req).split(",") if value not in CLASSES})
            class_requirements = {"baseClasses": parsed or None, "ruleRefs": [], "status": "unresolved" if unknown else "resolved"}
            if unknown:
                item_diagnostics.append(diagnostic(
                    equipment_id, "classRequirements.baseClasses", "equipment_class_requirement_unresolved",
                    "DB.items.req contains an unapproved class key.",
                    f"js/00-data.js#DB.items.{equipment_id}.req", candidates=unknown,
                    blocking=True,
                ))

        if raw.get("noEnhance") is True:
            safe_enhance = {"enhanceable": False, "safeLevel": None, "maxLevel": None, "ruleRefs": [], "status": "resolved"}
        elif "safe" in raw:
            safe_enhance = {
                "enhanceable": True, "safeLevel": raw["safe"], "maxLevel": raw.get("maxEn"),
                "ruleRefs": [], "status": "resolved" if "maxEn" in raw else "partial",
            }
        else:
            safe_enhance = {"enhanceable": None, "safeLevel": None, "maxLevel": raw.get("maxEn"), "ruleRefs": [], "status": "unresolved"}
            item_diagnostics.append(diagnostic(
                equipment_id, "safeEnhance.safeLevel", "equipment_safe_enhance_unresolved",
                "DB.items omits both safe and noEnhance; no value is inferred.",
                f"js/00-data.js#DB.items.{equipment_id}", blocking=True, value_state="missing",
            ))

        base_stats: dict[str, Any] = {}
        for stat in BASE_STATS:
            if stat in raw:
                value = raw[stat]
                state = "explicit_zero" if value == 0 else "explicit"
            elif stat in {"dmgS", "dmgL"} and raw["type"] != "wpn":
                value, state = None, "not_applicable"
            else:
                value, state = None, "unresolved"
            base_stats[stat] = {"value": value, "valueState": state, "unit": None, "conceptRef": None}

        description_text = raw.get("d") or None
        if description_text is None:
            item_diagnostics.append(diagnostic(
                equipment_id, "description.canonicalText", "equipment_description_missing",
                "DB.items has no canonical description text.",
                f"js/00-data.js#DB.items.{equipment_id}", value_state="missing",
            ))

        mechanic_fields = sorted(set(raw) & MECHANIC_SIGNAL_FIELDS)
        if mechanic_fields:
            item_diagnostics.append(diagnostic(
                equipment_id, "mechanicRefs", "equipment_mechanic_unresolved",
                "Code-backed mechanic fields exist, but formal Mechanic Entity IDs are not established.",
                f"js/00-data.js#DB.items.{equipment_id}", candidates=mechanic_fields,
            ))

        if legacy_sets.get(equipment_id):
            item_diagnostics.append(diagnostic(
                equipment_id, "setRefs", "equipment_set_identity_unresolved",
                "DB.sets membership is verified, but legacy set keys are not approved EquipmentSet Entity IDs.",
                "js/00-data.js#DB.sets", candidates=sorted(legacy_sets[equipment_id]),
            ))

        legacy_sources = wiki.get("sources") or []
        if legacy_sources:
            item_diagnostics.append(diagnostic(
                equipment_id, "relations", "equipment_relation_unresolved",
                "Legacy Wiki source claims contain HTML or name-based targets and are not imported as formal relations.",
                f"wiki.html#EQUIP_DATA.{equipment_id}.sources", candidates=[len(legacy_sources)],
            ))

        item_diagnostics.append(diagnostic(
            equipment_id, "weight", "equipment_weight_unverified",
            "Legacy Wiki weight has no verified canonical ID-based source and is excluded from Equipment schema.",
            f"wiki.html#EQUIP_DATA.{equipment_id}.weight", candidates=[wiki["weight"]],
            value_state="unverified_claim",
        ))

        if equipment_id in price_by_id:
            conflict = price_by_id[equipment_id]
            item_diagnostics.append(diagnostic(
                equipment_id, "price.amount", "equipment_price_conflict",
                "DB.items.p and the Wiki migration projection disagree; DB.items.p is used as the authoritative candidate.",
                conflict["sourceLocations"][0], candidates=[conflict["dbItemsValue"], conflict["wikiValue"]],
                blocking=True, status="review_required", value_state="conflict",
                notes=conflict["sourceLocations"],
            ))
            item_diagnostics.append(diagnostic(
                equipment_id, "price.amount", "equipment_source_precedence_conflict",
                "Source precedence selects DB.items.p without discarding the conflicting Wiki claim.",
                "fixtures/equipment/equipment-price-conflicts.json", candidates=["DB.items.p", "wiki.html#EQUIP_DATA.price"],
                blocking=True, status="review_required", value_state="conflict",
            ))

        relations = sorted(drop_relations[equipment_id] + craft_relations[equipment_id], key=relation_sort_key)
        if any(row["status"] == "review_required" for row in item_diagnostics):
            status = "review_required"
        elif any(row["blocking"] for row in item_diagnostics):
            status = "unresolved"
        elif item_diagnostics:
            status = "partial"
        else:
            status = "complete"

        canonical = lambda field: provenance(
            "js/00-data.js", f"DB.items.{equipment_id}.{field}", source_revision, game_version,
            "restricted_object_literal", "canonical",
        )
        derived_mapping = provenance(
            "fixtures/equipment/equipment-classification-mapping.json", f"resolvedMappings.{equipment_id}",
            None, game_version, "id_mapping_fixture", "derived",
        )
        fields: dict[str, Any] = {}
        for field in ("equipmentId", "displayName", "itemType", "classRequirements", "baseStats", "safeEnhance", "price", "description"):
            fields[field] = canonical(field)
        for field in ("equipmentGroup", "equipmentType", "slot", "rarity"):
            fields[field] = derived_mapping
        for field, reason in (
            ("skillRefs", "No verified direct Skill relation is established for this Equipment record."),
            ("setRefs", "Formal EquipmentSet identity is not established."),
            ("mechanicRefs", "Formal Mechanic identity is not established."),
        ):
            fields[field] = provenance(None, None, None, game_version, "empty_verified_summary", "relation_summary", unresolved_reason=reason)
        fields["relations"] = provenance(None, None, None, game_version, "owner_dataset_reverse_index", "relation_summary")
        fields["version"] = provenance("fixtures/equipment/equipment-source-fixture.json", "sources.db_items", source_revision, game_version, "source_manifest", "derived")
        fields["status"] = provenance("data/equipment/diagnostics.json", f"records.{equipment_id}", source_revision, game_version, "diagnostic_aggregation", "derived")
        fields["entityRef"] = provenance("fixtures/equipment/equipment-allowlist.json", f"records.{equipment_id}", None, game_version, "identity_projection", "derived")

        record = {
            "equipmentId": equipment_id,
            "displayName": raw["n"],
            "itemType": raw["type"],
            "equipmentGroup": mapping["equipmentGroup"],
            "equipmentType": mapping["equipmentType"],
            "slot": mapping["slot"],
            "classRequirements": class_requirements,
            "rarity": "relic" if raw.get("relic") else "legendary" if raw.get("legend") else "common",
            "baseStats": base_stats,
            "safeEnhance": safe_enhance,
            "price": {"amount": raw.get("p"), "currencyRef": None, "priceType": "base_item_price"},
            "description": {"canonicalText": description_text, "editorialNote": None},
            "skillRefs": [],
            "setRefs": [],
            "mechanicRefs": [],
            "relations": relations,
            "verification": {"statuses": ["Code", "Generated", "Unknown"], "fields": fields},
            "version": {"sourceRevision": source_revision, "gameVersion": game_version, "schemaVersion": SCHEMA_VERSION, "validFrom": None, "validTo": None},
            "status": status,
            "entityRef": ref("equipment", equipment_id),
        }
        records.append(record)
        diagnostics.extend(item_diagnostics)

    diagnostics.sort(key=lambda row: (row["equipmentId"], row["code"], row["id"]))
    unresolved = [row for row in diagnostics if row["status"] == "unresolved"]
    diagnostic_counts = dict(sorted(Counter(row["code"] for row in diagnostics).items()))
    unresolved_counts = dict(sorted(Counter(row["code"] for row in unresolved).items()))
    documents = {
        "equipments.json": {"dataset": "equipment", "schemaVersion": SCHEMA_VERSION, "records": records},
        "diagnostics.json": {"dataset": "equipment_diagnostics", "schemaVersion": SCHEMA_VERSION, "summary": diagnostic_counts, "records": diagnostics},
        "unresolved.json": {"dataset": "equipment_unresolved", "schemaVersion": SCHEMA_VERSION, "summary": unresolved_counts, "records": unresolved},
    }
    relation_counts = Counter(relation["relationType"] for record in records for relation in record["relations"])
    stats = {
        "equipment": len(records),
        "groups": dict(sorted(Counter(record["equipmentGroup"] for record in records).items())),
        "types": dict(sorted(Counter(record["equipmentType"] for record in records).items())),
        "slots": dict(sorted(Counter(record["slot"] for record in records).items())),
        "relations": dict(sorted(relation_counts.items())),
        "diagnostics": diagnostic_counts,
        "unresolved": len(unresolved),
        "status": dict(sorted(Counter(record["status"] for record in records).items())),
    }
    return documents, stats


def generate(source_root: Path = ROOT, output_dir: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    documents, stats = build(source_root)
    for name, document in documents.items():
        write(output_dir / name, document)
    return stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        result = generate(args.source_root, args.output_dir)
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
